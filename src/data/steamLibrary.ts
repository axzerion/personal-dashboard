
import type { SteamGame } from "./steam"

export interface SteamLibraryGame extends SteamGame {
    img_logo_url?: string
}

export interface SteamLibraryResponse {
    game_count: number
    games: SteamLibraryGame[]
}

export async function getSteamLibrary(): Promise<SteamLibraryResponse> {
    const response = await fetch("/api/steam?type=library")

    if (!response.ok) {
        throw new Error(`Steam library request failed: ${response.status}`)
    }

    return response.json()
}
