import type { GitHubProject } from "../data/github"

interface ProjectCardProps {
    project: GitHubProject
}

export default function ProjectCard({ project }: ProjectCardProps) {
    const languages = Object.keys(project.languages)

    return (
        <article className="project-card">
            <div className="project-card-header">
        <span className="window-label">
          {project.language ?? "PROJECT"}
        </span>

                {project.stargazers_count > 0 && (
                    <span className="project-stars">
            ★ {project.stargazers_count}
          </span>
                )}
            </div>

            <h2>{project.name}</h2>

            <p>
                {project.description || "No description provided on GitHub."}
            </p>

            <div className="project-languages">
                {languages.map((language) => (
                    <span key={language} className="project-language">
            {language}
          </span>
                ))}
            </div>

            <a
                className="project-link"
                href={project.html_url}
                target="_blank"
                rel="noreferrer"
            >
                View repository <span>↗</span>
            </a>
        </article>
    )
}
