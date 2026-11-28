"""Reproducible lexical metrics; not a claim of exact AST cyclomatic complexity."""
import json,re,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
BASE='6e579f36ab3cc609428da1a27719fc65088fc384'
FILES=['communication.cjs','unified.js','unified.css','runner.cjs','speech-browser.cjs','quest-v2.browser.js']
PREFIX='prototype/common-engine-v2-audiofree/'
# Remove comments and quoted text before counting branch keywords/short circuits.
TOKENS=re.compile(r'''"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|//[^\n]*|/\*[\s\S]*?\*/''')
def metrics(text,file):
 clean=TOKENS.sub('',text)
 return {'lines':len(text.splitlines()),'bytes':len(text.encode()),
         'conditional_keywords':len(re.findall(r'\b(?:if|case|catch)\b',clean)) if not file.endswith('.css') else 0,
         'short_circuits':len(re.findall(r'&&|\|\|',clean)) if not file.endswith('.css') else 0}
rows=[]
for file in FILES:
 before=subprocess.check_output(['git','-C',str(ROOT),'show',BASE+':'+PREFIX+file]).decode()
 after=(ROOT/PREFIX/file).read_text()
 rows.append({'file':file,'generated':file=='quest-v2.browser.js','before':metrics(before,file),'after':metrics(after,file)})
print(json.dumps({'baseline':BASE,'definition':'Physical LOC, UTF-8 bytes, lexical if/case/catch after comments/string removal; short circuit separate; no AST/cyclomatic claim','files':rows},indent=2))
