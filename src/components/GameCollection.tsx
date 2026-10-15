
import { useEffect, useState } from "react"
import type { SteamGame } from "../data/steam"
import type { SteamLibraryGame } from "../data/steamLibrary"

interface GameCollectionProps {
    title: string
    description: string
    collection: "liked" | "favorites"
    onEdit: () => void
}

const STORAGE_KEY = "personal-dashboard-game-collections"

export default function GameCollection({
                                           title,
                                           description,
                                           collection,
                                           onEdit,
                                       }: GameCollectionProps) {
    const [games, setGames] = useState<SteamLibraryGame[]>([])

    useEffect(() => {
        let cancelled = false

        async function loadGames() {
            try {
                const response = await fetch("/api/steam?type=library")
                if (!response.ok) return

                const data = await response.json()
                const library: SteamLibraryGame[] = data.games ?? []

                const saved = localStorage.getItem(STORAGE_KEY)
                const collections = saved
                    ? JSON.parse(saved)
                    : { liked: [], favorites: [] }

                const selectedIds: number[] = collections[collection] ?? []
                const selectedGames = selectedIds
                    .map((id) => library.find((game) => game.appid === id))
                    .filter(
                        (game): game is SteamLibraryGame => game !== undefined
                    )

                if (!cancelled) setGames(selectedGames)
            } catch (error) {
                console.error("Couldn't load game collection:", error)
            }
        }

        void loadGames()
        return () => {
            cancelled = true
        }
    }, [collection])

    return (
        <section className="game-collection">
            <div className="game-collection-header">
                <div>
                    <span className="window-label">YOUR COLLECTION</span>
                    <h2>{title}</h2>
                    <p>{description}</p>
                </div>

                <button className="game-collection-edit" onClick={onEdit}>
                    Edit <span>↗</span>
                </button>
            </div>

            {games.length > 0 ? (
                <div className="game-cover-grid">
                    {games.map((game) => (
                        <a
                            className="game-cover"
                            key={game.appid}
                            href={`https://store.steampowered.com/app/${game.appid}/`}
                            target="_blank"
                            rel="noreferrer"
                            title={game.name}
                        >
                            <img
                                src={`https://cdn.akamai.steamstatic.com/steam/apps/${game.appid}/header.jpg`}
                                alt={game.name}
                                loading="lazy"
                            />
                            <span>{game.name}</span>
                        </a>
                    ))}
                </div>
            ) : (
                <p className="game-collection-empty">
                    No games selected yet. Use Edit to add some.
                </p>
            )}
        </section>
    )
}
