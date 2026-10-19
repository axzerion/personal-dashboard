import {Link, NavLink, Outlet} from "react-router-dom"
import {sections} from "../data/sections"
import {useRecentlyPlayedGames} from "../hooks/resources"

export default function Layout() {
    const {data: games} = useRecentlyPlayedGames()
    const latest = games?.[0]

    return (
        <div className="shell">
            <div className="container">
                <header className="topbar">
                    <Link className="brand" to="/">PATRICKs PERSONAL SPACE</Link>

                    {latest && (
                        <Link className="live-pill" to="/games">
                            <span className="live-dot" aria-hidden="true"/>
                            <span className="live-name">Recently played · {latest.name}</span>
                        </Link>
                    )}

                    <nav className="nav" aria-label="Main navigation">
                        <NavLink to="/" end>Home</NavLink>
                        {sections.map((section) => (
                            <NavLink key={section.path} to={section.path}>
                                {section.label}
                            </NavLink>
                        ))}

                        <span className="nav-divider" aria-hidden="true"/>

                        <a href="https://github.com/axzerion" target="_blank" rel="noreferrer">
                            GitHub ↗
                        </a>
                        <a href="https://steamcommunity.com/id/hahayesnt/" target="_blank" rel="noreferrer">
                            Steam ↗
                        </a>
                    </nav>
                </header>

                <Outlet/>
            </div>
        </div>
    )
}
