import type { VercelRequest, VercelResponse } from "@vercel/node"
import { get, put } from "@vercel/blob"
import { createHmac, timingSafeEqual } from "node:crypto"
import dotenv from "dotenv"


dotenv.config({ path: ".env.local" })

const COOKIE_NAME = "dashboard_admin_session"
const SESSION_DURATION = 8 * 60 * 60
const BLOB_PATH = "game-collections.json"
const STEAM_ID = "76561198047552050"
const LIBRARY_TTL_MS = 60 * 60 * 1000

interface GameCollections {
    liked: number[]
    wantToPlay: number[]
}

interface OwnedGame {
    appid: number
    name: string
}

const emptyCollections: GameCollections = {
    liked: [],
    wantToPlay: [],
}

// Kept in memory while this serverless instance stays warm.
let libraryCache: { games: OwnedGame[]; at: number } | null = null

function getSecret(name: string): string {
    const value = process.env[name]
    if (!value) throw new Error(`${name} is not configured`)
    return value
}

// A short secret makes signed sessions guessable, so refuse to run with one.
function getSessionSecret(): string {
    const secret = getSecret("SESSION_SECRET")
    if (secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters")
    return secret
}

function sign(value: string): string {
    return createHmac("sha256", getSessionSecret())
        .update(value)
        .digest("hex")
}

function createSession(): string {
    const payload = Buffer.from(
        JSON.stringify({ expires: Math.floor(Date.now() / 1000) + SESSION_DURATION })
    ).toString("base64url")

    return `${payload}.${sign(payload)}`
}

function isAuthenticated(req: VercelRequest): boolean {
    try {
        const cookie = req.headers.cookie
            ?.split(";")
            .map((part) => part.trim())
            .find((part) => part.startsWith(`${COOKIE_NAME}=`))

        if (!cookie) return false

        const token = decodeURIComponent(cookie.slice(COOKIE_NAME.length + 1))
        const [payload, signature] = token.split(".")

        if (!payload || !signature) return false

        const expected = sign(payload)
        const actualBuffer = Buffer.from(signature, "hex")
        const expectedBuffer = Buffer.from(expected, "hex")

        if (
            actualBuffer.length !== expectedBuffer.length ||
            !timingSafeEqual(actualBuffer, expectedBuffer)
        ) {
            return false
        }

        const session = JSON.parse(
            Buffer.from(payload, "base64url").toString("utf8")
        )

        return typeof session.expires === "number" &&
            session.expires > Math.floor(Date.now() / 1000)
    } catch {
        return false
    }
}

function setSessionCookie(res: VercelResponse, value: string, maxAge: number) {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""

    res.setHeader(
        "Set-Cookie",
        `${COOKIE_NAME}=${value}; HttpOnly; Path=/api; SameSite=Strict; Max-Age=${maxAge}${secure}`
    )
}

function isValidCollections(value: unknown): value is GameCollections {
    if (!value || typeof value !== "object") return false

    const data = value as Record<string, unknown>

    return (
        Array.isArray(data.liked) &&
        data.liked.length <= 20 &&
        data.liked.every(
            (id) => Number.isSafeInteger(id) && id > 0
        ) &&
        Array.isArray(data.wantToPlay) &&
        data.wantToPlay.length <= 100 &&
        data.wantToPlay.every(
            (id) => Number.isSafeInteger(id) && id > 0
        )
    )
}


async function readCollections(): Promise<GameCollections> {
    const result = await get(BLOB_PATH, {
        access: "private",
        token: getSecret("BLOB_READ_WRITE_TOKEN"),
    })

    if (!result || result.statusCode !== 200 || !result.stream) {
        return emptyCollections
    }

    const chunks: Uint8Array[] = []

    for await (const chunk of result.stream) {
        chunks.push(chunk)
    }

    const content = Buffer.concat(chunks).toString("utf8")
    const data: unknown = JSON.parse(content)

    if (!isValidCollections(data)) {
        throw new Error("Saved game collections have an invalid format")
    }

    return data
}


async function saveCollections(data: GameCollections) {
    await put(BLOB_PATH, JSON.stringify(data), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        token: getSecret("BLOB_READ_WRITE_TOKEN"),
    })
}

async function getOwnedGames(): Promise<OwnedGame[]> {
    if (libraryCache && Date.now() - libraryCache.at < LIBRARY_TTL_MS) {
        return libraryCache.games
    }

    const url = new URL("https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/")
    url.searchParams.set("key", getSecret("STEAM_API_KEY"))
    url.searchParams.set("steamid", STEAM_ID)
    url.searchParams.set("include_appinfo", "true")
    url.searchParams.set("include_played_free_games", "true")

    const response = await fetch(url)

    if (!response.ok) {
        throw new Error(`Steam request failed: ${response.status}`)
    }

    const data = await response.json()
    const games: OwnedGame[] = (data.response?.games ?? []).map(
        (game: OwnedGame) => ({ appid: game.appid, name: game.name })
    )

    libraryCache = { games, at: Date.now() }
    return games
}

// Turns saved appids into { appid, name } so the browser never needs the full library.
async function resolveCollections(collections: GameCollections) {
    const byId = new Map((await getOwnedGames()).map((game) => [game.appid, game]))

    const pick = (ids: number[]) =>
        ids
            .map((id) => byId.get(id))
            .filter((game): game is OwnedGame => game !== undefined)

    return {
        liked: pick(collections.liked),
        wantToPlay: pick(collections.wantToPlay),
    }
}

