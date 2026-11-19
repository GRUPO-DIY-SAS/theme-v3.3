#!/usr/bin/env python3
"""Copias desechables de un tema para validar cambios servidos por Shopify.

  theme-copy.py create <store> <id tema origen> <nombre>
  theme-copy.py upsert <store> <id tema> <ref git | WORKTREE> <archivo> [<archivo>...]
  theme-copy.py delete <store> <id tema>
  theme-copy.py role   <store> <id tema>

Requiere `shopify store auth --store <store> --scopes read_themes,write_themes`.

Nunca escribe ni borra un tema con rol MAIN.
"""
import base64, json, os, subprocess, sys, tempfile, time

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TMP = tempfile.mkdtemp()

def gql(store, query, variables=None, mutation=False):
    qf, vf, of = (os.path.join(TMP, n) for n in ('q.graphql', 'v.json', 'o.json'))
    open(qf, 'w').write(query)
    cmd = ['shopify', 'store', 'execute', '--store', store, '--query-file', qf, '--json', '--output-file', of]
    if variables is not None:
        json.dump(variables, open(vf, 'w'))
        cmd += ['--variable-file', vf]
    if mutation:
        cmd.append('--allow-mutations')
    if os.path.exists(of):
        os.remove(of)
    run = subprocess.run(cmd, capture_output=True, text=True)
    if not os.path.exists(of):
        raise SystemExit(f"sin salida de la API: {run.stdout[-400:]} {run.stderr[-400:]}")
    data = json.load(open(of))
    return data.get('data', data)

def gid(theme_id):
    return f"gid://shopify/OnlineStoreTheme/{theme_id}"

def theme(store, theme_id):
    return gql(store, 'query T($id: ID!) { theme(id: $id) { id name role processing } }', {'id': gid(theme_id)})['theme']

def guard(store, theme_id):
    t = theme(store, theme_id)
    if not t:
        raise SystemExit(f"el tema {theme_id} no existe")
    if t['role'] == 'MAIN':
        raise SystemExit(f"NEGADO: {theme_id} es el tema publicado ({t['name']})")
    return t

cmd, store = sys.argv[1], sys.argv[2]
if cmd == 'role':
    print(json.dumps(theme(store, sys.argv[3])))
elif cmd == 'create':
    src, name = sys.argv[3], sys.argv[4]
    out = gql(store, 'mutation D($id: ID!, $name: String) { themeDuplicate(id: $id, name: $name) { newTheme { id name role } userErrors { field message } } }', {'id': gid(src), 'name': name}, mutation=True)['themeDuplicate']
    if out['userErrors']:
        raise SystemExit(f"userErrors: {out['userErrors']}")
    new_id = out['newTheme']['id'].split('/')[-1]
    for _ in range(40):
        t = theme(store, new_id)
        if t and not t['processing']:
            break
        time.sleep(3)
    print(new_id, t['role'], t['name'])
elif cmd == 'upsert':
    theme_id, ref, files = sys.argv[3], sys.argv[4], sys.argv[5:]
    guard(store, theme_id)
    def body(path):
        if ref == 'WORKTREE':
            return open(os.path.join(REPO, path), 'rb').read()
        return subprocess.run(['git', '-C', REPO, 'show', f'{ref}:{path}'], capture_output=True, check=True).stdout
    ok, bad = [], []
    for i in range(0, len(files), 4):
        chunk = [{'filename': f, 'body': {'type': 'BASE64', 'value': base64.b64encode(body(f)).decode()}} for f in files[i:i + 4]]
        out = gql(store, 'mutation U($id: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) { themeFilesUpsert(themeId: $id, files: $files) { upsertedThemeFiles { filename } userErrors { filename code message } } }', {'id': gid(theme_id), 'files': chunk}, mutation=True)['themeFilesUpsert']
        ok += [f['filename'] for f in out['upsertedThemeFiles'] or []]
        bad += out['userErrors'] or []
    print(f"aceptados {len(ok)}/{len(files)}")
    for f in ok: print('  OK   ', f)
    for e in bad: print('  ERROR', e.get('filename'), e.get('code'), (e.get('message') or '')[:300])
    sys.exit(1 if bad else 0)
elif cmd == 'delete':
    theme_id = sys.argv[3]
    t = guard(store, theme_id)
    out = gql(store, 'mutation X($id: ID!) { themeDelete(id: $id) { deletedThemeId userErrors { field message } } }', {'id': gid(theme_id)}, mutation=True)['themeDelete']
    print('borrado' if out['deletedThemeId'] else f"userErrors: {out['userErrors']}", t['name'])
else:
    raise SystemExit(__doc__)
