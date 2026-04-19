import re

with open('/Users/ibrohim/ReactProjects/mediagit/frontend/src/pages/ProjectView.jsx', 'r') as f:
    text = f.read()

# Add imports
text = text.replace(
    'import { useParams, useNavigate, Link } from "react-router-dom";',
    'import { useParams, useNavigate, Link, useLocation } from "react-router-dom";\nimport ProjectHeader from "../components/ProjectHeader";'
)

# Extract activeTab from URL search (?tab=X), if none it defaults to media
text = text.replace(
    'const { user } = useAuth();',
    'const { user } = useAuth();\n  const location = useLocation();\n  const activeTab = new URLSearchParams(location.search).get("tab") || "media";'
)

# Replace header block
# From: {/* Header */} down to {canWrite ? (
header_re = re.compile(r'\{\/\* Header \*\/}.*?(?=\{\/\* Upload Zone \*\/})', re.DOTALL)
text = header_re.sub('<ProjectHeader project={project} activeTab={activeTab} />\n      <div className="max-w-7xl mx-auto px-4 py-6 text-[#e6edf3]">\n', text)

# Close the wrapper div
# Find the end of component
text = text.replace('    </div>\n  );\n}\n', '      </div>\n    </div>\n  );\n}\n')

with open('/Users/ibrohim/ReactProjects/mediagit/frontend/src/pages/ProjectView.jsx', 'w') as f:
    f.write(text)

print("Done")
