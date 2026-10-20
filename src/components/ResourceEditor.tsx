import {useEffect, useState} from "react"
import {getEditableContent, saveContent} from "../data/content"
import type {ContentData, ContentItem} from "../data/content"
import {invalidateContent} from "../hooks/resources"
import "../content.css"

const KEY = "resources"
const MAX_ITEMS = 200

export default function ResourceEditor() {
    const [content, setContent] = useState<ContentData | null>(null)
    const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving">("saved")
    const [error, setError] = useState<string | null>(null)
    const [form, setForm] = useState({title: "", url: "", category: "", note: ""})

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

    const items = content?.[KEY] ?? []
    const categories = [
        ...new Set(items.map((item) => item.category).filter((name): name is string => !!name)),
    ]

    function setItems(next: ContentItem[]) {
        setContent((previous) => ({...(previous ?? {}), [KEY]: next}))
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

    function addResource(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()

        const title = form.title.trim()
        let url = form.url.trim()

        if (!title || !url) return

        if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) url = `https://${url}`

        try {
            if (new URL(url).protocol !== "https:") throw new Error("not https")
        } catch {
            setError("Enter a valid link that starts with https://")
            return
        }

        if (items.some((item) => item.url === url)) {
            setError("That link is already in your list.")
            return
        }

        if (items.length >= MAX_ITEMS) {
            setError(`You can have up to ${MAX_ITEMS} resources.`)
            return
        }

        // Reuse an existing category's spelling so "dev tools" never splits from "Dev tools".
        const typed = form.category.trim()
        const category =
            categories.find((name) => name.toLowerCase() === typed.toLowerCase()) ||
            typed ||
            "Other"

        setItems([
            {
                id: crypto.randomUUID(),
                title,
                url,
                category,
                note: form.note.trim() || undefined,
            },
            ...items,
        ])
        setForm({title: "", url: "", category: form.category, note: ""})
    }

    async function handleSave() {
        if (!content) return

        // Normalise category spelling: first spelling seen wins, empty becomes "Other".
        const seen = new Map<string, string>()
        const normalised = items.map((item) => {
            const raw = (item.category ?? "").trim() || "Other"
            const key = raw.toLowerCase()
            if (!seen.has(key)) seen.set(key, raw)
            return {...item, category: seen.get(key)}
        })

        const next = {...content, [KEY]: normalised}

        setSaveState("saving")
        setError(null)

        try {
            await saveContent(next)
            setContent(next)
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
            <p className="state">Loading resources…</p>
        )
    }

    return (
        <section className="content-editor">
            <div className="editor-bar">
                <div>
                    <span className="window-label">RESOURCE LINKS</span>
                    <h2 className="editor-heading">Manage resources</h2>
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

            {error && <p className="picker-error" role="alert">{error}</p>}

            <form className="editor-form" onSubmit={addResource}>
                <input
                    className="editor-input"
                    placeholder="Title"
                    aria-label="Title"
                    maxLength={200}
                    value={form.title}
                    onChange={(event) => setForm({...form, title: event.target.value})}
                />
                <input
                    className="editor-input"
                    placeholder="Link (https://…)"
                    aria-label="Link"
                    value={form.url}
                    onChange={(event) => setForm({...form, url: event.target.value})}
                />
                <input
                    className="editor-input"
                    list="resource-categories"
                    placeholder="Category"
                    aria-label="Category"
                    maxLength={60}
                    value={form.category}
                    onChange={(event) => setForm({...form, category: event.target.value})}
                />
                <input
                    className="editor-input"
                    placeholder="Note (optional)"
                    aria-label="Note"
                    maxLength={300}
                    value={form.note}
                    onChange={(event) => setForm({...form, note: event.target.value})}
                />
                <button className="button" type="submit">Add</button>
            </form>

            <datalist id="resource-categories">
                {categories.map((name) => (
                    <option key={name} value={name}/>
                ))}
            </datalist>

            {items.length === 0 ? (
                <p className="state">No resources yet.</p>
            ) : (
                <ul className="editor-list">
                    {items.map((item, index) => (
                        <li key={item.id} className="editor-row">
                            <div className="editor-main">
                                <span className="editor-title">{item.title}</span>
                                <span className="editor-sub">{item.url}</span>
                                <input
                                    className="editor-input"
                                    list="resource-categories"
                                    aria-label={`Category for ${item.title}`}
                                    placeholder="Category"
                                    maxLength={60}
                                    value={item.category ?? ""}
                                    onChange={(event) =>
                                        patchItem(item.id, {category: event.target.value})
                                    }
                                />
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
