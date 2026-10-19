import {useEffect, useMemo, useRef, useState} from "react"
import {getSteamLibrary} from "../data/steamLibrary"
import type {SteamLibraryGame} from "../data/steamLibrary"
import {
    emptyGameCollections,
    getGameCollections,
    saveGameCollections,
} from "../data/gameCollections"
import type {GameCollections} from "../data/gameCollections"
import { invalidateCollectionGames } from "../hooks/resources"

type Collection = "liked" | "wantToPlay"

export default function GameLibraryPicker() {
    const [library, setLibrary] = useState<SteamLibraryGame[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState("")
    const [collection, setCollection] = useState<Collection>("liked")
    const [collections, setCollections] =
        useState<GameCollections>(emptyGameCollections)
    const [saveStatus, setSaveStatus] = useState("All changes saved")

    const pendingRef = useRef<GameCollections | null>(null)
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const savingRef = useRef(false)

    const selected = collections[collection]

    useEffect(() => {
        let cancelled = false

        async function loadData() {
            try {
                const [libraryData, savedCollections] = await Promise.all([
                    getSteamLibrary(),
                    getGameCollections(),
                ])

                if (!cancelled) {
                    setLibrary(libraryData.games ?? [])
                    setCollections(savedCollections)
                }
            } catch (err) {
                if (!cancelled) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Couldn't load the game data."
                    )
                }
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        void loadData()

        return () => {
            cancelled = true
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current)
            }
        }
    }, [])

    const filteredGames = useMemo(
        () =>
            [...library]
                .filter((game) =>
                    game.name.toLowerCase().includes(search.toLowerCase())
                )
                .sort((a, b) => {
                    const aSelected = selected.includes(a.appid)
                    const bSelected = selected.includes(b.appid)

                    if (aSelected !== bSelected) {
                        return aSelected ? -1 : 1
                    }

                    return a.name.localeCompare(b.name)
                }),
        [library, search, selected]
    )


    async function flushSave() {
        if (savingRef.current || !pendingRef.current) return

        const snapshot = pendingRef.current
        pendingRef.current = null
        savingRef.current = true
        setSaving(true)

        try {
            await saveGameCollections(snapshot)
            invalidateCollectionGames()
            setSaveStatus("All changes saved")
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Couldn't save the game collection."
            )
            setSaveStatus("Save failed")
        } finally {
            savingRef.current = false
            setSaving(false)

            if (pendingRef.current) {
                void flushSave()
            }
        }
    }

    function queueSave(updated: GameCollections) {
        pendingRef.current = updated
        setSaveStatus("Unsaved changes")

        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current)
        }

        saveTimerRef.current = setTimeout(() => {
            void flushSave()
        }, 500)
    }

    function toggleGame(appid: number) {
        const currentIds = collections[collection]
        const alreadySelected = currentIds.includes(appid)

        if (
            !alreadySelected &&
            collection === "liked" &&
            currentIds.length >= 20
        ) {
            setError("Games I Like is limited to 20 games.")
            return
        }

        if (
            !alreadySelected &&
            collection === "wantToPlay" &&
            currentIds.length >= 100
        ) {
            setError("Want to Play is limited to 100 games.")
            return
        }

        const updatedCollections: GameCollections = {
            ...collections,
            [collection]: alreadySelected
                ? currentIds.filter((id) => id !== appid)
                : [...currentIds, appid],
        }

        setCollections(updatedCollections)
        setError(null)
        queueSave(updatedCollections)
    }

    if (loading) {
        return (
            <section className="game-library-picker">
                <p>Loading your game library...</p>
            </section>
        )
    }

    return (
        <section className="game-library-picker">
            <header className="picker-header">
                <div>
                    <span className="window-label">LIBRARY MANAGEMENT</span>
                    <h2>Manage game collections</h2>
                    <p>
                        Choose which games appear on your public profile.
                    </p>
                </div>

                <span
                    className={`picker-save-status ${saving ? "saving" : ""}`}
                    role="status"
                >
                    <span className="picker-status-dot"/>
                    {saving ? "Saving..." : saveStatus}
                </span>
            </header>

            <div className="picker-collection-summary">
                <button
                    type="button"
                    className={`picker-collection-card ${collection === "liked" ? "active" : ""}`}
                    onClick={() => setCollection("liked")}
                >
                    <span className="picker-card-label">GAMES I LIKE</span>
                    <strong>{collections.liked.length}<span> / 20</span></strong>
                    <span className="picker-card-description">
                        Your favourite games
                    </span>
                </button>

                <button
                    type="button"
                    className={`picker-collection-card ${collection === "wantToPlay" ? "active" : ""}`}
                    onClick={() => setCollection("wantToPlay")}
                >
                    <span className="picker-card-label">WANT TO PLAY</span>
                    <strong>{collections.wantToPlay.length}<span> / 100</span></strong>
                    <span className="picker-card-description">
                        Games on your backlog
                    </span>
                </button>
            </div>

            <div className="picker-library-header">
                <div>
                    <h3>
                        {collection === "liked" ? "Games I Like" : "Want to Play"}
                    </h3>
                    <p>
                        {selected.length} selected · {library.length} games in library
                    </p>
                </div>

                <input
                    className="picker-search"
                    type="search"
                    placeholder="Search games..."
                    aria-label="Search Steam library"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />
            </div>

            {error && (
                <p className="picker-error" role="alert">
                    {error}
                </p>
            )}

            <div className="game-library-list">
                {filteredGames.map((game) => {
                    const isSelected = selected.includes(game.appid)

                    return (
                        <button
                            key={game.appid}
                            type="button"
                            className={`game-library-item ${isSelected ? "selected" : ""}`}
                            onClick={() => toggleGame(game.appid)}
                        >
                            <img
                                className="picker-game-cover"
                                src={`https://cdn.akamai.steamstatic.com/steam/apps/${game.appid}/header.jpg`}
                                alt=""
                                loading="lazy"
                            />

                            <span className="picker-game-name">{game.name}</span>

                            <span className="picker-game-action">
                                {isSelected ? "Selected ✓" : "+ Add"}
                            </span>
                        </button>
                    )
                })}
            </div>

            {filteredGames.length === 0 && (
                <p className="picker-empty">
                    No games match your search.
                </p>
            )}
        </section>
    )
}
