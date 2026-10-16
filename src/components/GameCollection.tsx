import { useEffect, useState } from "react"
import type { SteamLibraryGame } from "../data/steamLibrary"
import { getGameCollections } from "../data/gameCollections"

interface GameCollectionProps {
    title: string
    description: string
    collection: "liked" | "wantToPlay"
}

export default function GameCollection({
                                           title,
                                           description,
                                           collection,
                                       }: GameCollectionProps) {
    const [games, setGames] = useState<SteamLibraryGame[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false

        async function loadGames() {
            setLoading(true)

            try {
                const [collections, response] = await Promise.all([
                    getGameCollections(),
                    fetch("/api/steam?type=library"),
                ])

                if (!response.ok) {
                    throw new Error("Couldn't load Steam library.")
                }

                const data = await response.json()
                const library: SteamLibraryGame[] = data.games ?? []
                const selectedIds = collections[collection]

                const selectedGames = selectedIds
                    .map((id) =>
                        library.find((game) => game.appid === id)
                    )
                    .filter(
                        (game): game is SteamLibraryGame =>
                            game !== undefined
                    )

                if (!cancelled) {
                    setGames(selectedGames)
                }
            } catch (error) {
                console.error("Couldn't load game collection:", error)
            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
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
                    <span className="window-label">MY COLLECTION</span>
                    <h2>{title}</h2>
                    <p>{description}</p>
                </div>
            </div>

            {loading ? (
                <p className="game-collection-empty">
                    Loading collection...
                </p>
            ) : games.length > 0 ? (
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