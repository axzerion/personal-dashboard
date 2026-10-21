import {useEffect, useState} from "react"
import {getGitHubProjects} from "../data/github"
import {getRecentlyPlayedGames} from "../data/steam"
import {getCollectionGames} from "../data/gameCollections"
import {getContent} from "../data/content"
import {getLifts} from "../data/lifts"
import {getRanks} from "../data/ranks"

export interface Resource<T> {
    data: T | null
    loading: boolean
    error: string | null
}

interface Entry<T> {
    value: T
    at: number
}

interface Options<T> {
    fetcher: () => Promise<T>
    errorMessage: string
    ttlMs: number
    storageKey: string
}

// Shared, cached data hook:
// - one request is shared by every component that uses it
// - the result is kept in memory and in localStorage
// - saved data shows instantly, then refreshes in the background once older than ttlMs
function createResource<T>({fetcher, errorMessage, ttlMs, storageKey}: Options<T>) {
    let cache: Entry<T> | null = null
    let hydrated = false
    let inflight: Promise<Entry<T>> | null = null

    function readStored(): Entry<T> | null {
        try {
            const raw = localStorage.getItem(storageKey)
            return raw ? (JSON.parse(raw) as Entry<T>) : null
        } catch {
            return null
        }
    }

    function current(): Entry<T> | null {
        if (cache === null && !hydrated) {
            hydrated = true
            cache = readStored()
        }
        return cache
    }

    const isFresh = (entry: Entry<T> | null) =>
        entry !== null && Date.now() - entry.at < ttlMs

    function load(): Promise<Entry<T>> {
        inflight ??= fetcher()
            .then((value) => {
                const entry: Entry<T> = {value, at: Date.now()}
                cache = entry
                try {
                    localStorage.setItem(storageKey, JSON.stringify(entry))
                } catch {
                    // storage full or unavailable: memory cache still works
                }
                return entry
            })
            .finally(() => {
                inflight = null
            })
        return inflight
    }

    function invalidate() {
        cache = null
        hydrated = true
        try {
            localStorage.removeItem(storageKey)
        } catch {
            // ignore
        }
    }

    function use(): Resource<T> {
        const [state, setState] = useState<Resource<T>>(() => {
            const entry = current()
            return {data: entry ? entry.value : null, loading: entry === null, error: null}
        })

        useEffect(() => {
            if (isFresh(current())) return

            let cancelled = false

            load()
                .then((entry) => {
                    if (!cancelled) setState({data: entry.value, loading: false, error: null})
                })
                .catch((error: unknown) => {
                    console.error(errorMessage, error)
                    if (cancelled) return
                    // Keep showing saved data if we have any; only show the error when there is nothing to show.
                    setState((previous) =>
                        previous.data !== null
                            ? {...previous, loading: false}
                            : {data: null, loading: false, error: errorMessage}
                    )
                })

            return () => {
                cancelled = true
            }
        }, [])

        return state
    }

    return {use, invalidate}
}

const githubProjects = createResource({
    fetcher: getGitHubProjects,
    errorMessage: "Couldn’t load projects from GitHub. Please try again.",
    ttlMs: 60 * 60 * 1000,
    storageKey: "ps:github-projects",
})

const recentGames = createResource({
    fetcher: async () => (await getRecentlyPlayedGames()).games ?? [],
    errorMessage: "Couldn’t load recently played games from Steam.",
    ttlMs: 5 * 60 * 1000,
    storageKey: "ps:recent-games",
})

const collectionGames = createResource({
    fetcher: getCollectionGames,
    errorMessage: "Couldn’t load your game collections.",
    ttlMs: 10 * 60 * 1000,
    storageKey: "ps:collection-games",
})

export const useGitHubProjects = githubProjects.use
export const useRecentlyPlayedGames = recentGames.use
export const useCollectionGames = collectionGames.use
export const invalidateCollectionGames = collectionGames.invalidate

const content = createResource({
    fetcher: getContent,
    errorMessage: "Couldn’t load content.",
    ttlMs: 60 * 1000,
    storageKey: "ps:content",
})

export const useContent = content.use
export const invalidateContent = content.invalidate

const lifts = createResource({
    fetcher: getLifts,
    errorMessage: "Couldn’t load lifts.",
    ttlMs: 60 * 1000,
    storageKey: "ps:lifts",
})

export const useLifts = lifts.use
export const invalidateLifts = lifts.invalidate

const ranks = createResource({
    fetcher: getRanks,
    errorMessage: "Couldn’t load ranks.",
    ttlMs: 60 * 1000,
    storageKey: "ps:ranks",
})

export const useRanks = ranks.use
export const invalidateRanks = ranks.invalidate
