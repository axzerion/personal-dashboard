import type { VercelRequest, VercelResponse } from "@vercel/node"
import { get, put } from "@vercel/blob"
import { createHmac, timingSafeEqual } from "node:crypto"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const COOKIE_NAME = "dashboard_admin_session"
const BLOB_PATH = "content.json"
const USER_AGENT = "personal-space/1.0 (personal website)"
const STATUSES = ["favorite", "current", "want", "done"] as const
const KEY_PATTERN = /^[a-z0-9-]{1,40}$/
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

function sign(value: string): string {
    return createHmac("sha256", getSecret("SESSION_SECRET"))
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

    try {
        if (req.method === "GET") {
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

        if (req.method === "PUT") {
            if (!isAuthenticated(req)) {
                return res.status(401).json({ error: "Admin login required" })
            }

            if (req.query.resource === "lifts") {
                if (!isValidLifts(req.body)) {
                    return res.status(400).json({
                        error: "Invalid lifts data. Check names, weights, reps and dates.",
                    })
                }

                await saveLifts(req.body)
                return res.status(200).json({ success: true })
            }

            if (!isValidContent(req.body)) {
                return res.status(400).json({
                    error: "Invalid content. Check item text lengths and that links start with https://.",
                })
            }

            await saveContent(req.body)
            return res.status(200).json({ success: true })
        }

        return res.status(405).json({ error: "Method not allowed" })
    } catch (error) {
        console.error("Content API error:", error)
        return res.status(500).json({ error: "Couldn't process content request" })
    }
}
