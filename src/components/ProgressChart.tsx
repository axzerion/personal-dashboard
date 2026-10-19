import {useState} from "react"
import {formatDate, formatNumber} from "../data/lifts"
import type {LiftPoint, Unit} from "../data/lifts"

const W = 360
const H = 170
const PAD = {top: 14, right: 12, bottom: 26, left: 40}
const INNER_W = W - PAD.left - PAD.right
const INNER_H = H - PAD.top - PAD.bottom

interface ProgressChartProps {
    points: LiftPoint[] // sorted oldest first, at least one
    unit: Unit
    name: string
}

export default function ProgressChart({points, unit, name}: ProgressChartProps) {
    const [active, setActive] = useState<number | null>(null)

    const index = active !== null && active < points.length ? active : points.length - 1
    const selected = points[index]
    const first = points[0]
    const last = points[points.length - 1]

    const times = points.map((point) => new Date(`${point.date}T00:00:00Z`).getTime())
    const minTime = times[0]
    const maxTime = times[times.length - 1]

    const values = points.map((point) => point.estimate)
    const dataMin = Math.min(...values)
    const dataMax = Math.max(...values)
    const spread = dataMax - dataMin || Math.max(dataMax * 0.1, 5)
    const low = dataMin - spread * 0.25
    const high = dataMax + spread * 0.25

    const x = (time: number) =>
        PAD.left +
        (maxTime === minTime ? INNER_W / 2 : ((time - minTime) / (maxTime - minTime)) * INNER_W)
    const y = (value: number) => PAD.top + (1 - (value - low) / (high - low)) * INNER_H

    const coords = points.map((point, i) => ({x: x(times[i]), y: y(point.estimate)}))
    const gridValues = [high, (high + low) / 2, low]

    const summary =
        points.length === 1
            ? `${name}: estimated one-rep max ${formatNumber(first.estimate)} ${unit} on ${formatDate(first.date)}`
            : `${name} estimated one-rep max, from ${formatNumber(first.estimate)} ${unit} on ${formatDate(first.date)} to ${formatNumber(last.estimate)} ${unit} on ${formatDate(last.date)}`

    return (
        <div className="chart">
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
                {gridValues.map((value) => (
                    <g key={value}>
                        <line
                            className="chart-grid"
                            x1={PAD.left}
                            x2={W - PAD.right}
                            y1={y(value)}
                            y2={y(value)}
                        />
                        <text
                            className="chart-axis"
                            x={PAD.left - 8}
                            y={y(value) + 3}
                            textAnchor="end"
                        >
                            {Math.round(value)}
                        </text>
                    </g>
                ))}

                {points.length > 1 && (
                    <polyline
                        className="chart-line"
                        points={coords.map((c) => `${c.x},${c.y}`).join(" ")}
                    />
                )}

                {coords.map((c, i) => (
                    <g key={points[i].date}>
                        <circle
                            className={`chart-dot ${i === index ? "active" : ""}`}
                            cx={c.x}
                            cy={c.y}
                            r={i === index ? 5 : 3.5}
                        />
                        <circle
                            className="chart-hit"
                            cx={c.x}
                            cy={c.y}
                            r={14}
                            onMouseEnter={() => setActive(i)}
                            onClick={() => setActive(i)}
                        />
                    </g>
                ))}

                <text
                    className="chart-axis"
                    x={points.length === 1 ? PAD.left + INNER_W / 2 : PAD.left}
                    y={H - 6}
                    textAnchor={points.length === 1 ? "middle" : "start"}
                >
                    {formatDate(first.date, true)}
                </text>
                {points.length > 1 && (
                    <text className="chart-axis" x={W - PAD.right} y={H - 6} textAnchor="end">
                        {formatDate(last.date, true)}
                    </text>
                )}
            </svg>

            <p className="chart-readout">
                {formatDate(selected.date)} · {formatNumber(selected.estimate)} {unit} est. 1RM ·{" "}
                {formatNumber(selected.weight)} {unit} × {selected.reps}
            </p>
        </div>
    )
}
