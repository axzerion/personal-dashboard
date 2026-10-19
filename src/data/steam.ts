export interface SteamGame {
    appid: number
    name: string
    playtime_2weeks?: number
    playtime_forever: number
    img_icon_url?: string
}

export interface SteamRecentlyPlayedResponse {
    total_count: number
    games: SteamGame[]
}

export async function getRecentlyPlayedGames(): Promise<SteamRecentlyPlayedResponse> {
    const response = await fetch("/api/steam")

    if (!response.ok) {
        throw new Error(`Steam API request failed: ${response.status}`)
    }

    return response.json()
}