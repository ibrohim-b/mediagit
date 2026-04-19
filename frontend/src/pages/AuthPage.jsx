import { useState } from "react";
import { Cat, Bot, Bird } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { api } from "../api";
import Header from "../components/Header";

const STARS = [
  [5, 10, 2],
  [10, 25, 1],
  [15, 50, 2],
  [8, 75, 1.5],
  [20, 90, 2],
  [30, 15, 1],
  [35, 40, 2],
  [25, 60, 1.5],
  [40, 80, 2],
  [45, 5, 1],
  [55, 30, 1.5],
  [50, 55, 2],
  [60, 70, 1],
  [65, 20, 2],
  [70, 45, 1.5],
  [75, 85, 2],
  [80, 10, 1],
  [85, 35, 1.5],
  [90, 65, 2],
  [95, 90, 1],
];

function Field({ label, required, children, hint, error }) {
  return (
    <div>
      <label className="block text-sm text-gray-700 font-medium mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

const INPUT_CLS =
  "w-full border rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none placeholder:text-gray-400 bg-white transition-colors";

function Input({ error, ...props }) {
  return (
    <input
      {...props}
      className={`${INPUT_CLS} ${error ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-gray-400"}`}
    />
  );
}

export default function AuthPage({ mode: initialMode = "login" }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState(initialMode);
  const isSignup = mode === "signup";

  // Fields
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // UI state
  const [fieldErrors, setFieldErrors] = useState({});
  const [globalError, setGlobalError] = useState("");
  const [loading, setLoading] = useState(false);

  const switchMode = (newMode) => {
    setMode(newMode);
    setFieldErrors({});
    setGlobalError("");
  };

  // ── Validation ──────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (isSignup) {
      if (!email.trim()) errs.email = "Email is required";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        errs.email = "Enter a valid email address";

      if (!fullName.trim()) errs.fullName = "Full name is required";
      else if (fullName.trim().length < 2)
        errs.fullName = "Full name is too short";

      if (!username.trim()) errs.username = "Username is required";
      else if (
        !/^[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9]$/.test(username.trim()) &&
        username.trim().length > 1
      )
        errs.username =
          "Only letters, numbers, and hyphens — cannot start or end with a hyphen";
      else if (username.trim().length < 2)
        errs.username = "Username must be at least 2 characters";

      if (!password) errs.password = "Password is required";
      else if (password.length < 8)
        errs.password = "Password must be at least 8 characters";
    } else {
      if (!username.trim() && !email.trim())
        errs.login = "Username or email is required";
      if (!password) errs.password = "Password is required";
    }
    return errs;
  };

  // ── Submit ──────────────────────────────────────────────────────────────
  const submit = async () => {
    setGlobalError("");
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      const res = isSignup
        ? await api.register(
            username.trim(),
            email.trim().toLowerCase(),
            fullName.trim(),
            password,
          )
        : await api.login(username.trim() || email.trim(), password);
      if (res.detail) {
        setGlobalError(res.detail);
        return;
      }
      login(res);
      navigate("/dashboard");
    } catch {
      setGlobalError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter") submit();
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <>
      <Header />
      <div className="flex" style={{ minHeight: "calc(100vh - 64px)" }}>
        {/* ═══════════════════════════════════════════════════════════
            LEFT — dark panel
        ═══════════════════════════════════════════════════════════ */}
        <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[#0d1117] via-[#1a1033] to-[#0d1117] overflow-hidden flex-col p-12">
          {/* Heading */}
        <div className="flex-1 flex items-center relative z-10">
          <div>
            <h2 className="text-4xl font-bold text-white mb-4">
              {isSignup ? "Create your free account" : "Welcome back"}
            </h2>
            <p className="text-gray-400 text-lg mb-6">
              {isSignup
                ? "Join thousands of creators sharing and collaborating on media projects."
                : "Sign in to continue exploring and collaborating on media projects."}
            </p>
            {isSignup && (
              <div className="flex flex-col gap-2 mt-2">
                {[
                  "Unlimited visual version history",
                  "AI-powered change analysis",
                  "Team collaboration tools",
                ].map((f) => (
                  <div
                    key={f}
                    className="flex items-center gap-2 text-sm text-gray-400"
                  >
                    <div className="w-1.5 h-1.5 bg-[#58a6ff] rounded-full shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Background orbs */}
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-800/30 rounded-full blur-[100px] -translate-x-1/2 translate-y-1/2" />
        <div className="absolute top-1/3 right-0 w-48 h-48 bg-blue-800/20 rounded-full blur-[60px]" />

        {/* Stars */}
        {STARS.map(([top, left, size], i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/60"
            style={{
              top: `${top}%`,
              left: `${left}%`,
              width: `${size}px`,
              height: `${size}px`,
            }}
          />
        ))}

        {/* Mascots */}
        <div
          className="absolute bottom-20 left-16 w-28 h-28 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 shadow-lg shadow-purple-500/30 flex items-center justify-center animate-bounce z-10"
          style={{ animationDuration: "3s" }}
        >
          <Cat className="w-12 h-12 text-white drop-shadow" />
        </div>
        <div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30 flex items-center justify-center animate-bounce z-10"
          style={{ animationDuration: "4s", animationDelay: "1s" }}
        >
          <Bot className="w-10 h-10 text-white drop-shadow" />
        </div>
        <div
          className="absolute bottom-20 right-12 w-28 h-28 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg shadow-yellow-500/30 flex items-center justify-center animate-bounce z-10"
          style={{ animationDuration: "3.5s", animationDelay: "0.5s" }}
        >
          <Bird className="w-12 h-12 text-white drop-shadow" />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          RIGHT — white form panel
      ═══════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col bg-white min-h-screen">
        {/* Top-right mode toggle */}
        <div className="flex justify-end p-6 text-sm text-gray-500">
          {isSignup ? "Already have an account?" : "New to MediaGit?"}{" "}
          <button
            onClick={() => switchMode(isSignup ? "login" : "signup")}
            className="ml-1 text-gray-900 font-medium hover:underline"
          >
            {isSignup ? "Sign in →" : "Create an account →"}
          </button>
        </div>

        {/* Centered form */}
        <div className="flex-1 flex items-center justify-center px-6 pb-12">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-semibold text-gray-900 mb-6">
              {isSignup ? "Sign up for MediaGit" : "Sign in to MediaGit"}
            </h1>

            {/* ── Global error ── */}
            {globalError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg mb-4 flex items-start gap-2">
                <span className="shrink-0 mt-0.5">⚠</span>
                <span>{globalError}</span>
              </div>
            )}

            {/* ── SIGNUP FORM ── */}
            {isSignup ? (
              <div className="space-y-4">
                <Field label="Email address" required error={fieldErrors.email}>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    error={fieldErrors.email}
                    onKeyDown={handleKey}
                    autoComplete="email"
                    autoFocus
                  />
                </Field>

                <Field label="Full name" required error={fieldErrors.fullName}>
                  <Input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Smith"
                    error={fieldErrors.fullName}
                    onKeyDown={handleKey}
                    autoComplete="name"
                  />
                </Field>

                <Field
                  label="Username"
                  required
                  error={fieldErrors.username}
                  hint="Letters, numbers, and hyphens only. Cannot start or end with a hyphen."
                >
                  <Input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="jane-smith"
                    error={fieldErrors.username}
                    onKeyDown={handleKey}
                    autoComplete="username"
                  />
                </Field>

                <Field
                  label="Password"
                  required
                  error={fieldErrors.password}
                  hint="At least 8 characters."
                >
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      error={fieldErrors.password}
                      onKeyDown={handleKey}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 select-none"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </Field>

                <button
                  onClick={submit}
                  disabled={loading}
                  className="w-full bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white py-3 rounded-lg text-sm font-semibold transition mt-2"
                >
                  {loading ? "Creating account…" : "Create account →"}
                </button>

                <p className="text-xs text-gray-400 text-center">
                  By creating an account you agree to our{" "}
                  <a href="#" className="text-blue-600 hover:underline">
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a href="#" className="text-blue-600 hover:underline">
                    Privacy Policy
                  </a>
                  .
                </p>
              </div>
            ) : (
              /* ── LOGIN FORM ── */
              <div className="space-y-4">
                <Field
                  label="Username or email"
                  required
                  error={fieldErrors.login}
                >
                  <Input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="jane-smith or you@example.com"
                    error={fieldErrors.login}
                    onKeyDown={handleKey}
                    autoComplete="username"
                    autoFocus
                  />
                </Field>

                <Field label="Password" required error={fieldErrors.password}>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      error={fieldErrors.password}
                      onKeyDown={handleKey}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 select-none"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  <div className="text-right mt-1">
                    <a
                      href="#"
                      className="text-xs text-[#58a6ff] hover:underline"
                    >
                      Forgot password?
                    </a>
                  </div>
                </Field>

                <button
                  onClick={submit}
                  disabled={loading}
                  className="w-full bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white py-3 rounded-lg text-sm font-semibold transition mt-2"
                >
                  {loading ? "Signing in…" : "Sign in →"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
