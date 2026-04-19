import re

with open('/Users/ibrohim/ReactProjects/mediagit/frontend/src/pages/CommitsPage.jsx', 'r') as f:
    text = f.read()

text = text.replace(
    'import { useParams, Link, useNavigate } from "react-router-dom";',
    'import { useParams, Link, useNavigate } from "react-router-dom";\nimport ProjectHeader from "../components/ProjectHeader";'
)

header_re = re.compile(r'  return \(\n    <div\n      className="min-h-screen"\n      style=\{\{ backgroundColor: "#0d1117", color: "#e6edf3" \}\}\n    >\n      <div className="max-w-4xl mx-auto px-4 py-6">\n        \{/\* ── Back link ───────────────────────────────────────────────────── \*/\}.*?(?=\{\/\* Heading row \*/\})', re.DOTALL)

replacement = '''  return (
    <div
      className="min-h-screen -mx-4 -mt-6"
      style={{ backgroundColor: "#0d1117", color: "#e6edf3" }}
    >
      <ProjectHeader project={project} activeTab="commits" />
      <div className="max-w-4xl mx-auto px-4 py-6 mt-6">
        {/* Page header */}
        <div className="mb-6">
          '''

text = header_re.sub(replacement, text)

with open('/Users/ibrohim/ReactProjects/mediagit/frontend/src/pages/CommitsPage.jsx', 'w') as f:
    f.write(text)

