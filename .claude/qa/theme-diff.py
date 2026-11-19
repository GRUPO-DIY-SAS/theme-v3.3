#!/usr/bin/env python3
"""Compara el contenido (MD5) de un tema de Shopify contra una ref de git.

Uso: theme-diff.py <store.myshopify.com> <theme id> <git ref> [--repo <ruta>]
Lista archivos que faltan en el tema, sobran, o difieren en contenido.

sync-check.py solo compara nombres; este compara contenido y por eso encuentra los
archivos que el sync de GitHub dejo en una version vieja (caso real: cart-item.liquid
de DIY, seis meses desfasado). Los .json suelen diferir solo en formato.
Requiere `shopify store auth --store <store> --scopes read_themes,write_themes`.
"""
import hashlib, json, os, subprocess, sys, tempfile

store, tid, ref = sys.argv[1], f"gid://shopify/OnlineStoreTheme/{sys.argv[2]}", sys.argv[3]
repo = sys.argv[sys.argv.index('--repo') + 1] if '--repo' in sys.argv else os.getcwd()
DIRS = ('assets', 'blocks', 'config', 'layout', 'locales', 'sections', 'snippets', 'templates')

def git(*args, binary=False):
    out = subprocess.run(['git', '-C', repo, *args], capture_output=True, check=True).stdout
    return out if binary else out.decode()

local = {}
for line in git('ls-tree', '-r', ref, '--', *DIRS).splitlines():
    meta, name = line.split('\t', 1)
    local[name] = hashlib.md5(git('cat-file', 'blob', meta.split()[2], binary=True)).hexdigest()

tmp = tempfile.mkdtemp()
remote, after = {}, None
while True:
    q = 'query { theme(id: "%s") { files(first: 250%s) { nodes { filename checksumMd5 size updatedAt } pageInfo { hasNextPage endCursor } } } }' % (tid, (', after: "%s"' % after) if after else '')
    qf, of = os.path.join(tmp, 'q.graphql'), os.path.join(tmp, 'o.json')
    open(qf, 'w').write(q)
    subprocess.run(['shopify', 'store', 'execute', '--store', store, '--query-file', qf, '--json', '--output-file', of], capture_output=True)
    d = json.load(open(of))
    d = d.get('data', d)['theme']['files']
    for n in d['nodes']:
        remote[n['filename']] = n
    if not d['pageInfo']['hasNextPage']:
        break
    after = d['pageInfo']['endCursor']

missing = sorted(set(local) - set(remote))
extra = sorted(set(remote) - set(local))
differ = sorted(n for n in local if n in remote and remote[n]['checksumMd5'] != local[n])
code = [n for n in differ if not n.endswith('.json')]
print(f"tema={sys.argv[2]} ref={ref}: remoto={len(remote)} local={len(local)} faltan={len(missing)} sobran={len(extra)} difieren={len(differ)} (no-JSON: {len(code)})")
for n in missing: print('  FALTA  ', n)
for n in extra: print('  SOBRA  ', n, remote[n]['updatedAt'])
for n in differ: print('  DIFIERE', n, remote[n]['updatedAt'], remote[n]['size'])
