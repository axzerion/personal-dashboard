import {BrowserRouter, Route, Routes} from "react-router-dom"
import {MotionConfig} from "framer-motion"
import Layout from "./components/Layout"
import AdminPage from "./components/AdminPage"
import Home from "./pages/Home"
import ProjectsPage from "./pages/ProjectsPage"
import GamesPage from "./pages/GamesPage"
import ResourcesPage from "./pages/ResourcesPage"
import InterestsPage from "./pages/InterestsPage"
import NotFound from "./pages/NotFound"

function App() {
    return (
        <MotionConfig reducedMotion="user">
            <BrowserRouter>
                <Routes>
                    <Route element={<Layout/>}>
                        <Route index element={<Home/>}/>
                        <Route path="projects" element={<ProjectsPage/>}/>
                        <Route path="games" element={<GamesPage/>}/>
                        <Route path="interests" element={<InterestsPage/>}/>
                        <Route path="resources" element={<ResourcesPage/>}/>
                        <Route path="admin" element={<AdminPage/>}/>
                        <Route path="*" element={<NotFound/>}/>
                    </Route>
                </Routes>
            </BrowserRouter>
        </MotionConfig>
    )
}

export default App
