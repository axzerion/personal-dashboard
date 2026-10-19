
export interface GameCollections {
    liked: number[]
    wantToPlay: number[]
}

export const emptyGameCollections: GameCollections = {
    liked: [],
    wantToPlay: [],
}

export async function getGameCollections(): Promise<GameCollections> {
    const response = await fetch("/api/game-collections")

    if (!response.ok) {
        throw new Error("Couldn't load game collections.")
    }

    return response.json()
}

export async function checkAdminSession(): Promise<boolean> {
    const response = await fetch("/api/game-collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check-session" }),
    })

    if (!response.ok) {
        throw new Error("Couldn't verify admin session.")
    }

    const data: { authenticated: boolean } = await response.json()
    return data.authenticated
}

export async function loginAdmin(password: string): Promise<void> {
    const response = await fetch("/api/game-collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", password }),
    })

    if (!response.ok) {
        throw new Error(
            response.status === 401
                ? "Incorrect password."
                : "Couldn't log in."
        )
    }
}

export async function logoutAdmin(): Promise<void> {
    const response = await fetch("/api/game-collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
    })

    if (!response.ok) {
        throw new Error("Couldn't log out.")
    }
}

export async function saveGameCollections(
    collections: GameCollections
): Promise<void> {
    const response = await fetch("/api/game-collections", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(collections),
    })

    if (response.status === 401) {
        throw new Error("Your admin session has expired. Please log in again.")
    }

    if (!response.ok) {
        throw new Error("Couldn't save game collections.")
    }
}

export interface CollectionGame {
    appid: number
    name: string
}

export interface ResolvedGameCollections {
    liked: CollectionGame[]
    wantToPlay: CollectionGame[]
}

export async function getCollectionGames(): Promise<ResolvedGameCollections> {
    const response = await fetch("/api/game-collections?resolve=1")

    if (!response.ok) {
        throw new Error("Couldn’t load game collections.")
    }

    return response.json()
}