export type Unit = "kg" | "lb"

export interface Lift {
    id: string
    name: string
    unit: Unit
}

export interface LiftEntry {
    id: string
    liftId: string
    date: string // YYYY-MM-DD
    weight: number
    reps: number
}

export interface LiftsData {
    lifts: Lift[]
    entries: LiftEntry[]
}

export interface LiftPoint {
    date: string
    estimate: number
    weight: number
    reps: number
}

// Epley formula. Most accurate for sets of about 10 reps or fewer.
export function estimateOneRepMax(weight: number, reps: number): number {
    return reps <= 1 ? weight : weight * (1 + reps / 30)
}

// Best set of each day, oldest first.
export function buildPoints(entries: LiftEntry[]): LiftPoint[] {
    const best = new Map<string, LiftPoint>()

    for (const entry of entries) {
        const estimate = estimateOneRepMax(entry.weight, entry.reps)
        const current = best.get(entry.date)

        if (!current || estimate > current.estimate) {
            best.set(entry.date, {
                date: entry.date,
                estimate,
                weight: entry.weight,
                reps: entry.reps,
            })
        }
    }

    return [...best.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function formatNumber(value: number): string {
    return String(Math.round(value * 10) / 10)
}

export function formatDate(date: string, short = false): string {
    return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        ...(short ? {} : {year: "numeric"}),
    })
}

export async function getLifts(): Promise<LiftsData> {
    const response = await fetch("/api/content?resource=lifts")

    if (!response.ok) {
        throw new Error("Couldn’t load lifts.")
    }

    return response.json()
}

// Admin only: bypasses the public cache so edits never start from stale data.
export async function getEditableLifts(): Promise<LiftsData> {
    const response = await fetch("/api/content?resource=lifts&fresh=1")

    if (response.status === 401) {
        throw new Error("Your admin session has expired. Please log in again.")
    }

    if (!response.ok) {
        throw new Error("Couldn’t load lifts.")
    }

    return response.json()
}

export async function saveLifts(data: LiftsData): Promise<void> {
    const response = await fetch("/api/content?resource=lifts", {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(data),
    })

    if (response.status === 401) {
        throw new Error("Your admin session has expired. Please log in again.")
    }

    if (!response.ok) {
        throw new Error("Couldn’t save lifts.")
    }
}
