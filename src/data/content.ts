export type ItemStatus = "favorite" | "current" | "want" | "done"
export type ResourceKind = "link" | "video" | "image"

export interface ContentItem {
    id: string
    title: string
    subtitle?: string
    cover?: string
    url?: string
    note?: string
    status?: ItemStatus
    value?: string
    category?: string
    kind?: ResourceKind
}

export type ContentData = Record<string, ContentItem[]>

export type LookupSource = "anime" | "book" | "movie" | "show" | "video"

export interface LookupResult {
    title: string
    subtitle?: string
    cover?: string
    url?: string
}

export const interestGroups = ["Watching", "Reading", "Active"] as const
export type InterestGroup = (typeof interestGroups)[number]

export interface InterestSection {
    id: string
    title: string
    group: InterestGroup
    kind: "shelf" | "stats" | "list" | "lifts"
    ratio?: "poster" | "wide"
    source?: LookupSource
    searchHint?: string
}

// Add or reorder sections here. Ids are the keys saved in storage.
export const interestSections: InterestSection[] = [
    {id: "movies", title: "Movies", group: "Watching", kind: "shelf", ratio: "poster", source: "movie", searchHint: "Search movies"},
    {id: "shows", title: "Shows", group: "Watching", kind: "shelf", ratio: "poster", source: "show", searchHint: "Search TV shows"},
    {id: "anime", title: "Anime", group: "Watching", kind: "shelf", ratio: "poster", source: "anime", searchHint: "Search anime"},
    {id: "videos", title: "Videos", group: "Watching", kind: "shelf", ratio: "wide", source: "video", searchHint: "Paste a YouTube link"},
    {id: "books", title: "Books", group: "Reading", kind: "shelf", ratio: "poster", source: "book", searchHint: "Search books"},
    {id: "sports", title: "Sports", group: "Active", kind: "list"},
    {id: "gym", title: "Gym", group: "Active", kind: "lifts"},
]

export async function getContent(): Promise<ContentData> {
    const response = await fetch("/api/content")

    if (!response.ok) {
        throw new Error("Couldn’t load content.")
    }

    return response.json()
}

// Admin only: bypasses the public cache so edits never start from stale data.
export async function getEditableContent(): Promise<ContentData> {
    const response = await fetch("/api/content?fresh=1")

    if (response.status === 401) {
        throw new Error("Your admin session has expired. Please log in again.")
    }

    if (!response.ok) {
        throw new Error("Couldn’t load content.")
    }

    return response.json()
}

export async function saveContent(content: ContentData): Promise<void> {
    const response = await fetch("/api/content", {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(content),
    })

    if (response.status === 401) {
        throw new Error("Your admin session has expired. Please log in again.")
    }

    if (!response.ok) {
        throw new Error("Couldn’t save content.")
    }
}

export async function lookupMedia(
    source: LookupSource,
    query: string
): Promise<LookupResult[]> {
    const params = new URLSearchParams({lookup: source, q: query})
    const response = await fetch(`/api/content?${params}`)

    const data = (await response.json().catch(() => null)) as
        | { results?: LookupResult[]; error?: string }
        | null

    if (!response.ok) {
        throw new Error(data?.error ?? "Search failed.")
    }

    return data?.results ?? []
}
