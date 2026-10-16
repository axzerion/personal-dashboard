
import type { VercelRequest, VercelResponse } from "@vercel/node"
import { get, put } from "@vercel/blob"
import { createHmac, timingSafeEqual } from "node:crypto"
import dotenv from "dotenv"


dotenv.config({ path: ".env.local" })

const COOKIE_NAME = "dashboard_admin_session"
const SESSION_DURATION = 8 * 60 * 60
const BLOB_PATH = "game-collections.json"

interface GameCollections {
    liked: number[]
    wantToPlay: number[]
}

const emptyCollections: GameCollections = {
    liked: [],
    wantToPlay: [],
}

function getSecret(name: string): string {
    const value = process.env[name]
    if (!value) throw new Error(`${name} is not configured`)
    return value
}

function sign(value: string): string {
    return createHmac("sha256", getSecret("SESSION_SECRET"))
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
        `${COOKIE_NAME}=${value}; HttpOnly; Path=/api/game-collections; SameSite=Strict; Max-Age=${maxAge}${secure}`
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

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    res.setHeader("Cache-Control", "no-store")

    try {
        if (req.method === "GET") {
            return res.status(200).json(await readCollections())
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

            if (typeof password !== "string") {
                return res.status(400).json({ error: "Password required" })
            }

            const expected = Buffer.from(getSecret("ADMIN_PASSWORD"))
            const actual = Buffer.from(password)

            const valid =
                actual.length === expected.length &&
                timingSafeEqual(actual, expected)

            if (!valid) {
                return res.status(401).json({ error: "Invalid password" })
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
