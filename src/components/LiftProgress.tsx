import ProgressChart from "./ProgressChart"
import {buildPoints, estimateOneRepMax, formatDate, formatNumber} from "../data/lifts"
import type {LiftsData} from "../data/lifts"

export default function LiftProgress({data}: { data: LiftsData }) {
    const cards = data.lifts
        .map((lift) => {
            const entries = data.entries.filter((entry) => entry.liftId === lift.id)
            return {lift, entries, points: buildPoints(entries)}
        })
        .filter((card) => card.points.length > 0)

    if (cards.length === 0) return null

    return (
        <div className="lift-grid">
            {cards.map(({lift, entries, points}) => {
                const latest = points[points.length - 1]
                const previous = points.length > 1 ? points[points.length - 2] : null
                const delta = previous ? latest.estimate - previous.estimate : null
                const history = [...entries].sort((a, b) => b.date.localeCompare(a.date))

                return (
                    <article key={lift.id} className="lift-card">
                        <span className="label">{lift.name}</span>
                        <strong>
                            {formatNumber(latest.estimate)} <span>{lift.unit}</span>
                        </strong>
                        <p>
                            est. 1RM · latest set {formatNumber(latest.weight)} {lift.unit} ×{" "}
                            {latest.reps}
                        </p>
                        {previous && delta !== null && (
                            <p className={`lift-delta ${delta > 0 ? "up" : ""}`}>
                                {delta > 0 ? "+" : ""}
                                {formatNumber(delta)} {lift.unit} since {formatDate(previous.date, true)}
                            </p>
                        )}

                        <ProgressChart points={points} unit={lift.unit} name={lift.name}/>

                        <details className="lift-history">
                            <summary>History ({entries.length})</summary>
                            <table>
                                <thead>
                                <tr>
                                    <th scope="col">Date</th>
                                    <th scope="col">Set</th>
                                    <th scope="col">Est. 1RM</th>
                                </tr>
                                </thead>
                                <tbody>
                                {history.map((entry) => (
                                    <tr key={entry.id}>
                                        <td>{formatDate(entry.date)}</td>
                                        <td>
                                            {formatNumber(entry.weight)} {lift.unit} × {entry.reps}
                                        </td>
                                        <td>
                                            {formatNumber(estimateOneRepMax(entry.weight, entry.reps))}{" "}
                                            {lift.unit}
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </details>
                    </article>
                )
            })}
        </div>
    )
}
