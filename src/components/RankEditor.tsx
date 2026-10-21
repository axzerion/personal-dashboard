import {useEffect, useState} from "react"
import {formatDate} from "../data/lifts"
import {getEditableRanks, saveRanks, screenshotUrl, uploadScreenshot} from "../data/ranks"
import type {RankEntry, RanksData} from "../data/ranks"
import {invalidateRanks} from "../hooks/resources"
import "../content.css"

const MAX_RANKS = 100
const today = () => new Date().toLocaleDateString("en-CA") // YYYY-MM-DD in local time
const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)

const emptyForm = () => ({game: "", rank: "", peak: "", note: "", updated: today(), screenshot: ""})

export default function RankEditor() {
    const [data, setData] = useState<RanksData | null>(null)
    const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving">("saved")
    const [error, setError] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const [form, setForm] = useState(emptyForm)

    useEffect(() => {
        let cancelled = false

        getEditableRanks()
            .then((loaded) => {
                if (!cancelled) setData(loaded)
            })
            .catch((err: unknown) => {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Couldn’t load ranks.")
                }
            })

        return () => {
            cancelled = true
        }
    }, [])

    // Functional updates, so a slow upload can never overwrite edits made meanwhile.
    function change(update: (current: RanksData) => RanksData) {
        setData((current) => (current ? update(current) : current))
        setSaveState("dirty")
        setError(null)
    }

    function patchEntry(id: string, patch: Partial<RankEntry>) {
        change((current) => ({
            ranks: current.ranks.map((entry) => (entry.id === id ? {...entry, ...patch} : entry)),
        }))
    }

    if (!data) {
        return error ? (
            <p className="state state-error" role="alert">{error}</p>
        ) : (
            <p className="state">Loading ranks…</p>
        )
    }

    const games: string[] = Array.from(new Set(data.ranks.map((entry): string => entry.game)))

    async function pickScreenshot(event: React.ChangeEvent<HTMLInputElement>, entryId?: string) {
        const input = event.target
        const file = input.files?.[0]
        if (!file) return

        setUploading(true)
        setError(null)

        try {
            const id = await uploadScreenshot(file)

            if (entryId) {
                patchEntry(entryId, {screenshot: id})
            } else {
                setForm((current) => ({...current, screenshot: id}))
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn’t upload the screenshot.")
        } finally {
            setUploading(false)
            input.value = ""
        }
    }

    function addRank(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!data) return

        const typedGame = form.game.trim()
        const rank = form.rank.trim()

        if (!typedGame || !rank) return

        if (!isDate(form.updated)) {
            setError("Pick a date.")
            return
        }

        if (data.ranks.length >= MAX_RANKS) {
            setError(`You can have up to ${MAX_RANKS} ranks.`)
            return
        }

        // Reuse an existing game's spelling so "valorant" never splits from "Valorant".
        const game =
            games.find((name) => name.toLowerCase() === typedGame.toLowerCase()) ?? typedGame

        const entry: RankEntry = {
            id: crypto.randomUUID(),
            game,
            rank,
            peak: form.peak.trim() || undefined,
            note: form.note.trim() || undefined,
            screenshot: form.screenshot || undefined,
            updated: form.updated,
        }

        change((current) => ({ranks: [entry, ...current.ranks]}))
        setForm(emptyForm())
    }

    function move(index: number, direction: -1 | 1) {
        change((current) => {
            const target = index + direction
            if (target < 0 || target >= current.ranks.length) return current

            const next = [...current.ranks]
            const moved = next[index]
            next[index] = next[target]
            next[target] = moved
            return {ranks: next}
        })
    }

    async function handleSave() {
        if (!data) return

        // First spelling of each game wins; everything is trimmed.
        const seen = new Map<string, string>()
        const ranks = data.ranks.map((entry) => {
            const name = entry.game.trim()
            const key = name.toLowerCase()
            if (!seen.has(key)) seen.set(key, name)

            return {
                ...entry,
                game: seen.get(key) ?? name,
                rank: entry.rank.trim(),
                peak: entry.peak?.trim() || undefined,
                note: entry.note?.trim() || undefined,
            }
        })

        if (ranks.some((entry) => !entry.game || !entry.rank)) {
            setError("Every entry needs a game and a rank.")
            return
        }

        if (ranks.some((entry) => !isDate(entry.updated))) {
            setError("Every entry needs a valid date.")
            return
        }

        setSaveState("saving")
        setError(null)

        try {
            await saveRanks({ranks})
            setData({ranks})
            invalidateRanks()
            setSaveState("saved")
        } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn’t save ranks.")
            setSaveState("dirty")
        }
    }

    return (
        <section className="content-editor">
            <div className="editor-bar">
                <div>
                    <span className="window-label">COMPETITIVE RANKS</span>
                    <h2 className="editor-heading">Manage ranks</h2>
                </div>

                <div className="editor-save">
                    <span className="picker-save-status" role="status">
                        <span className={`picker-status-dot ${saveState === "saved" ? "" : "pending"}`}/>
                        {saveState === "saving"
                            ? "Saving…"
                            : uploading
                                ? "Uploading…"
                                : saveState === "dirty"
                                    ? "Unsaved changes"
                                    : "All changes saved"}
                    </span>
                    <button
                        type="button"
                        className="button"
                        onClick={() => void handleSave()}
                        disabled={saveState !== "dirty" || uploading}
                    >
                        Save changes
                    </button>
                </div>
            </div>

            {error && <p className="picker-error" role="alert">{error}</p>}

            <form className="editor-form" onSubmit={addRank}>
                <input
                    className="editor-input"
                    list="rank-games"
                    placeholder="Game"
                    aria-label="Game"
                    maxLength={100}
                    value={form.game}
                    onChange={(event) => setForm({...form, game: event.target.value})}
                />
                <input
                    className="editor-input"
                    placeholder="Rank (e.g. Diamond II)"
                    aria-label="Rank"
                    maxLength={60}
                    value={form.rank}
                    onChange={(event) => setForm({...form, rank: event.target.value})}
                />
                <input
                    className="editor-input"
                    placeholder="Peak (optional)"
                    aria-label="Peak rank"
                    maxLength={60}
                    value={form.peak}
                    onChange={(event) => setForm({...form, peak: event.target.value})}
                />
                <input
                    className="editor-input"
                    placeholder="Note (optional)"
                    aria-label="Note"
                    maxLength={300}
                    value={form.note}
                    onChange={(event) => setForm({...form, note: event.target.value})}
                />
                <input
                    className="editor-input"
                    type="date"
                    aria-label="Date"
                    value={form.updated}
                    onChange={(event) => setForm({...form, updated: event.target.value})}
                />
                <button className="button" type="submit" disabled={uploading}>Add</button>
            </form>

            <datalist id="rank-games">
                {games.map((name) => (
                    <option key={name} value={name}/>
                ))}
            </datalist>

            <div className="editor-upload">
                <label>
                    Screenshot (optional)
                    <input
                        key={form.screenshot || "none"}
                        className="editor-file"
                        type="file"
                        accept="image/*"
                        disabled={uploading}
                        onChange={(event) => void pickScreenshot(event)}
                    />
                </label>
                {form.screenshot && (
                    <>
                        <img
                            className="editor-thumb wide"
                            src={screenshotUrl(form.screenshot)}
                            alt=""
                        />
                        <button
                            type="button"
                            className="button"
                            onClick={() => setForm({...form, screenshot: ""})}
                        >
                            Remove
                        </button>
                    </>
                )}
            </div>
            <p className="editor-hint">
                Screenshots are shrunk in your browser before upload. Choose the file first, then press Add.
            </p>

            {data.ranks.length === 0 ? (
                <p className="state">No ranks yet.</p>
            ) : (
                <ul className="editor-list">
                    {data.ranks.map((entry, index) => (
                        <li key={entry.id} className="editor-row">
                            {entry.screenshot && (
                                <img
                                    className="editor-thumb wide"
                                    src={screenshotUrl(entry.screenshot)}
                                    alt=""
                                />
                            )}

                            <div className="editor-main">
                                <span className="editor-title">{entry.game}</span>
                                <span className="editor-sub">Updated {formatDate(entry.updated)}</span>

                                <input
                                    className="editor-input"
                                    aria-label={`Rank for ${entry.game}`}
                                    placeholder="Rank"
                                    maxLength={60}
                                    value={entry.rank}
                                    onChange={(event) => patchEntry(entry.id, {rank: event.target.value})}
                                />
                                <input
                                    className="editor-input"
                                    aria-label={`Peak rank for ${entry.game}`}
                                    placeholder="Peak (optional)"
                                    maxLength={60}
                                    value={entry.peak ?? ""}
                                    onChange={(event) =>
                                        patchEntry(entry.id, {peak: event.target.value || undefined})
                                    }
                                />
                                <input
                                    className="editor-input"
                                    aria-label={`Note for ${entry.game}`}
                                    placeholder="Note (optional)"
                                    maxLength={300}
                                    value={entry.note ?? ""}
                                    onChange={(event) =>
                                        patchEntry(entry.id, {note: event.target.value || undefined})
                                    }
                                />
                                <input
                                    className="editor-input"
                                    type="date"
                                    aria-label={`Date for ${entry.game}`}
                                    value={entry.updated}
                                    onChange={(event) => patchEntry(entry.id, {updated: event.target.value})}
                                />

                                <span className="editor-upload">
                                    <input
                                        className="editor-file"
                                        type="file"
                                        accept="image/*"
                                        aria-label={`${entry.screenshot ? "Replace" : "Add"} screenshot for ${entry.game}`}
                                        disabled={uploading}
                                        onChange={(event) => void pickScreenshot(event, entry.id)}
                                    />
                                    {entry.screenshot && (
                                        <button
                                            type="button"
                                            className="button"
                                            onClick={() => patchEntry(entry.id, {screenshot: undefined})}
                                        >
                                            Remove screenshot
                                        </button>
                                    )}
                                </span>
                            </div>

                            <div className="editor-actions">
                                <button
                                    type="button"
                                    aria-label={`Move ${entry.game} up`}
                                    onClick={() => move(index, -1)}
                                    disabled={index === 0}
                                >
                                    ↑
                                </button>
                                <button
                                    type="button"
                                    aria-label={`Move ${entry.game} down`}
                                    onClick={() => move(index, 1)}
                                    disabled={index === data.ranks.length - 1}
                                >
                                    ↓
                                </button>
                                <button
                                    type="button"
                                    aria-label={`Remove ${entry.game}`}
                                    onClick={() =>
                                        change((current) => ({
                                            ranks: current.ranks.filter((other) => other.id !== entry.id),
                                        }))
                                    }
                                >
                                    ✕
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    )
}
