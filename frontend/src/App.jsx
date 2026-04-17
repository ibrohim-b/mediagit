import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import Dashboard from "./pages/Dashboard";
import ProjectView from "./pages/ProjectView";
import DiffView from "./pages/DiffView";
import AuthPage from "./pages/AuthPage";

function AppInner() {
  const { user, logout } = useAuth();

  if (!user) return <AuthPage />;

  return (
    <div className="min-h-screen bg-[#0d1117] text-gray-200">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold text-white flex items-center gap-2 no-underline">
          <span className="text-2xl">🎨</span>
          <span>Media<span className="text-[#58a6ff]">Git</span></span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">@{user.username}</span>
          <button
            onClick={logout}
            className="text-xs text-gray-600 hover:text-gray-300 transition"
          >
            Sign out
          </button>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/project/:id" element={<ProjectView />} />
          <Route path="/project/:id/diff" element={<DiffView />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppInner />
      </BrowserRouter>
    </AuthProvider>
  );
}
