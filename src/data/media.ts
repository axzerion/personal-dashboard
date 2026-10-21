import type {ResourceKind} from "./content"

const YOUTUBE_HOSTS = new Set([
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtube-nocookie.com",
    "www.youtube-nocookie.com",
    "youtu.be",
])

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|avif|svg|bmp)$/i
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

export type MediaView =
    | { kind: "video"; id: string; start?: number; title: string; url: string }
    | { kind: "image"; src: string; title: string; url: string }

function parseUrl(url: string): URL | null {
    try {
        return new URL(url)
    } catch {
        return null
    }
}

export function getYouTubeId(url: string): string | null {
    const parsed = parseUrl(url)
    if (!parsed || !YOUTUBE_HOSTS.has(parsed.hostname)) return null

    let id: string | null = null

    if (parsed.hostname === "youtu.be") {
        id = parsed.pathname.slice(1).split("/")[0]
    } else if (parsed.pathname === "/watch") {
        id = parsed.searchParams.get("v")
    } else {
        const match = parsed.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?]+)/)
        id = match ? match[1] : null
    }

    return id && VIDEO_ID.test(id) ? id : null
}

// Supports ?t=90,t=1m30s and ?start=90
export function getYouTubeStart(url: string): number | undefined {
    const parsed = parseUrl(url)
    const raw = parsed?.searchParams.get("t") ?? parsed?.searchParams.get("start")

    if (!raw) return undefined
    if (/^\d+$/.test(raw)) return Number(raw)

    const match = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/)
    if (!match) return undefined

    const seconds =
        Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0)

    return seconds > 0 ? seconds : undefined
}

export function isImageUrl(url: string): boolean {
    const parsed = parseUrl(url)
    return parsed !== null && IMAGE_EXTENSIONS.test(parsed.pathname)
}

export function detectKind(url: string): ResourceKind {
    if (getYouTubeId(url)) return "video"
    if (isImageUrl(url)) return "image"
    return "link"
}

export function youtubeThumb(id: string): string {
    return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
}

// youtube-nocookie.com avoids tracking cookies until the video is played.
export function embedUrl(id: string, start?: number): string {
    const params = new URLSearchParams({autoplay: "1", rel: "0", playsinline: "1"})
    if (start) params.set("start", String(start))
    return `https://www.youtube-nocookie.com/embed/${id}?${params}`
}

// Returns null when the item isn't a playable video or viewable image.
export function toMediaView(item: {
    title: string
    url?: string
    kind?: ResourceKind
}): MediaView | null {
    const url = item.url ?? ""
    const kind = item.kind ?? detectKind(url)

    if (kind === "video") {
        const id = getYouTubeId(url)
        return id ? {kind: "video", id, start: getYouTubeStart(url), title: item.title, url} : null
    }

    if (kind === "image" && url) {
        return {kind: "image", src: url, title: item.title, url}
    }

    return null
}
