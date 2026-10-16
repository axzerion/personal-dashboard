import { useEffect, useState } from "react"
import {
    checkAdminSession,
    loginAdmin,
    logoutAdmin,
} from "../data/gameCollections"
import GameLibraryPicker from "./GameLibraryPicker"

export default function AdminPage() {
    const [password, setPassword] = useState("")
    const [loggedIn, setLoggedIn] = useState(false)
    const [checkingSession, setCheckingSession] = useState(true)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false

        async function verifySession() {
            try {
                const authenticated = await checkAdminSession()

                if (!cancelled) {
                    setLoggedIn(authenticated)
                }
            } catch {
                if (!cancelled) {
                    setLoggedIn(false)
                }
            } finally {
                if (!cancelled) {
                    setCheckingSession(false)
                }
            }
        }

        void verifySession()

        return () => {
            cancelled = true
        }
    }, [])

    async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setLoading(true)
        setError(null)

        try {
            await loginAdmin(password)
            setLoggedIn(true)
            setPassword("")
        } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed.")
        } finally {
            setLoading(false)
        }
    }


    async function handleLogout() {
        setLoading(true)
        setError(null)

        try {
            await logoutAdmin()
            setLoggedIn(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Logout failed.")
        } finally {
            setLoading(false)
        }
    }


    return (
        <main className="dashboard">
            <header className="topbar">
                <a className="brand" href="/">PERSONAL SPACE</a>
                <div className="status">
                    <span className="status-dot" />
                    ADMIN
                </div>
            </header>

            <section className="section-page">
                <span className="window-label">PRIVATE AREA</span>
                <h1>Administration.</h1>

                {checkingSession ? (
                    <p>Checking admin session...</p>
                ) : loggedIn ? (
                    <>
                        <p>Manage the game collections displayed on your public Games page.</p>

                        <button
                            className="game-collection-edit"
                            onClick={() => void handleLogout()}
                            disabled={loading}
                        >
                            {loading ? "Logging out..." : "Log out"}
                        </button>

                        <GameLibraryPicker />
                    </>
                ) : (
                    <form onSubmit={(event) => void handleLogin(event)}>
                        <label htmlFor="admin-password">Admin password</label>
                        <input
                            id="admin-password"
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                        />
                        <button type="submit" disabled={loading}>
                            {loading ? "Logging in..." : "Log in"}
                        </button>
                    </form>
                )}

                {error && <p role="alert">{error}</p>}
            </section>
        </main>
    )
}
