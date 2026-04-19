import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Bell, Plus, ChevronDown } from "lucide-react";
import { useAuth } from "../AuthContext";
import { api } from "../api";

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z");
  const s = (Date.now() - date.getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [searchVal, setSearchVal] = useState("");
  const [notifCount, setNotifCount] = useState(0);
  const [notifs, setNotifs] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    if (!user) return;
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
  }, [user]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchVal.trim()) {
      // future: navigate to search results
    }
  };

  const avatarLetter = user?.username ? user.username[0].toUpperCase() : "?";

  return (
    <header className="sticky top-0 w-full z-50 bg-[#161b22]/95 backdrop-blur-md border-b border-[#30363d] h-16 flex items-center">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-4">
        {/* Logo */}
        <Link
          to={user ? "/dashboard" : "/"}
          className="flex items-center gap-2 shrink-0 text-white no-underline text-lg font-bold"
        >
          <img
            src="/icon_white.png"
            className="w-8 h-8 object-contain"
            alt="MediaGit"
          />
          <span className="hidden sm:block">
            Media<span className="text-[#58a6ff]">Git</span>
          </span>
        </Link>

        {/* Search bar */}
        <form
          onSubmit={handleSearch}
          className="flex-1 max-w-xs lg:max-w-sm xl:max-w-md hidden sm:block"
        >
          <div className="relative flex items-center">
            <Search
              size={14}
              className="absolute left-3 text-gray-500 pointer-events-none"
            />
            <input
              type="text"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              placeholder="Search or jump to..."
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-md pl-8 pr-3 py-1.5 text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] transition-colors"
            />
            <kbd className="absolute right-2 hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-gray-500 bg-[#21262d] border border-[#30363d] rounded pointer-events-none">
              /
            </kbd>
          </div>
        </form>

        {/* Nav Links */}
        <nav className="hidden md:flex items-center gap-1 ml-2">
          {user ? (
            <Link
              to="/dashboard"
              className="px-3 py-1.5 text-sm font-medium text-[#c9d1d9] hover:text-white rounded-md hover:bg-[#21262d] transition-colors"
              style={{ textDecoration: "none" }}
            >
              Repositories
            </Link>
          ) : (
            <>
              {["Product", "Solutions", "Open Source", "Pricing"].map((label) => (
                <a
                  key={label}
                  href="#"
                  className="px-3 py-1.5 text-sm font-medium text-[#c9d1d9] hover:text-white rounded-md hover:bg-[#21262d] transition-colors no-underline"
                >
                  {label}
                </a>
              ))}
            </>
          )}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right Side */}
        <div className="flex items-center gap-2 shrink-0">
          {user ? (
            <>
              {/* New button */}
              <button
                onClick={() => navigate("/dashboard")}
                className="hidden sm:flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-[#238636] hover:bg-[#2ea043] border border-[#2ea043]/60 rounded-md transition-colors"
              >
                <Plus size={14} />
                <span>New</span>
                <ChevronDown size={12} className="text-white/70" />
              </button>

              {/* Notification bell */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifs((v) => !v)}
                  className="relative p-1.5 rounded-md hover:bg-[#21262d] text-[#8b949e] hover:text-[#e6edf3] transition-colors"
                >
                  <Bell size={16} />
                  {notifCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#da3633] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {notifCount > 9 ? "9+" : notifCount}
                    </span>
                  )}
                </button>
                {showNotifs && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#21262d]">
                      <span className="text-sm font-semibold text-[#e6edf3]">
                        Notifications
                      </span>
                      {notifCount > 0 && (
                        <button
                          onClick={() => {
                            api.markAllNotificationsRead();
                            setNotifCount(0);
                            setNotifs((n) =>
                              n.map((x) => ({ ...x, is_read: 1 })),
                            );
                          }}
                          className="text-xs text-[#58a6ff] hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifs.length === 0 ? (
                        <p className="text-[#8b949e] text-sm text-center py-6">
                          No notifications
                        </p>
                      ) : (
                        notifs.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => {
                              api.markNotificationRead(n.id);
                              setNotifCount((c) =>
                                Math.max(0, c - (n.is_read ? 0 : 1)),
                              );
                              navigate(n.link || "/dashboard");
                              setShowNotifs(false);
                            }}
                            className={`flex items-start gap-3 px-4 py-3 border-b border-[#21262d] cursor-pointer hover:bg-[#1c2128] transition-colors ${
                              !n.is_read ? "bg-[#1c2128]" : ""
                            }`}
                          >
                            <div
                              className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                                !n.is_read ? "bg-[#58a6ff]" : "bg-transparent"
                              }`}
                            />
                            <div>
                              <p className="text-sm font-medium text-[#e6edf3]">
                                {n.title}
                              </p>
                              {n.body && (
                                <p className="text-xs text-[#8b949e] mt-0.5">
                                  {n.body}
                                </p>
                              )}
                              <p className="text-xs text-[#6e7681] mt-1">
                                {timeAgo(n.created_at)}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="w-px h-5 bg-[#30363d] mx-1 hidden sm:block" />

              {/* Username */}
              <span className="hidden lg:block text-sm text-[#8b949e] select-none">
                @{user.username}
              </span>

              {/* Avatar + dropdown */}
              <div className="relative group">
                <button className="flex items-center gap-1.5 rounded-full focus:outline-none focus:ring-2 focus:ring-[#58a6ff] focus:ring-offset-2 focus:ring-offset-[#161b22]">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white select-none border border-[#30363d]"
                    style={{
                      background:
                        "linear-gradient(135deg, #58a6ff 0%, #1f6feb 100%)",
                    }}
                  >
                    {avatarLetter}
                  </div>
                  <ChevronDown
                    size={12}
                    className="text-gray-500 hidden sm:block"
                  />
                </button>

                {/* Dropdown */}
                <div className="absolute right-0 top-full mt-2 w-52 bg-[#161b22] border border-[#30363d] rounded-lg shadow-xl opacity-0 invisible group-focus-within:opacity-100 group-focus-within:visible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50">
                  <div className="px-4 py-3 border-b border-[#21262d]">
                    <p className="text-xs text-gray-400">Signed in as</p>
                    <p className="text-sm font-semibold text-white truncate">
                      @{user.username}
                    </p>
                  </div>
                  <div className="py-1">
                    <Link
                      to="/dashboard"
                      className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-[#21262d] transition-colors"
                      style={{ textDecoration: "none" }}
                    >
                      Your repositories
                    </Link>
                  </div>
                  <div className="border-t border-[#21262d] py-1">
                    <button
                      onClick={logout}
                      className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-[#21262d] transition-colors"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Unauthenticated Right Side */
            <div className="flex items-center gap-4">
              <Link
                to="/login"
                className="text-sm font-medium text-[#c9d1d9] hover:text-white transition-colors no-underline"
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                className="text-sm bg-[#238636] hover:bg-[#2ea043] transition-colors text-white px-4 py-1.5 rounded-md font-medium no-underline"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
