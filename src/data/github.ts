const repositories = [
    {
        owner: "axzerion",
        name: "Pentia-Chat-App"
    },
    {
        owner: "axzerion",
        name: "HDRAutoSwitcher"
    },
    {
        owner: "axzerion",
        name: "SteamProject"
    },
]

export interface GitHubProject {
    name: string
    description: string | null
    html_url: string
    language: string | null
    languages: Record<string, number>
    stargazers_count: number
    topics: string[]
}

export async function getGitHubProjects(): Promise<GitHubProject[]> {
    const projects = await Promise.all(
        repositories.map(async ({ owner, name }) => {
            const response = await fetch(
                `https://api.github.com/repos/${owner}/${name}`
            )

            if (!response.ok) {
                const details = await response.text()

                throw new Error(
                    `GitHub API failed for ${owner}/${name}: ${response.status} ${response.statusText}. ${details}`
                )
            }

            const repository = await response.json()

            const languagesResponse = await fetch(repository.languages_url)

            const languages = languagesResponse.ok
                ? await languagesResponse.json()
                : {}

            return {
                name: repository.name,
                description: repository.description,
                html_url: repository.html_url,
                language: repository.language,
                languages,
                stargazers_count: repository.stargazers_count,
                topics: repository.topics ?? [],
            } satisfies GitHubProject
        })
    )

    return projects
}