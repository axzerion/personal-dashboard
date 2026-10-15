
import type { VercelRequest, VercelResponse } from "@vercel/node"

const STEAM_ID = "76561198047552050"

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" })
    }

    const apiKey = process.env.STEAM_API_KEY

    if (!apiKey) {
        return res.status(500).json({ error: "Steam API key is not configured" })
    }

    try {
        const url = new URL(
            "https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/"
        )

        url.searchParams.set("key", apiKey)
        url.searchParams.set("steamid", STEAM_ID)
        url.searchParams.set("count", "10")

        const response = await fetch(url)

        if (!response.ok) {
            return res.status(502).json({ error: "Steam API request failed" })
        }

        const data = await response.json()

        return res.status(200).json(data.response)
    } catch {
        return res.status(502).json({ error: "Could not retrieve Steam data" })
    }
}
