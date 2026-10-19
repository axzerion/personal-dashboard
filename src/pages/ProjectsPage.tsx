import Page from "../components/Page"
import ProjectCard from "../components/ProjectCard"
import {getSection, pageProps} from "../data/sections"
import {useGitHubProjects} from "../hooks/resources"

export default function ProjectsPage() {
    const {data: projects, loading, error} = useGitHubProjects()

    return (
        <Page {...pageProps(getSection("/projects"))}>
            {loading && <p className="state">Loading projects from GitHub…</p>}
            {error && <p className="state state-error" role="alert">{error}</p>}
            {projects?.length === 0 && <p className="state">No projects to show yet.</p>}

            {projects && projects.length > 0 && (
                <div className="projects-list">
                    {projects.map((project) => (
                        <ProjectCard key={project.html_url} project={project}/>
                    ))}
                </div>
            )}
        </Page>
    )
}
