import type { VercelRequest, VercelResponse } from "@vercel/node"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const STEAM_ID = "76561198047552050"

// Edge-cache lifetimes: the library rarely changes, recently played changes often.
const CACHE_CONTROL = {
    library: "public, s-maxage=3600, stale-while-revalidate=86400",
    recent: "public, s-maxage=300, stale-while-revalidate=600",
} as const

// Also kept in memory, so repeated requests (even with random query strings) can't drain the Steam quota.
const MEMORY_TTL_MS = { library: 60 * 60 * 1000, recent: 5 * 60 * 1000 } as const
const memory = new Map<string, { at: number; data: unknown }>()

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    // Default for every response; only a successful Steam response overrides it below.
    res.setHeader("Cache-Control", "no-store")

    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" })
    }

    const apiKey = process.env.STEAM_API_KEY

    if (!apiKey) {
        return res.status(500).json({
            error: "Steam API key is not configured",
        })
    }

    const type = req.query.type === "library" ? "library" : "recent"

    const cached = memory.get(type)

    if (cached && Date.now() - cached.at < MEMORY_TTL_MS[type]) {
        res.setHeader("Cache-Control", CACHE_CONTROL[type])
        return res.status(200).json(cached.data)
    }

    try {
        const endpoint =
            type === "library"
                ? "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/"
                : "https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/"

        const url = new URL(endpoint)

        url.searchParams.set("key", apiKey)
        url.searchParams.set("steamid", STEAM_ID)

        if (type === "recent") {
            url.searchParams.set("count", "10")
        } else {
            url.searchParams.set("include_appinfo", "true")
            url.searchParams.set("include_played_free_games", "true")
        }

        const response = await fetch(url)

        if (!response.ok) {
            return res.status(502).json({
                error: "Steam API request failed",
            })
        }

        const data = await response.json()

        memory.set(type, { at: Date.now(), data: data.response })
        res.setHeader("Cache-Control", CACHE_CONTROL[type])
        return res.status(200).json(data.response)
    } catch {
        return res.status(502).json({
            error: "Could not retrieve Steam data",
        })
    }
}
