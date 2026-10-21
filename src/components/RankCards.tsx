import {formatDate} from "../data/lifts"
import {screenshotUrl} from "../data/ranks"
import type {RankEntry} from "../data/ranks"
import type {MediaView} from "../data/media"
import "../rank-cards.css"

interface RankCardsProps {
    ranks: RankEntry[]
    onOpen: (view: MediaView) => void
}

export default function RankCards({ranks, onOpen}: RankCardsProps) {
    return (
        <div className="rank-grid">
            {ranks.map((entry) => {
                const shot = entry.screenshot ? screenshotUrl(entry.screenshot) : null

                return (
                    <article key={entry.id} className="rank-card">
                        <div className="rank-head">
                            <span className="label">{entry.game}</span>
                            <time className="rank-date" dateTime={entry.updated}>
                                {formatDate(entry.updated)}
                            </time>
                        </div>

                        <strong>{entry.rank}</strong>
                        {entry.peak && <p>Peak: {entry.peak}</p>}
                        {entry.note && <p>{entry.note}</p>}

                        {shot && (
                            <button
                                type="button"
                                className="rank-shot"
                                aria-label={`View screenshot: ${entry.game}, ${entry.rank}`}
                                onClick={() =>
                                    onOpen({
                                        kind: "image",
                                        src: shot,
                                        title: `${entry.game} · ${entry.rank}`,
                                        url: shot,
                                    })
                                }
                            >
                                <img src={shot} alt="" loading="lazy" decoding="async"/>
                            </button>
                        )}
                    </article>
                )
            })}
        </div>
    )
}
