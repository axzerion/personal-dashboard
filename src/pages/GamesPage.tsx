import {useState} from "react"
import GameCard from "../components/GameCard"
import GameCollection from "../components/GameCollection"
import MediaLightbox from "../components/MediaLightbox"
import Page from "../components/Page"
import RankCards from "../components/RankCards"
import type {MediaView} from "../data/media"
import {getSection, pageProps} from "../data/sections"
import {useRanks, useRecentlyPlayedGames} from "../hooks/resources"
import "../content.css"

export default function GamesPage() {
    const {data: games, loading, error} = useRecentlyPlayedGames()
    const {data: ranks} = useRanks()
    const [media, setMedia] = useState<MediaView | null>(null)

    return (
        <Page {...pageProps(getSection("/games"))}>
            <div className="games-widgets">
                {ranks && ranks.ranks.length > 0 && (
                    <section className="game-ranks">
                        <h2>Competitive ranks</h2>
                        <RankCards ranks={ranks.ranks} onOpen={setMedia}/>
                    </section>
                )}

                <GameCollection title="Games I Like" collection="liked" description=""/>
                <GameCollection title="Want to Play" collection="wantToPlay" description=""/>

                <section className="game-stats-widget">
                    <h2>Recently Played</h2>
                    {loading && <p className="state">Loading games from Steam…</p>}
                    {error && <p className="state state-error" role="alert">{error}</p>}
                    {games?.length === 0 && <p className="state">Nothing played recently.</p>}

                    {games && games.length > 0 && (
                        <div className="games-list">
                            {games.map((game) => (
                                <GameCard key={game.appid} game={game}/>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            <MediaLightbox media={media} onClose={() => setMedia(null)}/>
        </Page>
    )
}
