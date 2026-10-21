import type { VercelRequest, VercelResponse } from "@vercel/node"
import { del, get, put } from "@vercel/blob"
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const COOKIE_NAME = "dashboard_admin_session"
const BLOB_PATH = "content.json"
const USER_AGENT = "personal-space/1.0 (personal website)"
const STATUSES = ["favorite", "current", "want", "done"] as const
const KEY_PATTERN = /^[a-z0-9-]{1,40}$/
const KINDS = ["link", "video", "image"] as const
const YOUTUBE_HOSTS = new Set(["www.youtube.com", "youtube.com", "m.youtube.com", "youtu.be"])

type ItemStatus = (typeof STATUSES)[number]

interface ContentItem {
    id: string
    title: string
    subtitle?: string
    cover?: string
    url?: string
    note?: string
    status?: ItemStatus
    value?: string
    category?: string
    kind?: (typeof KINDS)[number]
}

type ContentData = Record<string, ContentItem[]>

interface LookupResult {
    title: string
    subtitle?: string
    cover?: string
    url?: string
}

class LookupInputError extends Error {}

/* ---------- Admin session (same cookie and secret as game-collections) ---------- */

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

        const actualBuffer = Buffer.from(signature, "hex")
        const expectedBuffer = Buffer.from(sign(payload), "hex")

        if (
            actualBuffer.length !== expectedBuffer.length ||
            !timingSafeEqual(actualBuffer, expectedBuffer)
        ) {
            return false
        }

        const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))

        return typeof session.expires === "number" &&
            session.expires > Math.floor(Date.now() / 1000)
    } catch {
        return false
    }
}

/* ---------- Validation ---------- */

function isText(value: unknown, max: number): value is string {
    return typeof value === "string" && value.length <= max
}

function isOptionalText(value: unknown, max: number): boolean {
    return value === undefined || isText(value, max)
}

function isOptionalUrl(value: unknown): boolean {
    return (
        value === undefined ||
        (typeof value === "string" && value.length <= 500 && value.startsWith("https://"))
    )
}

function isValidItem(value: unknown): value is ContentItem {
    if (!value || typeof value !== "object") return false

    const item = value as Record<string, unknown>

    return (
        isText(item.id, 60) &&
        item.id.length > 0 &&
        isText(item.title, 200) &&
        item.title.trim().length > 0 &&
        isOptionalText(item.subtitle, 200) &&
        isOptionalUrl(item.cover) &&
        isOptionalUrl(item.url) &&
        isOptionalText(item.note, 300) &&
        isOptionalText(item.value, 100) &&
        isOptionalText(item.category, 60) &&
        (item.kind === undefined || KINDS.includes(item.kind as (typeof KINDS)[number])) &&
        (item.status === undefined || STATUSES.includes(item.status as ItemStatus))
    )
}

function isValidContent(value: unknown): value is ContentData {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false

    const entries = Object.entries(value as Record<string, unknown>)

    return (
        entries.length <= 20 &&
        entries.every(
            ([key, items]) =>
                KEY_PATTERN.test(key) &&
                Array.isArray(items) &&
                items.length <= 200 &&
                items.every(isValidItem)
        )
    )
}

/* ---------- Storage ---------- */

async function readContent(): Promise<ContentData> {
    try {
        const result = await get(BLOB_PATH, {
            access: "private",
            token: getSecret("BLOB_READ_WRITE_TOKEN"),
        })

        if (!result || result.statusCode !== 200 || !result.stream) return {}

        const chunks: Uint8Array[] = []

        for await (const chunk of result.stream) {
            chunks.push(chunk)
        }

        const data: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"))

        if (!isValidContent(data)) {
            throw new Error("Saved content has an invalid format")
        }

        return data
    } catch (error) {
        // First run: nothing has been saved yet.
        if (error instanceof Error && error.name.includes("NotFound")) return {}
        throw error
    }
}

async function saveContent(data: ContentData) {
    await put(BLOB_PATH, JSON.stringify(data), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        token: getSecret("BLOB_READ_WRITE_TOKEN"),
    })
}

/* ---------- Lifts (progress log) ---------- */

const LIFTS_BLOB_PATH = "lifts.json"
const UNITS = ["kg", "lb"] as const

type Unit = (typeof UNITS)[number]

interface Lift {
    id: string
    name: string
    unit: Unit
}

interface LiftEntry {
    id: string
    liftId: string
    date: string
    weight: number
    reps: number
}

