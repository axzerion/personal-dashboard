import {useEffect, useState} from "react"
import {
    BrowserRouter,
    Routes,
    Route,
    useLocation,
    useNavigate,
} from "react-router-dom"
import {motion} from "framer-motion"
import {getGitHubProjects} from "./data/github"
import type {GitHubProject} from "./data/github"
import ProjectCard from "./components/ProjectCard"
import {getRecentlyPlayedGames} from "./data/steam"
import type {SteamGame} from "./data/steam"
import GameCard from "./components/GameCard"
import GameLibraryPicker from "./components/GameLibraryPicker"
import GameCollection from "./components/GameCollection"
import AdminPage from "./components/AdminPage"

const sections = [
    {
        path: "/projects",
        number: "01",
        label: "Projects",
        description: "Things I've played around with, or am working on.",
        previewTitle: "What I'm building",
        previewDescription: "Software projects, experiments, and things I've made.",
    },
    {
        path: "/games",
        number: "02",
        label: "Games",
        description: "What I'm playing.",
        previewTitle: "Games",
        previewDescription: "Games I enjoy and what I've been playing lately.",
    },
    {
        path: "/interests",
        number: "03",
        label: "Interests",
        description: "Other stuff",
        previewTitle: "Interests",
        previewDescription: "Other interesting stuff",
    },
    {
        path: "/resources",
        number: "04",
        label: "Resources",
        description: "Useful things worth keeping.",
        previewTitle: "Useful things",
        previewDescription: "Tools, links, and resources worth keeping around.",
    },
]

