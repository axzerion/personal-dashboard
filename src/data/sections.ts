export interface Section {
    path: string
    number: string
    label: string
    heading: string
    summary: string
    pageIntro: string
}

export const sections: Section[] = [
    {
        path: "/projects",
        number: "01",
        label: "Projects",
        heading: "What I’m building",
        summary: "Software projects, experiments, and things I’ve made.",
        pageIntro: "Things I’ve played around with, or am working on.",
    },
    {
        path: "/games",
        number: "02",
        label: "Games",
        heading: "Games",
        summary: "Games I enjoy and what I’ve been playing lately.",
        pageIntro: "What I’m playing.",
    },
    {
        path: "/interests",
        number: "03",
        label: "Interests",
        heading: "Interests",
        summary: "Other interesting stuff.",
        pageIntro: "Other stuff.",
    },
    {
        path: "/resources",
        number: "04",
        label: "Resources",
        heading: "Useful things",
        summary: "Tools, links, and resources worth keeping around.",
        pageIntro: "Useful things worth keeping.",
    },
]

export function getSection(path: string): Section {
    const section = sections.find((s) => s.path === path)
    if (!section) throw new Error(`Unknown section: ${path}`)
    return section
}

export function pageProps(section: Section) {
    return {
        label: `${section.number} / ${section.label}`,
        title: `${section.label}.`,
        intro: section.pageIntro,
    }
}