interface LiftsData {
    lifts: Lift[]
    entries: LiftEntry[]
}

const emptyLifts: LiftsData = { lifts: [], entries: [] }

function isIsoDate(value: unknown): value is string {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

    const date = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function isValidLifts(value: unknown): value is LiftsData {
    if (!value || typeof value !== "object") return false

    const data = value as Record<string, unknown>

    if (!Array.isArray(data.lifts) || !Array.isArray(data.entries)) return false
    if (data.lifts.length > 30 || data.entries.length > 5000) return false

    const liftIds = new Set<string>()

    for (const lift of data.lifts) {
        if (!lift || typeof lift !== "object") return false

        const item = lift as Record<string, unknown>

        if (!isText(item.id, 60) || item.id.length === 0 || liftIds.has(item.id)) return false
        if (!isText(item.name, 60) || item.name.trim().length === 0) return false
        if (!UNITS.includes(item.unit as Unit)) return false

        liftIds.add(item.id)
    }

    return data.entries.every((entry) => {
        if (!entry || typeof entry !== "object") return false

        const row = entry as Record<string, unknown>

        return (
            isText(row.id, 60) &&
            row.id.length > 0 &&
            isText(row.liftId, 60) &&
            liftIds.has(row.liftId) &&
            isIsoDate(row.date) &&
            typeof row.weight === "number" &&
            Number.isFinite(row.weight) &&
            row.weight > 0 &&
            row.weight <= 2000 &&
            typeof row.reps === "number" &&
            Number.isInteger(row.reps) &&
            row.reps >= 1 &&
            row.reps <= 100
        )
    })
}

async function readLifts(): Promise<LiftsData> {
    try {
        const result = await get(LIFTS_BLOB_PATH, {
            access: "private",
            token: getSecret("BLOB_READ_WRITE_TOKEN"),
        })

        if (!result || result.statusCode !== 200 || !result.stream) return emptyLifts

        const chunks: Uint8Array[] = []

        for await (const chunk of result.stream) {
            chunks.push(chunk)
        }

        const data: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"))

        if (!isValidLifts(data)) {
            throw new Error("Saved lifts have an invalid format")
        }

        return data
    } catch (error) {
        // First run: nothing has been saved yet.
        if (error instanceof Error && error.name.includes("NotFound")) return emptyLifts
        throw error
    }
}

async function saveLifts(data: LiftsData) {
    await put(LIFTS_BLOB_PATH, JSON.stringify(data), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        token: getSecret("BLOB_READ_WRITE_TOKEN"),
    })
}

/* ---------- Security helpers ---------- */

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

async function readBody(req: VercelRequest, limit: number): Promise<Buffer | null> {
    const chunks: Buffer[] = []
    let total = 0

    for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        total += buffer.length

        if (total > limit) return null
        chunks.push(buffer)
    }

    return Buffer.concat(chunks)
}

function isJpeg(data: Buffer): boolean {
    return data.length > 4 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff
}

// Only known fields are saved, so nothing unexpected can ride along in a request.
function sanitizeContent(data: ContentData): ContentData {
    return Object.fromEntries(
        Object.entries(data).map(([key, items]) => [
            key,
            items.map((item) => ({
                id: item.id,
                title: item.title.trim(),
                subtitle: item.subtitle,
                cover: item.cover,
                url: item.url,
                note: item.note,
                status: item.status,
                value: item.value,
                category: item.category,
                kind: item.kind,
            })),
        ])
    )
}

function sanitizeLifts(data: LiftsData): LiftsData {
    return {
        lifts: data.lifts.map((lift) => ({id: lift.id, name: lift.name.trim(), unit: lift.unit})),
        entries: data.entries.map((entry) => ({
            id: entry.id,
            liftId: entry.liftId,
            date: entry.date,
            weight: entry.weight,
            reps: entry.reps,
        })),
    }
}

/* ---------- Ranks and screenshots ---------- */

const RANKS_BLOB_PATH = "ranks.json"
const SCREENSHOT_PREFIX = "screenshots/"
const SCREENSHOT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/
const MAX_SCREENSHOT_BYTES = 1_500_000

interface RankEntry {
    id: string
    game: string
    rank: string
    peak?: string
    note?: string
    screenshot?: string
    updated: string
}

interface RanksData {
    ranks: RankEntry[]
}

const emptyRanks: RanksData = { ranks: [] }

