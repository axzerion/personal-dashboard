import {useState} from "react"
import LiftProgress from "../components/LiftProgress"
import Page from "../components/Page"
import Shelf from "../components/Shelf"
import StatCards from "../components/StatCards"
import TopicList from "../components/TopicList"
import {interestGroups, interestSections} from "../data/content"
import type {InterestGroup, InterestSection} from "../data/content"
import {getSection, pageProps} from "../data/sections"
import {useContent, useLifts} from "../hooks/resources"
import "../content.css"

export default function InterestsPage() {
    const {data, loading: contentLoading, error} = useContent()
    const {data: lifts, loading: liftsLoading} = useLifts()
    const [group, setGroup] = useState<InterestGroup | "All">("All")

    const loading = contentLoading || liftsLoading
    const hasLifts = (lifts?.entries.length ?? 0) > 0

    const hasContent = (section: InterestSection) =>
        section.kind === "lifts" ? hasLifts : (data?.[section.id]?.length ?? 0) > 0

    const filled = interestSections.filter(hasContent)
    const groups = interestGroups.filter((name) => filled.some((s) => s.group === name))
    const visible = filled.filter((s) => group === "All" || s.group === group)
    const showsTmdb = visible.some((s) => s.source === "movie" || s.source === "show")

    return (
        <Page {...pageProps(getSection("/interests"))}>
            {loading && <p className="state">Loading…</p>}
            {error && <p className="state state-error" role="alert">{error}</p>}
            {!loading && !error && filled.length === 0 && (
                <p className="state">Nothing here yet.</p>
            )}

            {filled.length > 0 && (
                <>
                    {groups.length > 1 && (
                        <div className="chips" role="group" aria-label="Filter interests">
                            {(["All", ...groups] as const).map((name) => (
                                <button
                                    key={name}
                                    type="button"
                                    className="chip"
                                    aria-pressed={group === name}
                                    onClick={() => setGroup(name)}
                                >
                                    {name}
                                </button>
                            ))}
                        </div>
                    )}

                    {visible.map((section) => {
                        const items = data?.[section.id] ?? []

                        return (
                            <section key={section.id} className="interest-section">
                                <h2>{section.title}</h2>

                                {section.kind === "lifts" && lifts && <LiftProgress data={lifts}/>}

                                {items.length > 0 && section.kind === "shelf" && (
                                    <Shelf items={items} ratio={section.ratio ?? "poster"}/>
                                )}
                                {items.length > 0 && section.kind === "stats" && (
                                    <StatCards items={items}/>
                                )}
                                {items.length > 0 && section.kind === "list" && (
                                    <TopicList items={items}/>
                                )}
                            </section>
                        )
                    })}

                    {showsTmdb && (
                        <p className="credit">
                            Movie and TV data from TMDB. This product uses the TMDB API but is not
                            endorsed or certified by TMDB.
                        </p>
                    )}
                </>
            )}
        </Page>
    )
}
