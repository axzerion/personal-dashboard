import {Link} from "react-router-dom"
import Page from "../components/Page"

export default function NotFound() {
    return (
        <Page label="404" title="Not found." intro="That page doesn’t exist.">
            <Link className="button" to="/">Back home</Link>
        </Page>
    )
}
