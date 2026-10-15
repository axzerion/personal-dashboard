
import { useEffect, useMemo, useState } from "react"
import { getSteamLibrary } from "../data/steamLibrary"
import type { SteamLibraryGame } from "../data/steamLibrary"

type Collection = "liked" | "favorites"

const STORAGE_KEY = "personal-dashboard-game-collections"

interface SavedCollections {
    liked: number[]
    favorites: number[]
}

const emptyCollections: SavedCollections = {
    liked: [],
    favorites: [],
}

function loadCollections(): SavedCollections {
    try {
        const saved = localStorage.getItem(STORAGE_KEY)
        return saved ? { ...emptyCollections, ...JSON.parse(saved) } : emptyCollections
    } catch {
        return emptyCollections
    }
}

export default function GameLibraryPicker() {
    const [library, setLibrary] = useState<SteamLibraryGame[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState("")
    const [collection, setCollection] = useState<Collection>("liked")
    const [collections, setCollections] = useState<SavedCollections>(loadCollections)

    useEffect(() => {
        let cancelled = false

        async function loadLibrary() {
            try {
                const data = await getSteamLibrary()
                if (!cancelled) setLibrary(data.games ?? [])
            } catch (error) {
                if (!cancelled) {
                    setError(
                        error instanceof Error
                            ? error.message
                            : "Couldn't load your Steam library."
                    )
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        void loadLibrary()
        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(collections))
    }, [collections])

    const selected = collections[collection]

    const filteredGames = useMemo(() => {
        return [...library]
            .filter((game) =>
                game.name.toLowerCase().includes(search.toLowerCase())
            )
            .sort((a, b) => a.name.localeCompare(b.name))
    }, [library, search])

    function toggleGame(appid: number) {
        setCollections((current) => {
            const currentIds = current[collection]
            const alreadySelected = currentIds.includes(appid)

            if (alreadySelected) {
                return {
                    ...current,
                    [collection]: currentIds.filter((id) => id !== appid),
                }
            }

            if (collection === "liked" && currentIds.length >= 20) {
                return current
            }

            return {
                ...current,
                [collection]: [...currentIds, appid],
            }
        })
    }

    return (
        <section className="game-library-picker">
            <div className="game-picker-header">
                <div>
                    <span className="window-label">MY COLLECTION</span>
                    <h2>Choose your games</h2>
                </div>
                <span className="game-picker-count">
                    {selected.length}
                    {collection === "liked" ? " / 20" : " selected"}
                </span>
            </div>

            <div className="game-picker-tabs">
                <button
                    className={collection === "liked" ? "active" : ""}
                    onClick={() => setCollection("liked")}
                >
                    Games I Like
                </button>
                <button
                    className={collection === "favorites" ? "active" : ""}
                    onClick={() => setCollection("favorites")}
                >
                    Want to Play
                </button>
            </div>

            <input
                className="game-picker-search"
                type="search"
                placeholder="Search your Steam library..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
            />

            {loading && <p>Loading your Steam library...</p>}
            {error && <p role="alert">{error}</p>}

            {!loading && !error && (
                <div className="game-picker-list">
                    {filteredGames.map((game) => {
                        const isSelected = selected.includes(game.appid)
                        const limitReached =
                            collection === "liked" &&
                            selected.length >= 20 &&
                            !isSelected

                        return (
                            <label
                                className={`game-picker-item ${isSelected ? "selected" : ""}`}
                                key={game.appid}
                            >
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    disabled={limitReached}
                                    onChange={() => toggleGame(game.appid)}
                                />
                                <span>{game.name}</span>
                            </label>
                        )
                    })}

                    {filteredGames.length === 0 && (
                        <p>No games match your search.</p>
                    )}
                </div>
            )}
        </section>
    )
}
