import Page from "../components/Page"
import {getSection, pageProps} from "../data/sections"

export default function SectionPage({path}: { path: string }) {
    return (
        <Page {...pageProps(getSection(path))}>
            <p className="state">Nothing here yet.</p>
        </Page>
    )
}
