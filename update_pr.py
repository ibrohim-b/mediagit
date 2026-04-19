import re

with open('/Users/ibrohim/ReactProjects/mediagit/frontend/src/pages/PRPage.jsx', 'r') as f:
    text = f.read()

# Add import
text = text.replace(
    'import { useParams, Link } from "react-router-dom";',
    'import { useParams, Link } from "react-router-dom";\nimport ProjectHeader from "../components/ProjectHeader";'
)

# Remove makeTabs
text = re.sub(r'const makeTabs[\s\S]*?\];\n', '', text, count=1)
text = text.replace('  const tabs             = makeTabs(id);\n', '')

# Replace rendering from return ( to </div> with ProjectHeader
header_re = re.compile(r'  return \(\n    <div\n      className="-mx-4 -mt-6"\n      style=\{\{ color: "#e6edf3", minHeight: "100vh", backgroundColor: "#0d1117" \}\}\n    >\n      \{/\* ══ Sticky Sub-Header ═══════════════════════════════════════════════════ \*/\}.*?(?=\{\/\* ══ Page Body ════════════════════════════════════════════════════════════ \*/\})', re.DOTALL)

replacement = '''  return (
    <div
      className="-mx-4 -mt-6"
      style={{ color: "#e6edf3", minHeight: "100vh", backgroundColor: "#0d1117" }}
    >
      <ProjectHeader project={project} activeTab="pull-requests" />

      '''

text = header_re.sub(replacement, text)

with open('/Users/ibrohim/ReactProjects/mediagit/frontend/src/pages/PRPage.jsx', 'w') as f:
    f.write(text)

print("Done")
