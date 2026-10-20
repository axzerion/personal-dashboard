import {Link, NavLink, Outlet} from "react-router-dom"
import {sections} from "../data/sections"
import {useRecentlyPlayedGames} from "../hooks/resources"

const externalLinks = [
    {label: "GitHub", href: "https://github.com/axzerion"},
    {label: "Steam", href: "https://steamcommunity.com/id/hahayesnt/"},
]

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

                    <div className="topbar-right">
                        <nav className="nav nav-main" aria-label="Main navigation">
                            <NavLink to="/" end>Home</NavLink>
                            {sections.map((section) => (
                                <NavLink key={section.path} to={section.path}>
                                    {section.label}
                                </NavLink>
                            ))}
                        </nav>

                        <span className="nav-divider" aria-hidden="true"/>

                        <nav className="nav nav-external" aria-label="External links">
                            {externalLinks.map((link) => (
                                <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
                                    {link.label} ↗
                                </a>
                            ))}
                        </nav>
                    </div>
                </header>

                <Outlet/>
            </div>
        </div>
    )
}
