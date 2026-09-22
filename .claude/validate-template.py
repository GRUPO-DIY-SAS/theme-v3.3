"""Valida templates/*.json contra el schema de cada seccion y bloque.

Shopify rechaza el template ENTERO por un solo valor invalido, y el sync de
GitHub no lo reintenta: el archivo se queda congelado en produccion sin aviso.
Este script reproduce las validaciones que mas nos han mordido (range fuera de
rango o fuera de step, select con valor inexistente, tipo de bloque no
declarado) antes de hacer push.

Uso: python3 validate-template.py <ruta-al-tema> [template ...]
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else '.')
TEMPLATES = sys.argv[2:] or ['templates/index.json']


def load_json_with_banner(path):
    raw = path.read_text()
    return json.loads(re.sub(r'^\s*/\*.*?\*/\s*', '', raw, flags=re.S))


def schema_of(liquid_path):
    if not liquid_path.exists():
        return None
    m = re.search(r'\{%\s*schema\s*%\}(.*?)\{%\s*endschema\s*%\}',
                  liquid_path.read_text(), re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return None


def index_settings(defs):
    return {s['id']: s for s in (defs or []) if s.get('id')}


def check(values, defs, where, problems):
    for key, val in (values or {}).items():
        spec = defs.get(key)
        if not spec:
            continue
        kind = spec.get('type')
        if kind == 'range' and isinstance(val, (int, float)):
            lo, hi, step = spec.get('min', 0), spec.get('max', 0), spec.get('step', 1)
            if not (lo <= val <= hi):
                problems.append(f'{where}.{key} = {val} fuera de [{lo}, {hi}]')
            elif step and abs(((val - lo) / step) - round((val - lo) / step)) > 1e-9:
                problems.append(f'{where}.{key} = {val} no cae en el paso de {step} (desde {lo})')
        elif kind == 'select' and spec.get('options'):
            allowed = [o['value'] for o in spec['options']]
            if val not in allowed:
                problems.append(f'{where}.{key} = {val!r} no esta en {allowed}')


problems = []
for tpl in TEMPLATES:
    data = load_json_with_banner(ROOT / tpl)
    for sid, section in data.get('sections', {}).items():
        sch = schema_of(ROOT / 'sections' / f"{section['type']}.liquid")
        if not sch:
            problems.append(f'{tpl}:{sid} sin schema para "{section["type"]}"')
            continue
        check(section.get('settings'), index_settings(sch.get('settings')),
              f'{tpl}:{sid}', problems)

        declared = {b['type'] for b in sch.get('blocks', []) or []}
        block_defs = {b['type']: index_settings(b.get('settings'))
                      for b in sch.get('blocks', []) or []}
        for bid, block in (section.get('blocks') or {}).items():
            btype = block.get('type')
            if declared and btype not in declared and '@app' not in declared:
                # los bloques de tema (carpeta /blocks) no se declaran en la seccion
                if not (ROOT / 'blocks' / f'{btype}.liquid').exists():
                    problems.append(f'{tpl}:{sid}.{bid} tipo "{btype}" no declarado')
                    continue
            defs = block_defs.get(btype)
            if defs is None:
                defs = index_settings((schema_of(ROOT / 'blocks' / f'{btype}.liquid') or {}).get('settings'))
            check(block.get('settings'), defs, f'{tpl}:{sid}.{bid}', problems)


def check_lcp_preload(root, problems):
    """El preload del <head> debe apuntar al hero que realmente se pinta.

    Si no coinciden, el navegador descarga una imagen que la pagina no usa y
    descubre la real tarde: el load delay del LCP se dispara ~2s.
    """
    tpl = ROOT / 'templates' / 'index.json'
    cfg = ROOT / 'config' / 'settings_data.json'
    if not (tpl.exists() and cfg.exists()):
        return
    hero = load_json_with_banner(tpl).get('sections', {}).get('hero', {}).get('settings', {})
    cur = load_json_with_banner(cfg).get('current', {})
    for setting, key in (('home_lcp_image', 'image'), ('home_lcp_image_mobile', 'image_mobile')):
        pre, real = cur.get(setting), hero.get(key)
        if pre and real and pre != real:
            problems.append(f'preload {setting} = {pre} pero el hero usa {real}')


check_lcp_preload(ROOT, problems)

if problems:
    print(f'{len(problems)} problema(s):')
    for p in problems:
        print('  -', p)
    sys.exit(1)
print('Todos los ajustes son validos.')
