import {useEffect, useState} from "react"
import {
    checkAdminSession,
    loginAdmin,
    logoutAdmin,
} from "../data/gameCollections"
import ContentEditor from "./ContentEditor"
import LiftEditor from "./LiftEditor"
import GameLibraryPicker from "./GameLibraryPicker"
import Page from "./Page"
import "../content.css"

type Tab = "games" | "content" | "lifts"

export default function AdminPage() {
    const [password, setPassword] = useState("")
    const [loggedIn, setLoggedIn] = useState(false)
    const [checkingSession, setCheckingSession] = useState(true)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [tab, setTab] = useState<Tab>("games")

    useEffect(() => {
        let cancelled = false

        async function verifySession() {
            try {
                const authenticated = await checkAdminSession()
                if (!cancelled) setLoggedIn(authenticated)
            } catch {
                if (!cancelled) setLoggedIn(false)
            } finally {
                if (!cancelled) setCheckingSession(false)
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
        <Page label="PRIVATE AREA" title="Administration.">
            {checkingSession ? (
                <p className="state">Checking admin session…</p>
            ) : loggedIn ? (
                <>
                    <p className="lede">
                        Manage what appears on your public pages.
                    </p>
                    <button
                        className="button"
                        onClick={() => void handleLogout()}
                        disabled={loading}
                    >
                        {loading ? "Logging out…" : "Log out"}
                    </button>

                    <div className="chips admin-tabs" role="group" aria-label="Admin sections">
                        <button
                            type="button"
                            className="chip"
                            aria-pressed={tab === "games"}
                            onClick={() => setTab("games")}
                        >
                            Games
                        </button>
                        <button
                            type="button"
                            className="chip"
                            aria-pressed={tab === "content"}
                            onClick={() => setTab("content")}
                        >
                            Interests
                        </button>
                        <button
                            type="button"
                            className="chip"
                            aria-pressed={tab === "lifts"}
                            onClick={() => setTab("lifts")}
                        >
                            Lifts
                        </button>
                    </div>

                    {tab === "games" && <GameLibraryPicker/>}
                    {tab === "content" && <ContentEditor/>}
                    {tab === "lifts" && <LiftEditor/>}
                </>
            ) : (
                <form className="admin-form" onSubmit={(event) => void handleLogin(event)}>
                    <label htmlFor="admin-password">Admin password</label>
                    <input
                        id="admin-password"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                    />
                    <button className="button" type="submit" disabled={loading}>
                        {loading ? "Logging in…" : "Log in"}
                    </button>
                </form>
            )}

            {error && <p className="state state-error" role="alert">{error}</p>}
        </Page>
    )
}
