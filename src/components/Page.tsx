import type {ReactNode} from "react"
import {motion} from "framer-motion"

interface PageProps {
    label: string
    title: string
    intro?: string
    children?: ReactNode
}

export default function Page({label, title, intro, children}: PageProps) {
    return (
        <motion.section
            className="page"
            initial={{opacity: 0, y: 8}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.3, ease: [0.23, 1, 0.32, 1]}}
        >
            <header>
                <span className="label">{label}</span>
                <h1>{title}</h1>
                {intro && <p className="lede">{intro}</p>}
            </header>
            <div className="page-body">{children}</div>
        </motion.section>
    )
}