function isValidRanks(value: unknown): value is RanksData {
    if (!value || typeof value !== "object") return false

    const data = value as Record<string, unknown>

    if (!Array.isArray(data.ranks) || data.ranks.length > 100) return false

    return data.ranks.every((entry) => {
        if (!entry || typeof entry !== "object") return false

        const row = entry as Record<string, unknown>

        return (
            isText(row.id, 60) &&
            row.id.length > 0 &&
            isText(row.game, 100) &&
            row.game.trim().length > 0 &&
            isText(row.rank, 60) &&
            row.rank.trim().length > 0 &&
            isOptionalText(row.peak, 60) &&
            isOptionalText(row.note, 300) &&
            (row.screenshot === undefined ||
                (typeof row.screenshot === "string" && SCREENSHOT_ID.test(row.screenshot))) &&
            isIsoDate(row.updated)
        )
    })
}

function sanitizeRanks(data: RanksData): RanksData {
    return {
        ranks: data.ranks.map((entry) => ({
            id: entry.id,
            game: entry.game.trim(),
            rank: entry.rank.trim(),
            peak: entry.peak?.trim() || undefined,
            note: entry.note?.trim() || undefined,
            screenshot: entry.screenshot,
            updated: entry.updated,
        })),
    }
}

async function readRanks(): Promise<RanksData> {
    try {
        const result = await get(RANKS_BLOB_PATH, {
            access: "private",
            token: getSecret("BLOB_READ_WRITE_TOKEN"),
        })

        if (!result || result.statusCode !== 200 || !result.stream) return emptyRanks

        const chunks: Uint8Array[] = []

        for await (const chunk of result.stream) {
            chunks.push(chunk)
        }

        const data: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"))

        if (!isValidRanks(data)) {
            throw new Error("Saved ranks have an invalid format")
        }

        return data
    } catch (error) {
        // First run: nothing has been saved yet.
        if (error instanceof Error && error.name.includes("NotFound")) return emptyRanks
        throw error
    }
}

async function saveRanks(data: RanksData) {
    await put(RANKS_BLOB_PATH, JSON.stringify(data), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        token: getSecret("BLOB_READ_WRITE_TOKEN"),
    })
}

/* ---------- Lookups (admin only) ---------- */

async function fetchJson(
    url: URL | string,
    headers: Record<string, string> = {}
): Promise<unknown> {
    const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...headers },
    })

    if (!response.ok) {
        throw new Error(`Lookup request failed: ${response.status}`)
    }

    return response.json()
}

async function lookupAnime(q: string): Promise<LookupResult[]> {
    const query = `
        query ($search: String) {
            Page(perPage: 8) {
                media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
                    siteUrl
                    format
                    seasonYear
                    title { romaji english }
                    coverImage { large }
                }
            }
        }`

    const response = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query, variables: { search: q } }),
    })

    if (!response.ok) {
        throw new Error(`Lookup request failed: ${response.status}`)
    }

    const data = (await response.json()) as {
        data?: {
            Page?: {
                media?: {
                    siteUrl?: string
                    format?: string | null
                    seasonYear?: number | null
                    title: { romaji: string; english: string | null }
                    coverImage?: { large?: string }
                }[]
            }
        }
    }

    return (data.data?.Page?.media ?? []).map((media) => ({
        title: media.title.english ?? media.title.romaji,
        subtitle: [media.format, media.seasonYear].filter(Boolean).join(" · ") || undefined,
        cover: media.coverImage?.large,
        url: media.siteUrl,
    }))
}

async function lookupBook(q: string): Promise<LookupResult[]> {
    const url = new URL("https://openlibrary.org/search.json")
    url.searchParams.set("q", q)
    url.searchParams.set("limit", "8")
    url.searchParams.set("fields", "key,title,author_name,first_publish_year,cover_i")

    const data = (await fetchJson(url)) as {
        docs?: {
            key: string
            title: string
            author_name?: string[]
            first_publish_year?: number
            cover_i?: number
        }[]
    }

    return (data.docs ?? []).map((doc) => ({
        title: doc.title,
        subtitle:
            [doc.author_name?.[0], doc.first_publish_year].filter(Boolean).join(" · ") ||
            undefined,
        cover: doc.cover_i
            ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
            : undefined,
        url: `https://openlibrary.org${doc.key}`,
    }))
}

