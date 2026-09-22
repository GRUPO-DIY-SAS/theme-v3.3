"""Compara los archivos que Shopify tiene en un tema contra el repo.

El sync de GitHub rechaza archivos en silencio y no los reintenta hasta que
cambian; los que falten aqui son los rechazados. Para ver el motivo exacto,
subirlos con themeFilesUpsert a un themeDuplicate desechable (devuelve
userErrors por archivo) y borrarlo.

Uso: python3 .claude/qa/sync-check.py <store.myshopify.com> <theme numeric id>
Requiere `shopify store auth --store <store> --scopes read_themes,write_themes`.
"""
import json, subprocess, sys, tempfile, os
store, tid = sys.argv[1], f"gid://shopify/OnlineStoreTheme/{sys.argv[2]}"
repo = subprocess.run(['git', 'ls-files'], capture_output=True, text=True).stdout.split()
local = {f for f in repo if f.split('/')[0] in ('assets', 'blocks', 'config', 'layout', 'locales', 'sections', 'snippets', 'templates')}
names, after, tmp = [], None, tempfile.mkdtemp()
for _ in range(8):
    q = 'query { theme(id: "%s") { files(first: 250%s) { nodes { filename } pageInfo { hasNextPage endCursor } } } }' % (tid, (', after: "%s"' % after) if after else '')
    qf, of = os.path.join(tmp, 'q.graphql'), os.path.join(tmp, 'o.json')
    open(qf, 'w').write(q)
    subprocess.run(['shopify', 'store', 'execute', '--store', store, '--query-file', qf, '--json', '--output-file', of], capture_output=True)
    d = json.load(open(of))['theme']['files']
    names += [n['filename'] for n in d['nodes']]
    if not d['pageInfo']['hasNextPage']:
        break
    after = d['pageInfo']['endCursor']
remote = set(names)
missing, extra = sorted(local - remote), sorted(remote - local)
print(f"remote={len(remote)} local={len(local)} missing={len(missing)} extra={len(extra)}")
for m in missing: print("  MISSING", m)
for e in extra: print("  EXTRA  ", e)
sys.exit(1 if missing else 0)
