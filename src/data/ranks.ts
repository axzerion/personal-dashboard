export interface RankEntry {
    id: string
    game: string
    rank: string
    peak?: string
    note?: string
    screenshot?: string // stored file id
    updated: string // YYYY-MM-DD
}

export interface RanksData {
    ranks: RankEntry[]
}

const MAX_EDGE = 1920
const MAX_BYTES = 1_400_000

export function screenshotUrl(id: string): string {
    return `/api/content?resource=screenshot&id=${encodeURIComponent(id)}`
}

export async function getRanks(): Promise<RanksData> {
    const response = await fetch("/api/content?resource=ranks")

    if (!response.ok) {
        throw new Error("Couldn’t load ranks.")
    }

    return response.json()
}

// Admin only: bypasses the public cache so edits never start from stale data.
export async function getEditableRanks(): Promise<RanksData> {
    const response = await fetch("/api/content?resource=ranks&fresh=1")

    if (response.status === 401) {
        throw new Error("Your admin session has expired. Please log in again.")
    }

    if (!response.ok) {
        throw new Error("Couldn’t load ranks.")
    }

    return response.json()
}

export async function saveRanks(data: RanksData): Promise<void> {
    const response = await fetch("/api/content?resource=ranks", {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(data),
    })

    if (response.status === 401) {
        throw new Error("Your admin session has expired. Please log in again.")
    }

    if (!response.ok) {
        throw new Error("Couldn’t save ranks.")
    }
}

// Shrinks the picture in the browser and re-encodes it as JPEG (this also removes
// metadata such as location data). The server only accepts JPEG files.
async function resizeToJpeg(file: File): Promise<Blob> {
    if (!file.type.startsWith("image/")) {
        throw new Error("Choose an image file.")
    }

    let bitmap: ImageBitmap

    try {
        bitmap = await createImageBitmap(file)
    } catch {
        throw new Error("Couldn’t read that image. Try a PNG or JPEG.")
    }

    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))

    const context = canvas.getContext("2d")

    if (!context) {
        bitmap.close()
        throw new Error("Couldn’t process the image.")
    }

    context.fillStyle = "#000" // JPEG has no transparency
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()

    for (const quality of [0.9, 0.8, 0.7, 0.6]) {
        const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, "image/jpeg", quality)
        )

        if (blob && blob.size <= MAX_BYTES) return blob
    }

    throw new Error("That image is too large even after shrinking.")
}

export async function uploadScreenshot(file: File): Promise<string> {
    const jpeg = await resizeToJpeg(file)

    const response = await fetch("/api/content?resource=screenshot", {
        method: "POST",
        headers: {"Content-Type": "image/jpeg"},
        body: jpeg,
    })

    if (response.status === 401) {
        throw new Error("Your admin session has expired. Please log in again.")
    }

    if (response.status === 413) {
        throw new Error("That image is too large even after shrinking.")
    }

    if (!response.ok) {
        throw new Error("Couldn’t upload the screenshot.")
    }

    const data = (await response.json()) as { id: string }
    return data.id
}
