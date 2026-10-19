export function steamHeaderUrl(appid: number): string {
    return `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`
}

export function formatPlaytime(minutes: number): string {
    if (minutes < 60) return `${minutes} min`

    const hours = minutes / 60
    const value =
        hours < 10 ? hours.toFixed(1).replace(/\.0$/, "") : String(Math.round(hours))

    return `${value} ${value === "1" ? "hr" : "hrs"}`
}