async function lookupTmdb(kind: "movie" | "tv", q: string): Promise<LookupResult[]> {
    const key = getSecret("TMDB_API_KEY")
    const url = new URL(`https://api.themoviedb.org/3/search/${kind}`)
    url.searchParams.set("query", q)
    url.searchParams.set("include_adult", "false")
    url.searchParams.set("language", "en-US")
    url.searchParams.set("page", "1")

    // Accepts either the short v3 API key or the long v4 read access token.
    const headers: Record<string, string> = {}
    if (key.length > 40) {
        headers.Authorization = `Bearer ${key}`
    } else {
        url.searchParams.set("api_key", key)
    }

    const data = (await fetchJson(url, headers)) as {
        results?: {
            id: number
            title?: string
            name?: string
            release_date?: string
            first_air_date?: string
            poster_path?: string | null
        }[]
    }

    return (data.results ?? []).slice(0, 8).map((result) => {
        const date = result.release_date ?? result.first_air_date

        return {
            title: result.title ?? result.name ?? "Untitled",
            subtitle: date ? date.slice(0, 4) : undefined,
            cover: result.poster_path
                ? `https://image.tmdb.org/t/p/w342${result.poster_path}`
                : undefined,
            url: `https://www.themoviedb.org/${kind}/${result.id}`,
        }
    })
}

async function lookupVideo(q: string): Promise<LookupResult[]> {
    let target: URL

    try {
        target = new URL(q)
    } catch {
        throw new LookupInputError("Paste a YouTube link")
    }

    if (target.protocol !== "https:" || !YOUTUBE_HOSTS.has(target.hostname)) {
        throw new LookupInputError("Paste a YouTube link")
    }

    const oembed = new URL("https://www.youtube.com/oembed")
    oembed.searchParams.set("url", target.toString())
    oembed.searchParams.set("format", "json")

    const data = (await fetchJson(oembed)) as {
        title?: string
        author_name?: string
        thumbnail_url?: string
    }

    return [
        {
            title: data.title ?? "Untitled video",
            subtitle: data.author_name,
            cover: data.thumbnail_url,
            url: target.toString(),
        },
    ]
}

const lookups = new Map<string, (q: string) => Promise<LookupResult[]>>([
    ["anime", lookupAnime],
    ["book", lookupBook],
    ["movie", (q) => lookupTmdb("movie", q)],
    ["show", (q) => lookupTmdb("tv", q)],
    ["video", lookupVideo],
])