function isSameOrigin(req: VercelRequest): boolean {
    const origin = req.headers.origin

    // Browsers always send Origin on POST and PUT, so a missing one is not a cross-site browser request.
    if (!origin) return true

    try {
        const forwarded = req.headers["x-forwarded-host"]
        const host = (Array.isArray(forwarded) ? forwarded[0] : forwarded) ?? req.headers.host

        return new URL(origin).host === host
    } catch {
        return false
    }
}

const ATTEMPTS_PATH = "login-attempts.json"
const MAX_FAILURES = 5
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000

type Attempts = Record<string, { count: number; first: number }>

// Visitors are tracked by a keyed hash of their IP address, never the address itself.
function clientKey(req: VercelRequest): string {
    const forwarded = req.headers["x-forwarded-for"]
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim()
    const address = first || req.socket?.remoteAddress || "unknown"

    return createHmac("sha256", getSessionSecret()).update(`ip:${address}`).digest("hex").slice(0, 32)
}

function pruneAttempts(state: Attempts): Attempts {
    const now = Date.now()

    return Object.fromEntries(
        Object.entries(state).filter(
            ([, record]) =>
                record &&
                typeof record.count === "number" &&
                typeof record.first === "number" &&
                now - record.first < ATTEMPT_WINDOW_MS
        )
    )
}

async function readAttempts(): Promise<Attempts> {
    try {
        const result = await get(ATTEMPTS_PATH, {
            access: "private",
            token: getSecret("BLOB_READ_WRITE_TOKEN"),
        })

        if (!result || result.statusCode !== 200 || !result.stream) return {}

        const chunks: Uint8Array[] = []

        for await (const chunk of result.stream) {
            chunks.push(chunk)
        }

        const data: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"))

        return data && typeof data === "object" ? (data as Attempts) : {}
    } catch {
        return {}
    }
}

async function writeAttempts(state: Attempts) {
    try {
        await put(ATTEMPTS_PATH, JSON.stringify(state), {
            access: "private",
            addRandomSuffix: false,
            allowOverwrite: true,
            contentType: "application/json",
            token: getSecret("BLOB_READ_WRITE_TOKEN"),
        })
    } catch (error) {
        console.error("Couldn't record login attempts:", error)
    }
}

// Compares fixed-length digests, so the password's length is not revealed by timing.
function passwordMatches(password: string): boolean {
    const secret = getSessionSecret()
    const digest = (value: string) => createHmac("sha256", secret).update(value).digest()

    return timingSafeEqual(digest(password), digest(getSecret("ADMIN_PASSWORD")))
}

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    res.setHeader("Cache-Control", "no-store")

    if (req.method !== "GET" && !isSameOrigin(req)) {
        return res.status(403).json({ error: "Forbidden" })
    }

    try {
        if (req.method === "GET") {
            // Raw ids are only needed by the admin picker; the public page uses ?resolve=1.
            if (req.query.resolve !== "1" && !isAuthenticated(req)) {
                return res.status(401).json({ error: "Admin login required" })
            }

            const collections = await readCollections()

            // Public page: only the chosen games, safe to cache briefly at the edge.
            if (req.query.resolve === "1") {
                const resolved = await resolveCollections(collections)
                res.setHeader(
                    "Cache-Control",
                    "public, s-maxage=60, stale-while-revalidate=600"
                )
                return res.status(200).json(resolved)
            }

            // Raw ids (used by the admin picker) must never be cached.
            return res.status(200).json(collections)
        }

        if (req.method === "POST") {
            if (req.body?.action === "check-session") {
                return res.status(200).json({
                    authenticated: isAuthenticated(req),
                })
            }

            if (req.body?.action === "logout") {
                setSessionCookie(res, "", 0)
                return res.status(200).json({ success: true })
            }

            if (req.body?.action !== "login") {
                return res.status(400).json({ error: "Invalid action" })
            }


            const password = req.body?.password

            if (typeof password !== "string" || password.length === 0 || password.length > 200) {
                return res.status(400).json({ error: "Password required" })
            }

            const key = clientKey(req)
            const attempts = pruneAttempts(await readAttempts())
            const record = attempts[key]

            if (record && record.count >= MAX_FAILURES) {
                const retryAfter = Math.ceil((record.first + ATTEMPT_WINDOW_MS - Date.now()) / 1000)
                res.setHeader("Retry-After", String(Math.max(retryAfter, 1)))
                return res.status(429).json({ error: "Too many attempts. Try again later." })
            }

            if (!passwordMatches(password)) {
                attempts[key] = {
                    count: (record?.count ?? 0) + 1,
                    first: record?.first ?? Date.now(),
                }
                await writeAttempts(attempts)
                await new Promise((resolve) => setTimeout(resolve, 500))
                return res.status(401).json({ error: "Invalid password" })
            }

            if (record) {
                delete attempts[key]
                await writeAttempts(attempts)
            }

            setSessionCookie(res, createSession(), SESSION_DURATION)
            return res.status(200).json({ success: true })
        }

        if (req.method === "PUT") {
            if (!isAuthenticated(req)) {
                return res.status(401).json({ error: "Admin login required" })
            }

            if (!isValidCollections(req.body)) {
                return res.status(400).json({
                    error: "Invalid collections. Games I Like supports up to 20 games.",
                })
            }

            await saveCollections(req.body)
            return res.status(200).json({ success: true })
        }

        return res.status(405).json({ error: "Method not allowed" })
    } catch (error) {
        console.error("Game collections API error:", error)
        return res.status(500).json({
            error: "Couldn't process game collections request",
        })
    }
}
