import {useEffect, useState} from "react"
import {
    BrowserRouter,
    Routes,
    Route,
    useLocation,
    useNavigate,
} from "react-router-dom"
import {motion, LayoutGroup} from "framer-motion"
import {getGitHubProjects} from "./data/github"
import type {GitHubProject} from "./data/github"
import ProjectCard from "./components/ProjectCard"
import {
    getRecentlyPlayedGames,
} from "./data/steam"
import type {
    SteamGame,
} from "./data/steam"
import GameCard from "./components/GameCard"

const sections = [
    {
        path: "/projects",
        number: "01",
        label: "Projects",
        description: "Things I've played around with, or am working on."
    },
    {path: "/games", number: "02", label: "Games", description: "What I'm playing."},
    {path: "/interests", number: "03", label: "Interests", description: "Things beyond."},
    {path: "/resources", number: "04", label: "Resources", description: "Useful things worth keeping."},
]

function Dashboard() {
    const location = useLocation()
    const navigate = useNavigate()
    const activePath = location.pathname
    const isHome = activePath === "/"

    const activeSection = sections.find((section) => section.path === activePath)

    const [projects, setProjects] = useState<GitHubProject[]>([])
    const [projectsLoading, setProjectsLoading] = useState(false)
    const [projectsError, setProjectsError] = useState<string | null>(null)

    const [games, setGames] = useState<SteamGame[]>([])
    const [gamesLoading, setGamesLoading] = useState(false)
    const [gamesError, setGamesError] = useState<string | null>(null)

    useEffect(() => {
        if (activePath !== "/projects") return

        let cancelled = false

        async function loadProjects() {
            setProjectsLoading(true)
            setProjectsError(null)

            try {
                const data = await getGitHubProjects()

                if (!cancelled) {
                    setProjects(data)
                }
            } catch {
                console.error("GitHub project loading failed:", Error)

                if (!cancelled) {
                    setProjectsError("Couldn't load projects from GitHub. Please try again.")
                }
            } finally {
                if (!cancelled) {
                    setProjectsLoading(false)
                }
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

                if (!cancelled) {
                    setGames(data.games ?? [])
                }
            } catch (error: unknown) {
                console.error("Steam game loading failed:", error)

                if (!cancelled) {
                    setGamesError(
                        error instanceof Error
                            ? error.message
                            : String(error)
                    )
                }
            } finally {
                if (!cancelled) {
                    setGamesLoading(false)
                }
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

                <div className="status">
                    <span className="status-dot"/>
                    {isHome ? "HOME" : activeSection?.label.toUpperCase()}
                </div>
            </header>

            <LayoutGroup>
                <section className={`dashboard-grid ${isHome ? "" : "dashboard-grid-expanded"}`}>
                    {sections.map((section) => {
                        const active = section.path === activePath

                        return (
                            <motion.button
                                key={section.path}
                                layout
                                transition={{layout: {duration: 0.55, ease: [0.22, 1, 0.36, 1]}}}
                                className={`window window-${section.label.toLowerCase()} ${active ? "window-active" : ""}`}
                                onClick={() => navigate(section.path)}
                            >
                                <span className="window-number">{section.number}</span>

                                <div>
                  <span className="window-label">
                    {section.label.toUpperCase()}
                  </span>
                                    <h2>{section.label}</h2>

                                    {(isHome || active) && (
                                        <p>{section.description}</p>
                                    )}
                                </div>
                            </motion.button>
                        )
                    })}

                    {!isHome && activeSection && (
                        <motion.div
                            layout
                            key={`content-${activeSection.path}`}
                            className="expanded-content"
                            initial={{opacity: 0}}
                            animate={{opacity: 1}}
                            transition={{duration: 0.35, delay: 0.15}}
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
                                        <ProjectCard key={project.html_url} project={project}/>
                                    ))}
                                </div>
                            )}


                            {activePath === "/games" && (
                                <div className="games-list">
                                    {gamesLoading && <p>Loading games from Steam...</p>}

                                    {gamesError && <p role="alert">{gamesError}</p>}

                                    {!gamesLoading && !gamesError && games.length === 0 && (
                                        <p>No recently played games found.</p>
                                    )}

                                    {!gamesLoading && !gamesError && games.map((game) => (
                                        <GameCard key={game.appid} game={game} />
                                    ))}
                                </div>
                            )}



                            <button className="back-home" onClick={() => navigate("/")}>
                                Return home <span>↗</span>
                            </button>

                        </motion.div>
                    )}
                </section>
            </LayoutGroup>
        </main>
    )
}

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Dashboard/>}/>
                {sections.map((section) => (
                    <Route key={section.path} path={section.path} element={<Dashboard/>}/>
                ))}
            </Routes>
        </BrowserRouter>
    )
}

export default App