import { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
  useNavigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import Dashboard from "./pages/Dashboard";
import ProjectView from "./pages/ProjectView";
import DiffView from "./pages/DiffView";
import AuthPage from "./pages/AuthPage";
import LandingPage from "./pages/LandingPage";
import CommitsPage from "./pages/CommitsPage";
import BranchPage from "./pages/BranchPage";
import PRPage from "./pages/PRPage";
import { api } from "./api";
import Header from "./components/Header";
import { Search, Bell, Plus, ChevronDown } from "lucide-react";

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z");
  const s = (Date.now() - date.getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const [searchVal, setSearchVal] = useState("");
  const navigate = useNavigate();

  const [notifCount, setNotifCount] = useState(0);
  const [notifs, setNotifs] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    const load = () =>
      api
        .getNotifications()
        .then((n) => {
          setNotifs(n);
          setNotifCount(n.filter((x) => !x.is_read).length);
        })
        .catch(() => {});
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchVal.trim()) {
      // future: navigate to search results
    }
  };

  const avatarLetter = user.username ? user.username[0].toUpperCase() : "?";

  return (
    <div className="min-h-screen bg-[#0d1117] text-gray-200">
      <Header />

      {/* ── Page content ── */}
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

function AppInner() {
  const { user } = useAuth();
  return (
    <Routes>
      {/* Public */}
      <Route
        path="/"
        element={user ? <Navigate to="/dashboard" replace /> : <LandingPage />}
      />
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <AuthPage mode="login" />
          )
        }
      />
      <Route
        path="/signup"
        element={
          user ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <AuthPage mode="signup" />
          )
        }
      />

      {/* Protected */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/project/:id"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ProjectView />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/project/:id/diff"
        element={
          <ProtectedRoute>
            <AppLayout>
              <DiffView />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/project/:id/commits"
        element={
          <ProtectedRoute>
            <AppLayout>
              <CommitsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/project/:id/branch/:bid"
        element={
          <ProtectedRoute>
            <AppLayout>
              <BranchPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/project/:id/pr/:prid"
        element={
          <ProtectedRoute>
            <AppLayout>
              <PRPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