function Dashboard() {
    const {pathname: activePath} = useLocation()
    const navigate = useNavigate()
    const isHome = activePath === "/"
    const activeSection = sections.find((section) => section.path === activePath)

    const [projects, setProjects] = useState<GitHubProject[]>([])
    const [projectsLoading, setProjectsLoading] = useState(false)
    const [projectsError, setProjectsError] = useState<string | null>(null)

    const [games, setGames] = useState<SteamGame[]>([])
    const [gamesLoading, setGamesLoading] = useState(false)
    const [gamesError, setGamesError] = useState<string | null>(null)
    const [editingCollection, setEditingCollection] = useState(false)

    useEffect(() => {
        if (activePath !== "/projects") return

        let cancelled = false

        async function loadProjects() {
            setProjectsLoading(true)
            setProjectsError(null)

            try {
                const data = await getGitHubProjects()
                if (!cancelled) setProjects(data)
            } catch (error: unknown) {
                console.error("GitHub project loading failed:", error)
                if (!cancelled) {
                    setProjectsError("Couldn't load projects from GitHub. Please try again.")
                }
            } finally {
                if (!cancelled) setProjectsLoading(false)
            }
        }

        void loadProjects()
        return () => {
            cancelled = true
        }
    }, [activePath])

    useEffect(() => {
        if (activePath !== "/games") return

        let cancelled = false

        async function loadGames() {
            setGamesLoading(true)
            setGamesError(null)

            try {
                const data = await getRecentlyPlayedGames()
                if (!cancelled) setGames(data.games ?? [])
            } catch (error: unknown) {
                console.error("Steam game loading failed:", error)
                if (!cancelled) {
                    setGamesError(error instanceof Error ? error.message : String(error))
                }
            } finally {
                if (!cancelled) setGamesLoading(false)
            }
        }

        void loadGames()
        return () => {
            cancelled = true
        }
    }, [activePath])

    return (
        <main className="dashboard">
            <header className="topbar">
                <button className="brand" onClick={() => navigate("/")}>
                    PERSONAL SPACE
                </button>

                <div className="topbar-right">
                    <nav className="topbar-navigation" aria-label="Main navigation">
                        <button onClick={() => navigate("/")}>Home</button>
                        {sections.map((section) => (
                            <button
                                key={section.path}
                                onClick={() => navigate(section.path)}
                            >
                                {section.label}
                            </button>
                        ))}
                        <button onClick={() => navigate("/admin")}>Admin</button>

                        <span className="topbar-divider" aria-hidden="true" />

                        {/* Replace these URLs with your own account links. */}
                        <a
                            href="https://github.com/axzerion"
                            target="_blank"
                            rel="noreferrer"
                        >
                            GitHub ↗
                        </a>
                        <a
                            href="https://steamcommunity.com/id/hahayesnt/"
                            target="_blank"
                            rel="noreferrer"
                        >
                            Steam ↗
                        </a>
                    </nav>

                    <div className="status">
                        <span className="status-dot" />
                        {isHome ? "HOME" : activeSection?.label.toUpperCase() ?? "ADMIN"}
                    </div>
                </div>
            </header>

            {!isHome && (
                <nav className="section-navigation" aria-label="Main sections">
                    {sections.map((section) => {
                        const active = section.path === activePath

                        return (
                            <button
                                key={section.path}
                                className={`section-nav-window ${active ? "section-nav-window-active" : ""}`}
                                onClick={() => navigate(section.path)}
                                aria-current={active ? "page" : undefined}
                            >
                                <span className="window-number">{section.number}</span>
                                <span className="window-label">{section.label.toUpperCase()}</span>
                                <h2>{section.label}</h2>
                            </button>
                        )
                    })}
                </nav>
            )}

            {isHome ? (
                <section className="dashboard-grid">
                    <motion.div
                        className="window home-intro"
                        whileHover={{ y: -2 }}
                        transition={{ duration: 0.2 }}
                    >
                        <span className="window-number">PERSONAL SPACE</span>
                        <div>
                            <span className="window-label"></span>
                            <h2>Welcome.</h2>
                            <p>
                                This is a personal corner for my software projects, games, and things I find useful or interesting.
                            </p>
                        </div>
                    </motion.div>

                    {sections.map((section) => (
                        <motion.button
                            key={section.path}
                            className={`window window-${section.label.toLowerCase()}`}
                            onClick={() => navigate(section.path)}
                            whileHover={{ y: -2 }}
                            transition={{ duration: 0.2 }}
                        >
                            <span className="window-number">{section.number}</span>
                            <div>
                                <span className="window-label">{section.label.toUpperCase()}</span>
                                <h2>{section.previewTitle}</h2>
                                <p>{section.previewDescription}</p>
                            </div>
                            <span className="home-card-link">
                                Explore {section.label.toLowerCase()} <span>↗</span>
                            </span>
                        </motion.button>
                    ))}
                </section>

            ) : activeSection ? (
                <motion.section
                    key={activeSection.path}
                    className="section-page"
                    initial={{opacity: 0, y: 8}}
                    animate={{opacity: 1, y: 0}}
                    transition={{duration: 0.25}}
                >
                    <span className="window-label">
                        {activeSection.number} / {activeSection.label.toUpperCase()}
                    </span>
                    <h1>{activeSection.label}.</h1>
                    <p>{activeSection.description}</p>

                    {activePath === "/projects" && (
                        <div className="projects-list">
                            {projectsLoading && <p>Loading projects from GitHub...</p>}
                            {projectsError && <p role="alert">{projectsError}</p>}
                            {!projectsLoading && !projectsError && projects.map((project) => (
                                <ProjectCard key={project.html_url} project={project} />
                            ))}
                        </div>
                    )}

                    {activePath === "/games" && (
                        <div className="games-widgets">
                            {!editingCollection ? (
                                <>
                                    <GameCollection
                                        title="Games I Like"
                                        collection="liked"
                                        description={""}                                    />
                                    <GameCollection
                                        title="Want to Play"
                                        collection="wantToPlay"
                                        description={""}                                    />
                                    <div className="game-stats-widget">
                                        <h2>Recently Played</h2>
                                        <div className="games-list">
                                            {gamesLoading && <p>Loading games from Steam...</p>}
                                            {gamesError && <p role="alert">{gamesError}</p>}
                                            {!gamesLoading && !gamesError && games.map((game) => (
                                                <GameCard key={game.appid} game={game} />
                                            ))}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <button
                                        className="game-collection-edit"
                                        onClick={() => setEditingCollection(false)}
                                    >
                                        ← Back to collections
                                    </button>
                                    <GameLibraryPicker />
                                </>
                            )}
                        </div>
                    )}

                    <button className="back-home" onClick={() => navigate("/")}>
                        Return home <span>↗</span>
                    </button>
                </motion.section>
            ) : null}
        </main>
    )
}

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/" element={<Dashboard />} />
                {sections.map((section) => (
                    <Route key={section.path} path={section.path} element={<Dashboard />} />
                ))}
            </Routes>
        </BrowserRouter>
    )
}

export default App
