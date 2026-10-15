import type { SteamGame } from "../data/steam"

interface GameCardProps {
    game: SteamGame
}

export default function GameCard({ game }: GameCardProps) {
    const imageUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${game.appid}/header.jpg`

    const totalHours = Math.floor(game.playtime_forever / 60)
    const recentHours = Math.floor((game.playtime_2weeks ?? 0) / 60)

    return (
        <article className="game-card">
            <a
                className="game-card-image-link"
                href={`https://store.steampowered.com/app/${game.appid}/`}
                target="_blank"
                rel="noreferrer"
                aria-label={`View ${game.name} on Steam`}
            >
                <img
                    className="game-card-image"
                    src={imageUrl}
                    alt={`${game.name} cover`}
                    loading="lazy"
                />
            </a>

            <div className="game-card-content">
                <h2>{game.name}</h2>

                <div className="game-card-stats">
                    <span>{totalHours} hours total</span>
                    <span>{recentHours} hours in 2 weeks</span>
                </div>

                <a
                    className="game-card-link"
                    href={`https://store.steampowered.com/app/${game.appid}/`}
                    target="_blank"
                    rel="noreferrer"
                >
                    View on Steam <span>↗</span>
                </a>
            </div>
        </article>
    )
}
