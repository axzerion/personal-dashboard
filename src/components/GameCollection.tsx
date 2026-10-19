import {useCollectionGames} from "../hooks/resources"
import {steamHeaderUrl} from "../data/steamUtils"

interface GameCollectionProps {
    title: string
    description?: string
    collection: "liked" | "wantToPlay"
}

export default function GameCollection({
                                           title,
                                           description,
                                           collection,
                                       }: GameCollectionProps) {
    const {data, loading, error} = useCollectionGames()
    const games = data?.[collection] ?? []

    return (
        <section className="game-collection">
            <div className="game-collection-header">
                <div>
                    <span className="window-label">MY COLLECTION</span>
                    <h2>{title}</h2>
                    {description && <p>{description}</p>}
                </div>
            </div>

            {loading ? (
                <p className="game-collection-empty">Loading collection…</p>
            ) : error ? (
                <p className="state state-error" role="alert">{error}</p>
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
                                src={steamHeaderUrl(game.appid)}
                                alt={game.name}
                                loading="lazy"
                            />
                            <span>{game.name}</span>
                        </a>
                    ))}
                </div>
            ) : (
                <p className="game-collection-empty">Nothing here yet.</p>
            )}
        </section>
    )
}
