const fs = require('fs');

let fileContent = fs.readFileSync('/Users/ibrohim/ReactProjects/mediagit/frontend/src/pages/ProjectView.jsx', 'utf8');

// Replace standard useState for activeTab with useSearchParams
fileContent = fileContent.replace(
  'import { useParams, useNavigate, Link } from "react-router-dom";',
  'import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";\nimport ProjectHeader from "../components/ProjectHeader";'
);

fileContent = fileContent.replace(
  'const [activeTab, setActiveTab] = useState("media"); // "media" | "commits" | "collaborators"',
  'const [searchParams, setSearchParams] = useSearchParams();\n  const activeTab = searchParams.get("tab") || "media";\n  const setActiveTab = (tab) => setSearchParams({ tab });'
);

// Remove the old breadcrumb and tab bar layout 
// Find the exact string from "{/* ── Breadcrumb" up to "COMMITS TAB" (but keep COMMITS TAB)
const breadcrumbRegex = /\{\/\* ── Breadcrumb ──.*?(?=\{\/\* ═══════════════════════════════════════════════════════════════════\s*COMMITS TAB)/s;
fileContent = fileContent.replace(breadcrumbRegex, '<ProjectHeader project={project} activeTab={activeTab} />\n      <div className="px-4 py-6 max-w-7xl mx-auto">\n      ');

// However, I need to make sure the ProjectView still has padding for content under the header, 
// because I replaced the entire container!
// Wait, ProjectView currently has:
// return (
//   <div className="min-h-screen" style={{ backgroundColor: "#0d1117", color: "#e6edf3" }}>
//     <div className="max-w-7xl mx-auto px-4 py-6">
//       {/* Breadcrumb ... */}

// So I should replace:
// <div className="max-w-7xl mx-auto px-4 py-6">
//   {/* ── Breadcrumb ... */} 
// with
// <ProjectHeader project={project} activeTab={activeTab} />
// <div className="max-w-7xl mx-auto px-4 py-6">

const breadcrumbRealRegex = /<div className="max-w-7xl mx-auto px-4 py-6">\s*\{\/\* ── Breadcrumb ──.*?<div className="flex gap-6 items-start">/s;

// Wait, doing this via regex might be brittle. I should use replacement chunks.
