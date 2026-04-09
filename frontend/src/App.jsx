import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import ProjectView from "./pages/ProjectView";
import DiffView from "./pages/DiffView";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#0d1117] text-gray-200">
        {/* Navbar */}
        <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
          <Link
            to="/"
            className="text-xl font-bold text-white flex items-center gap-2 no-underline"
          >
            <span className="text-2xl">🎨</span>
            <span>
              Media<span className="text-[#58a6ff]">Git</span>
            </span>
          </Link>
          <span className="text-xs text-gray-600">
            version control for creatives
          </span>
        </nav>

        {/* Main Content */}
        <main className="max-w-6xl mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/project/:id" element={<ProjectView />} />
            <Route path="/project/:id/diff" element={<DiffView />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
