import Page from "../components/Page"
import GameCard from "../components/GameCard"
import GameCollection from "../components/GameCollection"
import {getSection, pageProps} from "../data/sections"
import {useRecentlyPlayedGames} from "../hooks/resources"

export default function GamesPage() {
    const {data: games, loading, error} = useRecentlyPlayedGames()

    return (
        <Page {...pageProps(getSection("/games"))}>
            <div className="games-widgets">
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
        </Page>
    )
}
