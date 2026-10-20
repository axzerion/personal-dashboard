import {useState} from "react"
import Page from "../components/Page"
import {getSection, pageProps} from "../data/sections"
import {useContent} from "../hooks/resources"
import "../content.css"

const SEARCH_THRESHOLD = 8

function domainOf(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, "")
    } catch {
        return url
    }
}

export default function ResourcesPage() {
    const {data, loading, error} = useContent()
    const [category, setCategory] = useState("All")
    const [query, setQuery] = useState("")

    const items = data?.resources ?? []
    const categoryOf = (item: { category?: string }) => item.category || "Other"

    const categories = [...new Set(items.map(categoryOf))]
    const activeCategory =
        category === "All" || categories.includes(category) ? category : "All"

    const needle = query.trim().toLowerCase()

    const visible = items.filter((item) => {
        if (activeCategory !== "All" && categoryOf(item) !== activeCategory) return false
        if (!needle) return true

        return [item.title, item.note ?? "", categoryOf(item), domainOf(item.url ?? "")].some(
            (text) => text.toLowerCase().includes(needle)
        )
    })

    const groups = categories
        .map((name) => ({name, items: visible.filter((item) => categoryOf(item) === name)}))
        .filter((group) => group.items.length > 0)

    return (
        <Page {...pageProps(getSection("/resources"))}>
            {loading && <p className="state">Loading…</p>}
            {error && <p className="state state-error" role="alert">{error}</p>}
            {!loading && !error && items.length === 0 && (
                <p className="state">Nothing here yet.</p>
            )}

            {items.length > 0 && (
                <>
                    {categories.length > 1 && (
                        <div className="chips" role="group" aria-label="Filter resources">
                            {["All", ...categories].map((name) => (
                                <button
                                    key={name}
                                    type="button"
                                    className="chip"
                                    aria-pressed={activeCategory === name}
                                    onClick={() => setCategory(name)}
                                >
                                    {name}
                                </button>
                            ))}
                        </div>
                    )}

                    {items.length > SEARCH_THRESHOLD && (
                        <input
                            className="picker-search resource-search"
                            type="search"
                            placeholder="Search resources"
                            aria-label="Search resources"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                        />
                    )}

                    {groups.length === 0 && <p className="state">No matches.</p>}

                    {groups.map((group) => (
                        <section key={group.name} className="resource-group">
                            <h2>{group.name}</h2>
                            <div className="resource-list">
                                {group.items.map((item) => (
                                    <a
                                        key={item.id}
                                        className="resource-row"
                                        href={item.url}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        <span className="resource-main">
                                            <span className="resource-title">
                                                {item.title} <span className="arrow">↗</span>
                                            </span>
                                            {item.note && (
                                                <span className="resource-note">{item.note}</span>
                                            )}
                                        </span>
                                        <span className="resource-domain">
                                            {domainOf(item.url ?? "")}
                                        </span>
                                    </a>
                                ))}
                            </div>
                        </section>
                    ))}
                </>
            )}
        </Page>
    )
}
