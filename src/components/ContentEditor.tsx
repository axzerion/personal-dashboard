import {useEffect, useState} from "react"
import {
    getEditableContent,
    interestSections,
    lookupMedia,
    saveContent,
} from "../data/content"
import type {ContentData, ContentItem, ItemStatus, LookupResult} from "../data/content"
import {invalidateContent} from "../hooks/resources"
import "../content.css"

const statusOptions: { value: ItemStatus | ""; label: string }[] = [
    {value: "", label: "No status"},
    {value: "favorite", label: "Favorite"},
    {value: "current", label: "Now"},
    {value: "want", label: "Up next"},
    {value: "done", label: "Done"},
]

const MAX_ITEMS = 200

export default function ContentEditor() {
    const [content, setContent] = useState<ContentData | null>(null)
    const [sectionId, setSectionId] = useState(interestSections[0].id)
    const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving">("saved")
    const [error, setError] = useState<string | null>(null)

    const [query, setQuery] = useState("")
    const [results, setResults] = useState<LookupResult[]>([])
    const [searching, setSearching] = useState(false)

    const [manual, setManual] = useState({title: "", cover: "", url: ""})
    const [stat, setStat] = useState({label: "", value: "", note: ""})

    const section = interestSections.find((s) => s.id === sectionId) ?? interestSections[0]
    const items = content?.[section.id] ?? []

    useEffect(() => {
        let cancelled = false

        getEditableContent()
            .then((data) => {
                if (!cancelled) setContent(data)
            })
            .catch((err: unknown) => {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Couldn’t load content.")
                }
            })

        return () => {
            cancelled = true
        }
    }, [])

    function setItems(next: ContentItem[]) {
        setContent((previous) => ({...(previous ?? {}), [section.id]: next}))
        setSaveState("dirty")
        setError(null)
    }

    function patchItem(id: string, patch: Partial<ContentItem>) {
        setItems(items.map((item) => (item.id === id ? {...item, ...patch} : item)))
    }

    function move(index: number, direction: -1 | 1) {
        const target = index + direction
        if (target < 0 || target >= items.length) return

        const next = [...items]
        const moved = next[index]
        next[index] = next[target]
        next[target] = moved
        setItems(next)
    }

    function addItem(item: Omit<ContentItem, "id">) {
        if (items.length >= MAX_ITEMS) {
            setError(`A section can hold up to ${MAX_ITEMS} items.`)
            return false
        }

        setItems([{id: crypto.randomUUID(), ...item}, ...items])
        return true
    }

    function selectSection(id: string) {
        setSectionId(id)
        setResults([])
        setQuery("")
        setError(null)
    }

    async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!section.source || !query.trim()) return

        setSearching(true)
        setError(null)

        try {
            setResults(await lookupMedia(section.source, query.trim()))
        } catch (err) {
            setResults([])
            setError(err instanceof Error ? err.message : "Search failed.")
        } finally {
            setSearching(false)
        }
    }

    function addResult(result: LookupResult) {
        if (addItem(result)) {
            setResults([])
            setQuery("")
        }
    }

    function addManual(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()

        const title = manual.title.trim()
        const cover = manual.cover.trim()
        const url = manual.url.trim()

        if (!title) return

        if ((cover && !cover.startsWith("https://")) || (url && !url.startsWith("https://"))) {
            setError("Links must start with https://")
            return
        }

        if (addItem({title, cover: cover || undefined, url: url || undefined})) {
            setManual({title: "", cover: "", url: ""})
        }
    }

    function addStat(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()

        const label = stat.label.trim()
        if (!label) return

        if (
            addItem({
                title: label,
                value: stat.value.trim() || undefined,
                note: stat.note.trim() || undefined,
            })
        ) {
            setStat({label: "", value: "", note: ""})
        }
    }

    async function handleSave() {
        if (!content) return

        setSaveState("saving")
        setError(null)

        try {
            await saveContent(content)
            invalidateContent()
            setSaveState("saved")
        } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn’t save content.")
            setSaveState("dirty")
        }
    }

    if (!content) {
        return error ? (
            <p className="state state-error" role="alert">{error}</p>
        ) : (
            <p className="state">Loading content…</p>
        )
    }

    return (
        <section className="content-editor">
            <div className="editor-bar">
                <div>
                    <span className="window-label">CONTENT MANAGEMENT</span>
                    <h2 className="editor-heading">Manage interests</h2>
                </div>

                <div className="editor-save">
                    <span className="picker-save-status" role="status">
                        <span className={`picker-status-dot ${saveState === "saved" ? "" : "pending"}`}/>
                        {saveState === "saving"
                            ? "Saving…"
                            : saveState === "dirty"
                                ? "Unsaved changes"
                                : "All changes saved"}
                    </span>
                    <button
                        type="button"
                        className="button"
                        onClick={() => void handleSave()}
                        disabled={saveState !== "dirty"}
                    >
                        Save changes
                    </button>
                </div>
            </div>

            <div className="chips" role="group" aria-label="Section">
                {interestSections.map((s) => (
                    <button
                        key={s.id}
                        type="button"
                        className="chip"
                        aria-pressed={s.id === section.id}
                        onClick={() => selectSection(s.id)}
                    >
                        {s.title} · {content[s.id]?.length ?? 0}
                    </button>
                ))}
            </div>

            {error && <p className="picker-error" role="alert">{error}</p>}

            {section.kind === "shelf" && section.source && (
                <>
                    <form className="editor-search" onSubmit={(event) => void handleSearch(event)}>
                        <input
                            className="picker-search"
                            type="search"
                            placeholder={section.searchHint}
                            aria-label={section.searchHint}
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                        />
                        <button className="button" type="submit" disabled={searching}>
                            {searching ? "Searching…" : "Search"}
                        </button>
                    </form>

                    {results.length > 0 && (
                        <ul className="editor-list">
                            {results.map((result) => (
                                <li key={`${result.url}-${result.title}`}>
                                    <button
                                        type="button"
                                        className="editor-result"
                                        onClick={() => addResult(result)}
                                    >
                                        {result.cover ? (
                                            <img
                                                className={`editor-thumb ${section.ratio === "wide" ? "wide" : ""}`}
                                                src={result.cover}
                                                alt=""
                                            />
                                        ) : (
                                            <span className={`editor-thumb ${section.ratio === "wide" ? "wide" : ""}`}/>
                                        )}
                                        <span className="editor-main">
                                            <span className="editor-title">{result.title}</span>
                                            {result.subtitle && (
                                                <span className="editor-sub">{result.subtitle}</span>
                                            )}
                                        </span>
                                        <span className="picker-game-action">+ Add</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    <details className="editor-manual">
                        <summary>Add manually</summary>
                        <form className="editor-form" onSubmit={addManual}>
                            <input
                                className="editor-input"
                                placeholder="Title"
                                aria-label="Title"
                                maxLength={200}
                                value={manual.title}
                                onChange={(event) => setManual({...manual, title: event.target.value})}
                            />
                            <input
                                className="editor-input"
                                placeholder="Cover image URL (https://…)"
                                aria-label="Cover image URL"
                                value={manual.cover}
                                onChange={(event) => setManual({...manual, cover: event.target.value})}
                            />
                            <input
                                className="editor-input"
                                placeholder="Link (https://…)"
                                aria-label="Link"
                                value={manual.url}
                                onChange={(event) => setManual({...manual, url: event.target.value})}
                            />
                            <button className="button" type="submit">Add</button>
                        </form>
                    </details>
                </>
            )}

            {section.kind === "stats" && (
                <form className="editor-form" onSubmit={addStat}>
                    <input
                        className="editor-input"
                        placeholder="Label (e.g. Squat)"
                        aria-label="Label"
                        maxLength={200}
                        value={stat.label}
                        onChange={(event) => setStat({...stat, label: event.target.value})}
                    />
                    <input
                        className="editor-input"
                        placeholder="Value (e.g. 140 kg)"
                        aria-label="Value"
                        maxLength={100}
                        value={stat.value}
                        onChange={(event) => setStat({...stat, value: event.target.value})}
                    />
                    <input
                        className="editor-input"
                        placeholder="Note (optional)"
                        aria-label="Note"
                        maxLength={300}
                        value={stat.note}
                        onChange={(event) => setStat({...stat, note: event.target.value})}
                    />
                    <button className="button" type="submit">Add</button>
                </form>
            )}

            {items.length === 0 ? (
                <p className="state">Nothing in {section.title} yet.</p>
            ) : (
                <ul className="editor-list">
                    {items.map((item, index) => (
                        <li key={item.id} className="editor-row">
                            {section.kind === "shelf" &&
                                (item.cover ? (
                                    <img
                                        className={`editor-thumb ${section.ratio === "wide" ? "wide" : ""}`}
                                        src={item.cover}
                                        alt=""
                                    />
                                ) : (
                                    <span className={`editor-thumb ${section.ratio === "wide" ? "wide" : ""}`}/>
                                ))}

                            <div className="editor-main">
                                <span className="editor-title">{item.title}</span>
                                {item.subtitle && <span className="editor-sub">{item.subtitle}</span>}

                                {section.kind === "stats" && (
                                    <input
                                        className="editor-input"
                                        aria-label={`Value for ${item.title}`}
                                        placeholder="Value"
                                        maxLength={100}
                                        value={item.value ?? ""}
                                        onChange={(event) =>
                                            patchItem(item.id, {value: event.target.value || undefined})
                                        }
                                    />
                                )}

                                <input
                                    className="editor-input"
                                    aria-label={`Note for ${item.title}`}
                                    placeholder="Short note (optional)"
                                    maxLength={300}
                                    value={item.note ?? ""}
                                    onChange={(event) =>
                                        patchItem(item.id, {note: event.target.value || undefined})
                                    }
                                />
                            </div>

                            {section.kind === "shelf" && (
                                <select
                                    className="editor-select"
                                    aria-label={`Status for ${item.title}`}
                                    value={item.status ?? ""}
                                    onChange={(event) =>
                                        patchItem(item.id, {
                                            status: (event.target.value || undefined) as ItemStatus | undefined,
                                        })
                                    }
                                >
                                    {statusOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            )}

                            <div className="editor-actions">
                                <button
                                    type="button"
                                    aria-label={`Move ${item.title} up`}
                                    onClick={() => move(index, -1)}
                                    disabled={index === 0}
                                >
                                    ↑
                                </button>
                                <button
                                    type="button"
                                    aria-label={`Move ${item.title} down`}
                                    onClick={() => move(index, 1)}
                                    disabled={index === items.length - 1}
                                >
                                    ↓
                                </button>
                                <button
                                    type="button"
                                    aria-label={`Remove ${item.title}`}
                                    onClick={() => setItems(items.filter((other) => other.id !== item.id))}
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
