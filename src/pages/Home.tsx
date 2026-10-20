import {useEffect} from "react"
import {Link} from "react-router-dom"
import {motion} from "framer-motion"
import {sections} from "../data/sections"
import {formatPlaytime, steamHeaderUrl} from "../data/steamUtils"
import {useRecentlyPlayedGames} from "../hooks/resources"
import type {SteamGame} from "../data/steam"

const ease = [0.23, 1, 0.32, 1] as const

const stagger = {hidden: {}, show: {transition: {staggerChildren: 0.06}}}
const rise = {
    hidden: {opacity: 0, y: 10},
    show: {opacity: 1, y: 0, transition: {duration: 0.4, ease}},
}

function RecentTile({game}: { game: SteamGame }) {
    return (
        <Link className="tile" to="/games">
            <img className="tile-cover" src={steamHeaderUrl(game.appid)} alt=""/>
            <div className="tile-body">
                <span className="label">Recently played</span>
                <h2>{game.name}</h2>
                <p>
                    {formatPlaytime(game.playtime_2weeks ?? 0)} in the last 2 weeks ·{" "}
                    {formatPlaytime(game.playtime_forever)} total
                </p>
            </div>
        </Link>
    )
}

export default function Home() {
    useEffect(() => {
        document.title = "Personal Space"
    }, [])

    const {data: games, loading} = useRecentlyPlayedGames()
    const recent = games?.[0]
    const covers = games?.slice(0, 3) ?? []

    return (
        <motion.div className="home-grid" variants={stagger} initial="hidden" animate="show">
            <motion.div
                className={recent || loading ? "hero" : "hero hero-wide"}
                variants={rise}
            >
                <h1>Welcome.</h1>
                <p>
                    This is a personal corner for my software projects, games, and things I find
                    useful or interesting.
                </p>
            </motion.div>

            {loading && (
                <div className="span-5" aria-hidden="true">
                    <div className="tile tile-skeleton"/>
                </div>
            )}

            {recent && (
                <motion.div className="span-5" variants={rise}>
                    <RecentTile game={recent}/>
                </motion.div>
            )}

            {sections.map((section, index) => (
                <motion.div
                    key={section.path}
                    className={index === 0 || index === 3 ? "span-7" : "span-5"}
                    variants={rise}
                >
                    <Link className="card" to={section.path}>
                        <div>
                            <span className="label">
                                {section.number} · {section.label}
                            </span>
                            <h2>{section.heading}</h2>
                            <p>{section.summary}</p>

                            {section.path === "/games" && covers.length > 0 && (
                                <div className="cover-strip" aria-hidden="true">
                                    {covers.map((game) => (
                                        <img
                                            key={game.appid}
                                            src={steamHeaderUrl(game.appid)}
                                            alt=""
                                            loading="lazy"
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        <span className="card-link">
                            Explore {section.label.toLowerCase()} <span className="arrow">→</span>
                        </span>
                    </Link>
                </motion.div>
            ))}
        </motion.div>
    )
}
