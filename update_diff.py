import re

with open('/Users/ibrohim/ReactProjects/mediagit/frontend/src/pages/DiffView.jsx', 'r') as f:
    text = f.read()

# Add import
text = text.replace(
    'import { useParams, Link, useSearchParams } from "react-router-dom";',
    'import { useParams, Link, useSearchParams } from "react-router-dom";\nimport ProjectHeader from "../components/ProjectHeader";'
)

# Remove makeTabs
text = re.sub(r'const makeTabs[\s\S]*?\];\n', '', text, count=1)
text = text.replace('const tabs = makeTabs(id);', '')

# Replace rendering from return ( to </div> with ProjectHeader
header_re = re.compile(r'  return \(\n    <div\n      className="-mx-4 -mt-6"\n      style=\{\{ color: "#e6edf3", minHeight: "100vh", backgroundColor: "#0d1117" \}\}\n    >\n      \{/\* ══ Sticky Sub-Header ══════════════════════════════════════════════ \*/\}.*?(?=\{\/\* ══ Main Content: sidebar \+ right area ════════════════════════════ \*/\})', re.DOTALL)

replacement = '''  return (
    <div
      className="-mx-4 -mt-6 flex flex-col"
      style={{ color: "#e6edf3", minHeight: "100vh", backgroundColor: "#0d1117" }}
    >
      <ProjectHeader project={project} activeTab="compare" />

      '''

text = header_re.sub(replacement, text)

with open('/Users/ibrohim/ReactProjects/mediagit/frontend/src/pages/DiffView.jsx', 'w') as f:
    f.write(text)

