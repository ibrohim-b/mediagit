import { Link } from "react-router-dom";
import { GitFork, BookImage, GitCommitHorizontal, GitBranch, GitPullRequest, Users, ArrowLeftRight } from "lucide-react";

export default function ProjectHeader({ project, activeTab }) {
  if (!project) return null;

  const tabs = [
    { key: "media",         Icon: BookImage,           label: "Media",         href: `/project/${project.id}#media` },
    { key: "commits",       Icon: GitCommitHorizontal, label: "Commits",       href: `/project/${project.id}#commits` },
    { key: "branches",      Icon: GitBranch,           label: "Branches",      href: `/project/${project.id}#branches` },
    { key: "pull-requests", Icon: GitPullRequest,      label: "Pull Requests", href: `/project/${project.id}#pull-requests` },
    { key: "collaborators", Icon: Users,               label: "Collaborators", href: `/project/${project.id}#collaborators` },
    { key: "compare",       Icon: ArrowLeftRight,      label: "Compare",       href: `/project/${project.id}/diff` },
  ].filter((t) => t.key !== "compare" || activeTab === "compare");

  return (
    <div
      className="bg-[#161b22] border-b border-[#30363d] px-4 w-full"
      style={{ position: "sticky", top: "64px", zIndex: 40 }}
    >
      <div className="flex items-center justify-between h-12 max-w-7xl mx-auto overflow-x-auto no-scrollbar">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm min-w-0 flex-shrink-0">
          <GitFork size={15} className="text-[#8b949e] flex-shrink-0" />
          <Link
            to="/dashboard"
            className="text-[#8b949e] hover:text-[#58a6ff] transition-colors font-medium truncate"
          >
            {project.owner?.username}
          </Link>
          <span className="text-[#8b949e] select-none flex-shrink-0">/</span>
          <Link
            to={`/project/${project.id}#media`}
            className="text-[#58a6ff] hover:text-[#79c0ff] transition-colors font-semibold truncate"
          >
            {project.name}
          </Link>
        </div>

        {/* Tab bar */}
        <nav className="flex items-center h-full flex-shrink-0 ml-4 gap-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Link
                key={tab.key}
                to={tab.href}
                style={{ height: "48px" }}
                className={`flex items-center gap-1.5 px-3 text-sm border-b-2 whitespace-nowrap transition-colors no-underline ${
                  isActive
                    ? "border-[#f78166] text-[#e6edf3] font-semibold"
                    : "border-transparent text-[#8b949e] hover:text-[#e6edf3] hover:border-[#8b949e]/30"
                }`}
              >
                <tab.Icon size={14} className={isActive ? "text-[#e6edf3]" : "text-[#8b949e]"} />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
