import { useState } from "react";
import { useAuth } from "../AuthContext";
import { api } from "../api";

export default function AuthPage() {
  const { login } = useAuth();
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    try {
      const res = mode === "login"
        ? await api.login(username, password)
        : await api.register(username, password);
      if (res.detail) { setError(res.detail); return; }
      login(res);
    } catch {
      setError("Something went wrong");
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
      <div className="bg-[#161b22] border border-gray-700 rounded-xl p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <span className="text-4xl">🎨</span>
          <h1 className="text-2xl font-bold mt-2">
            Media<span className="text-[#58a6ff]">Git</span>
          </h1>
        </div>

        <div className="flex mb-6 bg-[#0d1117] rounded-lg p-1">
          {["login", "register"].map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(""); }}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition capitalize ${
                mode === m ? "bg-[#21262d] text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-4 py-2.5 mb-3 focus:border-[#58a6ff] outline-none text-white placeholder:text-gray-500"
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full bg-[#0d1117] border border-gray-700 rounded-lg px-4 py-2.5 mb-4 focus:border-[#58a6ff] outline-none text-white placeholder:text-gray-500"
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

        <button
          onClick={submit}
          className="w-full bg-[#238636] hover:bg-[#2ea043] py-2.5 rounded-lg font-medium transition capitalize"
        >
          {mode}
        </button>
      </div>
    </div>
  );
}
