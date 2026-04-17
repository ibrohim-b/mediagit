import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";

export default function ProjectView() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [staged, setStaged] = useState([]);
  const [stagedRemovals, setStagedRemovals] = useState(new Set());
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [collabInput, setCollabInput] = useState("");
  const [collabError, setCollabError] = useState("");

  const load = useCallback(() => {
    api.getProject(id).then(setProject);
  }, [id]);

  const canWrite = project
    ? project.is_owner || project.collaborators.some((c) => c.id === user?.id)
    : false;

  useEffect(() => {
    load();
  }, [load]);

  const handleFiles = async (files) => {
    setUploading(true);
    for (const f of files) {
      if (!f.type.startsWith("image/")) continue;
      const res = await api.uploadFile(f, id);
      setStaged((prev) => [...prev, res]);
    }
    setUploading(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles([...e.dataTransfer.files]);
  };

  const onFileSelect = (e) => {
    handleFiles([...e.target.files]);
    e.target.value = "";
  };

  const commit = async () => {
    if (!message.trim() || (staged.length === 0 && stagedRemovals.size === 0)) return;

    // Carry forward latest version of each file, excluding removals and files being replaced
    const latestFiles = new Map();
    [...project.commits].reverse().forEach((c) =>
      c.snapshots.forEach((s) => { if (!latestFiles.has(s.filename)) latestFiles.set(s.filename, s); })
    );
    const newFilenames = new Set(staged.map((s) => s.filename));
    const carried = [...latestFiles.values()].filter(
      (s) => !stagedRemovals.has(s.filename) && !newFilenames.has(s.filename)
    );

    await api.createCommit(id, {
      message,
      snapshots: [
        ...carried.map((s) => ({ filename: s.filename, file_hash: s.file_hash, storage_path: s.storage_path, file_size: s.file_size })),
        ...staged.map((s) => ({ filename: s.filename, file_hash: s.file_hash, storage_path: s.storage_path, file_size: s.file_size })),
      ],
    });
    setStaged([]);
    setStagedRemovals(new Set());
    setMessage("");
    load();
  };

  const removeStaged = (index) => {
    setStaged((prev) => prev.filter((_, i) => i !== index));
  };

  const rollback = async (commitId) => {
    if (!confirm("Rollback to this commit? All newer commits will be removed."))
      return;
    await api.rollback(id, commitId);
    load();
  };

  const addCollaborator = async () => {
    setCollabError("");
    const username = collabInput.trim().replace(/^@/, "");
    const res = await api.addCollaborator(id, username);
    if (res.detail) { setCollabError(res.detail); return; }
    setCollabInput("");
    load();
  };

  const removeCollaborator = async (uid) => {
    await api.removeCollaborator(id, uid);
    load();
  };

  const toggleVisibility = async () => {
    const next = project.visibility === "public" ? "private" : "public";
    await api.updateVisibility(id, next);
    load();
  };

  if (!project)
    return (
      <div className="text-center py-20 text-gray-500">Loading project...</div>
    );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to="/" className="text-gray-500 hover:text-gray-300 text-sm">Projects</Link>
            <span className="text-gray-600">/</span>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <span className="text-xs text-gray-500">{project.visibility === "public" ? "🌐 public" : "🔒 private"}</span>
          </div>
          {project.description && <p className="text-gray-500 text-sm">{project.description}</p>}
          <p className="text-xs text-gray-600 mt-1">owner: @{project.owner?.username}</p>
        </div>
        <div className="flex items-center gap-2">
          {project.is_owner && (
            <button
              onClick={toggleVisibility}
              className="text-xs border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition"
            >
              {project.visibility === "public" ? "🔒 Make private" : "🌐 Make public"}
            </button>
          )}
          {project.commits.length >= 2 && (
            <button
              onClick={() => nav(`/project/${id}/diff`)}
              className="bg-[#6e40c9] hover:bg-[#8957e5] px-5 py-2.5 rounded-lg font-medium transition flex items-center gap-2"
            >
              <span>🔍</span> Compare Versions
            </button>
          )}
        </div>
      </div>

      {/* Collaborators */}
      {project.is_owner && (
        <div className="bg-[#161b22] border border-gray-800 rounded-xl p-4 mb-6">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">👥 Collaborators</h2>
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="text-xs bg-[#21262d] px-2 py-1 rounded-full text-gray-400">
              @{project.owner?.username} <span className="text-gray-600">owner</span>
            </span>
            {project.collaborators.map((c) => (
              <span key={c.id} className="text-xs bg-[#21262d] px-2 py-1 rounded-full text-gray-400 flex items-center gap-1">
                @{c.username}
                <button
                  onClick={() => removeCollaborator(c.id)}
                  className="text-gray-600 hover:text-red-400 ml-1 transition"
                >×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={collabInput}
              onChange={(e) => setCollabInput(e.target.value)}
              placeholder="Add by username"
              className="bg-[#0d1117] border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:border-[#58a6ff] outline-none transition"
              onKeyDown={(e) => e.key === "Enter" && addCollaborator()}
            />
            <button
              onClick={addCollaborator}
              disabled={!collabInput.trim()}
              className="text-sm bg-[#21262d] hover:bg-[#30363d] disabled:opacity-40 px-3 py-1.5 rounded-lg border border-gray-700 transition"
            >
              Add
            </button>
          </div>
          {collabError && <p className="text-red-400 text-xs mt-2">{collabError}</p>}
        </div>
      )}

      {/* Upload Zone */}
      {canWrite ? (
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          className={`border-2 border-dashed rounded-xl p-10 text-center mb-6 transition-all ${
            dragging ? "border-[#58a6ff] bg-[#58a6ff]/5 scale-[1.01]" : "border-gray-700 hover:border-gray-500"
          }`}
        >
          {uploading ? (
            <p className="text-[#58a6ff]">Uploading...</p>
          ) : (
            <>
              <div className="text-4xl mb-3">📁</div>
              <p className="text-gray-400 mb-2">Drag & drop images here</p>
              <label className="cursor-pointer inline-block bg-[#21262d] hover:bg-[#30363d] border border-gray-700 px-4 py-2 rounded-lg text-sm transition">
                Browse Files
                <input type="file" multiple accept="image/*" onChange={onFileSelect} className="hidden" />
              </label>
              <p className="text-gray-600 text-xs mt-2">PNG, JPG, SVG, WebP supported</p>
            </>
          )}
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-800 rounded-xl p-10 text-center mb-6 opacity-50 cursor-not-allowed">
          <div className="text-4xl mb-3">🔒</div>
          <p className="text-gray-500 text-sm">You don't have write access to this project</p>
          <p className="text-gray-600 text-xs mt-1">Ask the owner to add you as a collaborator</p>
        </div>
      )}

      {/* Staged Files */}
      {(staged.length > 0 || stagedRemovals.size > 0) && (
        <div className="bg-[#161b22] border border-[#238636] rounded-xl p-5 mb-6">
          <h3 className="text-sm font-semibold text-[#3fb950] mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-[#3fb950] rounded-full animate-pulse" />
            Staged Changes — {staged.length + stagedRemovals.size} file{staged.length + stagedRemovals.size > 1 ? "s" : ""}
          </h3>

          <div className="flex gap-3 flex-wrap mb-4">
            {[...stagedRemovals].map((filename) => {
              const snap = project.commits
                .flatMap((c) => c.snapshots)
                .find((s) => s.filename === filename);
              return snap ? (
                <div key={filename} className="relative group">
                  <img src={api.storageUrl(snap.storage_path)} alt={filename} className="w-24 h-24 object-cover rounded-lg border border-red-800 opacity-50" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-red-400 text-3xl font-bold">−</span>
                  </div>
                  <button
                    onClick={() => setStagedRemovals((prev) => { const n = new Set(prev); n.delete(filename); return n; })}
                    className="absolute -top-2 -right-2 bg-gray-700 hover:bg-gray-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  >×</button>
                  <p className="text-xs text-red-400 mt-1 truncate w-24">{filename}</p>
                </div>
              ) : null;
            })}
            {staged.map((s, i) => (
              <div key={i} className="relative group">
                <img
                  src={api.storageUrl(s.storage_path)}
                  alt={s.filename}
                  className="w-24 h-24 object-cover rounded-lg border border-gray-700"
                />
                <button
                  onClick={() => removeStaged(i)}
                  className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-500 text-white rounded-full 
                             w-5 h-5 text-xs flex items-center justify-center
                             opacity-0 group-hover:opacity-100 transition"
                >
                  ×
                </button>
                <p className="text-xs text-gray-400 mt-1 truncate w-24">
                  {s.filename}
                </p>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Commit message... (e.g. 'Updated hero banner')"
              className="flex-1 bg-[#0d1117] border border-gray-700 rounded-lg px-4 py-2.5 
                         focus:border-[#58a6ff] outline-none transition"
              onKeyDown={(e) => e.key === "Enter" && commit()}
            />
            <button
              onClick={commit}
              disabled={!message.trim()}
              className="bg-[#238636] hover:bg-[#2ea043] disabled:opacity-40 disabled:cursor-not-allowed
                         px-6 py-2.5 rounded-lg font-medium transition"
            >
              ✓ Commit
            </button>
          </div>
        </div>
      )}

      {/* Files List */}
      {project.commits.length > 0 && (() => {
        const fileMap = new Map();
        [...project.commits].reverse().forEach((c) =>
          c.snapshots.forEach((s) => {
            fileMap.set(s.filename, { snap: s, count: (fileMap.get(s.filename)?.count ?? 0) + 1 });
          })
        );
        // Only show files present in the latest commit
        const latestSnaps = new Set(project.commits[0]?.snapshots.map((s) => s.filename) ?? []);
        const files = [...fileMap.entries()].filter(([name]) => latestSnaps.has(name));
        return (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span>🗂️</span> Files
              <span className="text-sm font-normal text-gray-500">({files.length})</span>
            </h2>
            <div className="bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden">
              {files.map(([name, { snap, count }], i) => (
                <div
                  key={name}
                  className={`flex items-center gap-4 px-4 py-3 hover:bg-[#1c2128] transition ${i < files.length - 1 ? "border-b border-gray-800" : ""}`}
                >
                  <img
                    src={api.storageUrl(snap.storage_path)}
                    alt={name}
                    className="w-10 h-10 object-cover rounded border border-gray-700 cursor-pointer"
                    onClick={() => window.open(api.storageUrl(snap.storage_path), "_blank")}
                  />
                  <a href={api.storageUrl(snap.storage_path)} target="_blank" rel="noopener noreferrer" className="flex-1 text-sm text-gray-200 truncate hover:underline">
                    {name}
                  </a>
                  <span className="text-xs text-gray-500">{count} version{count > 1 ? "s" : ""}</span>
                  {canWrite && (
                    <button
                      onClick={() => setStagedRemovals((prev) => {
                        const n = new Set(prev);
                        n.has(name) ? n.delete(name) : n.add(name);
                        return n;
                      })}
                      className={`text-xs px-2 py-1 rounded transition ${
                        stagedRemovals.has(name)
                          ? "bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30"
                          : "text-gray-600 hover:text-red-400 border border-transparent hover:border-red-500/30"
                      }`}
                      title={stagedRemovals.has(name) ? "Unstage removal" : "Stage for removal"}
                    >
                      {stagedRemovals.has(name) ? "− staged" : "− remove"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Commit Timeline */}
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span>📜</span> Commit History
        <span className="text-sm font-normal text-gray-500">
          ({project.commits.length})
        </span>
      </h2>

      {project.commits.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <div className="text-5xl mb-3">⏳</div>
          <p>No commits yet</p>
          <p className="text-sm text-gray-600">
            Upload files and make your first commit
          </p>
        </div>
      ) : (
        <div className="relative ml-2">
          {/* Vertical line */}
          <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-800" />

          {project.commits.map((c, i) => (
            <div key={c.id} className="relative pl-12 pb-6 group">
              {/* Dot */}
              <div
                className={`absolute left-[8px] top-2 w-4 h-4 rounded-full border-2 border-[#0d1117] z-10 ${
                  i === 0 ? "bg-[#3fb950]" : "bg-gray-600"
                }`}
              />

              <div className="bg-[#161b22] border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="font-medium text-gray-200">
                      {c.message}
                    </span>
                    {i === 0 && (
                      <span className="ml-2 text-xs bg-[#238636]/20 text-[#3fb950] px-2 py-0.5 rounded-full">
                        latest
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-600">
                      {c.id}
                    </span>
                    {i > 0 && canWrite && (
                      <button
                        onClick={() => rollback(c.id)}
                        className="text-xs text-gray-600 hover:text-yellow-400 opacity-0 group-hover:opacity-100 transition"
                        title="Rollback to this commit"
                      >
                        ↩ rollback
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-gray-500 mb-3">
                  {new Date(c.created_at + "Z").toLocaleString()}
                  {c.committer_username && (
                    <span className="ml-2 text-gray-600">by <span className="text-gray-400">@{c.committer_username}</span></span>
                  )}
                </p>

                <div className="flex gap-2 flex-wrap">
                  {c.snapshots.map((s) => (
                    <div key={s.id} className="relative group/img">
                      <img
                        src={api.storageUrl(s.storage_path)}
                        alt={s.filename}
                        className="w-28 h-28 object-cover rounded-lg border border-gray-700 
                                   hover:border-[#58a6ff] transition cursor-pointer"
                        onClick={() =>
                          window.open(api.storageUrl(s.storage_path), "_blank")
                        }
                      />
                      <p className="text-xs text-gray-500 mt-1 truncate w-28">
                        {s.filename}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