/* ---------- Handler ---------- */

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader("Cache-Control", "no-store")

    if (req.method !== "GET" && !isSameOrigin(req)) {
        return res.status(403).json({ error: "Forbidden" })
    }

    try {
        if (req.method === "GET") {
            if (req.query.resource === "screenshot") {
                const id = typeof req.query.id === "string" ? req.query.id : ""

                if (!SCREENSHOT_ID.test(id)) {
                    return res.status(404).json({ error: "Not found" })
                }

                let result: Awaited<ReturnType<typeof get>> | null = null

                try {
                    result = await get(`${SCREENSHOT_PREFIX}${id}`, {
                        access: "private",
                        token: getSecret("BLOB_READ_WRITE_TOKEN"),
                    })
                } catch (error) {
                    if (error instanceof Error && error.name.includes("NotFound")) {
                        return res.status(404).json({ error: "Not found" })
                    }

                    throw error
                }

                if (!result || result.statusCode !== 200 || !result.stream) {
                    return res.status(404).json({ error: "Not found" })
                }

                const chunks: Uint8Array[] = []

                for await (const chunk of result.stream) {
                    chunks.push(chunk)
                }

                // File names are random and never reused, so the image can be cached for good.
                res.setHeader("Content-Type", "image/jpeg")
                res.setHeader("Cache-Control", "public, max-age=31536000, immutable")
                res.setHeader("X-Content-Type-Options", "nosniff")
                res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox")
                return res.status(200).send(Buffer.concat(chunks))
            }

            if (req.query.resource === "ranks") {
                const freshRanks = req.query.fresh === "1"

                if (freshRanks && !isAuthenticated(req)) {
                    return res.status(401).json({ error: "Admin login required" })
                }

                const ranks = await readRanks()

                if (!freshRanks) {
                    res.setHeader(
                        "Cache-Control",
                        "public, s-maxage=30, stale-while-revalidate=30"
                    )
                }

                return res.status(200).json(ranks)
            }

            if (req.query.resource === "lifts") {
                const freshLifts = req.query.fresh === "1"

                if (freshLifts && !isAuthenticated(req)) {
                    return res.status(401).json({ error: "Admin login required" })
                }

                const lifts = await readLifts()

                if (!freshLifts) {
                    res.setHeader(
                        "Cache-Control",
                        "public, s-maxage=30, stale-while-revalidate=30"
                    )
                }

                return res.status(200).json(lifts)
            }

            const source = typeof req.query.lookup === "string" ? req.query.lookup : null

            if (source) {
                if (!isAuthenticated(req)) {
                    return res.status(401).json({ error: "Admin login required" })
                }

                const run = lookups.get(source)
                const q = typeof req.query.q === "string" ? req.query.q.trim() : ""

                if (!run) return res.status(400).json({ error: "Unknown source" })
                if (!q || q.length > 200) {
                    return res.status(400).json({ error: "Enter something to search for" })
                }

                try {
                    return res.status(200).json({ results: await run(q) })
                } catch (error) {
                    if (error instanceof LookupInputError) {
                        return res.status(400).json({ error: error.message })
                    }

                    console.error("Content lookup error:", error)

                    const message =
                        error instanceof Error && error.message.endsWith("is not configured")
                            ? error.message
                            : "Search failed. Try again, or add the item manually."

                    return res.status(502).json({ error: message })
                }
            }

            // Admin editor reads fresh data so it can never save over newer changes.
            const fresh = req.query.fresh === "1"

            if (fresh && !isAuthenticated(req)) {
                return res.status(401).json({ error: "Admin login required" })
            }

            const content = await readContent()

            if (!fresh) {
                res.setHeader(
                    "Cache-Control",
                    "public, s-maxage=30, stale-while-revalidate=30"
                )
            }

            return res.status(200).json(content)
        }

        if (req.method === "POST") {
            if (req.query.resource !== "screenshot") {
                return res.status(405).json({ error: "Method not allowed" })
            }

            if (!isAuthenticated(req)) {
                return res.status(401).json({ error: "Admin login required" })
            }

            const declared = Number(req.headers["content-length"] ?? 0)

            if (declared > MAX_SCREENSHOT_BYTES) {
                return res.status(413).json({ error: "Image too large" })
            }

            const body = await readBody(req, MAX_SCREENSHOT_BYTES)

            if (!body) {
                return res.status(413).json({ error: "Image too large" })
            }

            if (!isJpeg(body)) {
                return res.status(400).json({ error: "Only JPEG images are accepted" })
            }

            // The server picks the name, so a request can never choose where a file is stored.
            const id = `${randomUUID()}.jpg`

            await put(`${SCREENSHOT_PREFIX}${id}`, body, {
                access: "private",
                addRandomSuffix: false,
                allowOverwrite: false,
                contentType: "image/jpeg",
                token: getSecret("BLOB_READ_WRITE_TOKEN"),
            })

            return res.status(200).json({ id })
        }

        if (req.method === "PUT") {
            if (!isAuthenticated(req)) {
                return res.status(401).json({ error: "Admin login required" })
            }

            if (req.query.resource === "ranks") {
                if (!isValidRanks(req.body)) {
                    return res.status(400).json({
                        error: "Invalid ranks data. Check names, ranks, dates and screenshots.",
                    })
                }

                const next = sanitizeRanks(req.body)
                const previous = await readRanks()

                await saveRanks(next)

                // Delete screenshots that are no longer used (best effort).
                const kept = new Set(next.ranks.map((entry) => entry.screenshot))
                const orphaned = previous.ranks
                    .map((entry) => entry.screenshot)
                    .filter((id): id is string => !!id && !kept.has(id))

                if (orphaned.length > 0) {
                    try {
                        await del(
                            orphaned.map((id) => `${SCREENSHOT_PREFIX}${id}`),
                            { token: getSecret("BLOB_READ_WRITE_TOKEN") }
                        )
                    } catch (error) {
                        console.error("Couldn't delete old screenshots:", error)
                    }
                }

                return res.status(200).json({ success: true })
            }

            if (req.query.resource === "lifts") {
                if (!isValidLifts(req.body)) {
                    return res.status(400).json({
                        error: "Invalid lifts data. Check names, weights, reps and dates.",
                    })
                }

                await saveLifts(sanitizeLifts(req.body))
                return res.status(200).json({ success: true })
            }

            if (!isValidContent(req.body)) {
                return res.status(400).json({
                    error: "Invalid content. Check item text lengths and that links start with https://.",
                })
            }

            await saveContent(sanitizeContent(req.body))
            return res.status(200).json({ success: true })
        }

        return res.status(405).json({ error: "Method not allowed" })
    } catch (error) {
        console.error("Content API error:", error)
        return res.status(500).json({ error: "Couldn't process content request" })
    }
}
