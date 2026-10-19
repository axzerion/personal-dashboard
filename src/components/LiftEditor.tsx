import {useEffect, useState} from "react"
import {formatDate, formatNumber, getEditableLifts, saveLifts} from "../data/lifts"
import type {LiftsData, Unit} from "../data/lifts"
import {invalidateLifts} from "../hooks/resources"
import "../content.css"

const MAX_LIFTS = 30
const MAX_ENTRIES = 5000
const RECENT_COUNT = 25

const today = () => new Date().toLocaleDateString("en-CA") // YYYY-MM-DD in local time

export default function LiftEditor() {
    const [data, setData] = useState<LiftsData | null>(null)
    const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving">("saved")
    const [error, setError] = useState<string | null>(null)

    const [newLift, setNewLift] = useState<{ name: string; unit: Unit }>({name: "", unit: "kg"})
    const [entry, setEntry] = useState({liftId: "", weight: "", reps: "", date: today()})
    const [showAll, setShowAll] = useState(false)

    useEffect(() => {
        let cancelled = false

        getEditableLifts()
            .then((loaded) => {
                if (!cancelled) setData(loaded)
            })
            .catch((err: unknown) => {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Couldn’t load lifts.")
                }
            })

        return () => {
            cancelled = true
        }
    }, [])

    function update(next: LiftsData) {
        setData(next)
        setSaveState("dirty")
        setError(null)
    }

    if (!data) {
        return error ? (
            <p className="state state-error" role="alert">{error}</p>
        ) : (
            <p className="state">Loading lifts…</p>
        )
    }

    const selectedLiftId = data.lifts.some((lift) => lift.id === entry.liftId)
        ? entry.liftId
        : (data.lifts[0]?.id ?? "")
    const liftById = new Map(data.lifts.map((lift) => [lift.id, lift]))

    const sortedEntries = [...data.entries].sort((a, b) => b.date.localeCompare(a.date))
    const shownEntries = showAll ? sortedEntries : sortedEntries.slice(0, RECENT_COUNT)

    function addLift(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!data) return

        const name = newLift.name.trim()
        if (!name) return

        if (data.lifts.length >= MAX_LIFTS) {
            setError(`You can have up to ${MAX_LIFTS} lifts.`)
            return
        }

        if (data.lifts.some((lift) => lift.name.toLowerCase() === name.toLowerCase())) {
            setError("You already have a lift with that name.")
            return
        }

        const lift = {id: crypto.randomUUID(), name, unit: newLift.unit}
        update({...data, lifts: [...data.lifts, lift]})
        setEntry({...entry, liftId: lift.id})
        setNewLift({name: "", unit: newLift.unit})
    }

    function renameLift(id: string, name: string) {
        if (!data) return
        update({...data, lifts: data.lifts.map((lift) => (lift.id === id ? {...lift, name} : lift))})
    }

    function deleteLift(id: string) {
        if (!data) return

        const lift = liftById.get(id)
        const count = data.entries.filter((e) => e.liftId === id).length

        if (!window.confirm(`Delete ${lift?.name ?? "this lift"} and its ${count} logged sets?`)) {
            return
        }

        update({
            lifts: data.lifts.filter((l) => l.id !== id),
            entries: data.entries.filter((e) => e.liftId !== id),
        })
    }

    function addEntry(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!data || !selectedLiftId) return

        const weight = Number(entry.weight.replace(",", "."))
        const reps = Number(entry.reps)

        if (!Number.isFinite(weight) || weight <= 0 || weight > 2000) {
            setError("Enter a weight between 0 and 2000.")
            return
        }

        if (!Number.isInteger(reps) || reps < 1 || reps > 100) {
            setError("Reps must be a whole number from 1 to 100.")
            return
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
            setError("Pick a date.")
            return
        }

        if (data.entries.length >= MAX_ENTRIES) {
            setError(`You can log up to ${MAX_ENTRIES} sets.`)
            return
        }

        update({
            ...data,
            entries: [
                {id: crypto.randomUUID(), liftId: selectedLiftId, date: entry.date, weight, reps},
                ...data.entries,
            ],
        })
        setEntry({...entry, liftId: selectedLiftId, weight: "", reps: ""})
    }

    function deleteEntry(id: string) {
        if (!data) return
        update({...data, entries: data.entries.filter((e) => e.id !== id)})
    }

    async function handleSave() {
        if (!data) return

        const names = data.lifts.map((lift) => lift.name.trim().toLowerCase())

        if (names.some((name) => !name)) {
            setError("Every lift needs a name.")
            return
        }

        if (new Set(names).size !== names.length) {
            setError("Two lifts have the same name.")
            return
        }

        setSaveState("saving")
        setError(null)

        try {
            await saveLifts({
                ...data,
                lifts: data.lifts.map((lift) => ({...lift, name: lift.name.trim()})),
            })
            invalidateLifts()
            setSaveState("saved")
        } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn’t save lifts.")
            setSaveState("dirty")
        }
    }

    return (
        <section className="content-editor">
            <div className="editor-bar">
                <div>
                    <span className="window-label">LIFT LOG</span>
                    <h2 className="editor-heading">Log lifts</h2>
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

            {data.lifts.length > 0 ? (
                <form className="editor-form" onSubmit={addEntry}>
                    <select
                        className="editor-select"
                        aria-label="Lift"
                        value={selectedLiftId}
                        onChange={(event) => setEntry({...entry, liftId: event.target.value})}
                    >
                        {data.lifts.map((lift) => (
                            <option key={lift.id} value={lift.id}>
                                {lift.name || "Unnamed lift"}
                            </option>
                        ))}
                    </select>
                    <input
                        className="editor-input"
                        type="text"
                        inputMode="decimal"
                        placeholder={`Weight (${liftById.get(selectedLiftId)?.unit ?? "kg"})`}
                        aria-label="Weight"
                        value={entry.weight}
                        onChange={(event) => setEntry({...entry, weight: event.target.value})}
                    />
                    <input
                        className="editor-input"
                        type="text"
                        inputMode="numeric"
                        placeholder="Reps"
                        aria-label="Reps"
                        value={entry.reps}
                        onChange={(event) => setEntry({...entry, reps: event.target.value})}
                    />
                    <input
                        className="editor-input"
                        type="date"
                        aria-label="Date"
                        value={entry.date}
                        onChange={(event) => setEntry({...entry, date: event.target.value})}
                    />
                    <button className="button" type="submit">Log set</button>
                </form>
            ) : (
                <p className="state">Add a lift below to start logging.</p>
            )}

            <form className="editor-form" onSubmit={addLift}>
                <input
                    className="editor-input"
                    placeholder="New lift (e.g. Bench press)"
                    aria-label="New lift name"
                    maxLength={60}
                    value={newLift.name}
                    onChange={(event) => setNewLift({...newLift, name: event.target.value})}
                />
                <select
                    className="editor-select"
                    aria-label="Unit for new lift"
                    value={newLift.unit}
                    onChange={(event) => setNewLift({...newLift, unit: event.target.value as Unit})}
                >
                    <option value="kg">kg</option>
                    <option value="lb">lb</option>
                </select>
                <button className="button" type="submit">Add lift</button>
            </form>
            <p className="editor-hint">
                A lift’s unit is fixed when you create it. Existing entries are never converted.
            </p>

            {data.lifts.length > 0 && (
                <ul className="editor-list">
                    {data.lifts.map((lift) => (
                        <li key={lift.id} className="editor-row">
                            <div className="editor-main">
                                <input
                                    className="editor-input"
                                    aria-label={`Name of ${lift.name || "lift"}`}
                                    maxLength={60}
                                    value={lift.name}
                                    onChange={(event) => renameLift(lift.id, event.target.value)}
                                />
                                <span className="editor-sub">
                                    {lift.unit} ·{" "}
                                    {data.entries.filter((e) => e.liftId === lift.id).length} sets logged
                                </span>
                            </div>
                            <div className="editor-actions">
                                <button
                                    type="button"
                                    aria-label={`Delete ${lift.name || "lift"}`}
                                    onClick={() => deleteLift(lift.id)}
                                >
                                    ✕
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {sortedEntries.length > 0 && (
                <>
                    <ul className="editor-list">
                        {shownEntries.map((item) => {
                            const lift = liftById.get(item.liftId)

                            return (
                                <li key={item.id} className="editor-row">
                                    <div className="editor-main">
                                        <span className="editor-title">
                                            {lift?.name} · {formatNumber(item.weight)} {lift?.unit} ×{" "}
                                            {item.reps}
                                        </span>
                                        <span className="editor-sub">{formatDate(item.date)}</span>
                                    </div>
                                    <div className="editor-actions">
                                        <button
                                            type="button"
                                            aria-label={`Delete set on ${formatDate(item.date)}`}
                                            onClick={() => deleteEntry(item.id)}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                    {sortedEntries.length > RECENT_COUNT && (
                        <button
                            type="button"
                            className="button"
                            onClick={() => setShowAll((value) => !value)}
                        >
                            {showAll ? "Show recent only" : `Show all ${sortedEntries.length} sets`}
                        </button>
                    )}
                </>
            )}
        </section>
    )
}
