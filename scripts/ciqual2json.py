import sys, re, json, html
D, OUT = sys.argv[1], sys.argv[2]
alim = open(D + '/alim_2025_11_03.xml', encoding='utf-8-sig').read()
foods = {}
for m in re.finditer(r'<ALIM>(.*?)</ALIM>', alim, re.S):
    b = m.group(1)
    code = int(re.search(r'<alim_code>\s*(\d+)', b).group(1))
    name = html.unescape(re.sub(r'\s+', ' ', re.search(r'<alim_nom_fr>(.*?)</alim_nom_fr>', b, re.S).group(1)).strip())
    grp = re.search(r'<alim_grp_code>\s*(\d+)', b)
    foods[code] = {'n': name, 'g': grp.group(1) if grp else '00'}
WANT = {328: 'kcal', 327: 'kj', 25000: 'p', 31000: 'c', 40000: 'f', 32000: 's', 34100: 'fi', 40302: 'sf', 10004: 'salt'}
def val(t):
    t = t.strip().replace(',', '.')
    if t in ('-', ''): return None
    if t.lower() == 'traces' or t.startswith('<'): return 0.0
    try: return float(t)
    except ValueError: return None
compo = open(D + '/compo_2025_11_03.xml', encoding='utf-8-sig').read()
for m in re.finditer(r'<COMPO>(.*?)</COMPO>', compo, re.S):
    b = m.group(1)
    a = int(re.search(r'<alim_code>\s*(\d+)', b).group(1)); c = int(re.search(r'<const_code>\s*(\d+)', b).group(1))
    if c in WANT and a in foods:
        t = re.search(r'<teneur>(.*?)</teneur>', b, re.S)
        v = val(t.group(1)) if t else None
        if v is not None: foods[a][WANT[c]] = v
rows = []; skipped = []
for code, f in sorted(foods.items()):
    if f['g'] == '11': continue  # aliments infantiles
    kcal = f.get('kcal')
    if kcal is None and f.get('kj') is not None: kcal = f['kj'] / 4.184
    if kcal is None and all(k in f for k in ('p', 'c', 'f')):
        kcal = 4 * f['p'] + 4 * f['c'] + 9 * f['f'] + 2 * f.get('fi', 0)
    if kcal is None: skipped.append(f['n']); continue
    r = lambda x: None if x is None else round(x, 2)
    rows.append([code, f['n'], round(kcal), r(f.get('p', 0)), r(f.get('c', 0)), r(f.get('f', 0)), r(f.get('s')), r(f.get('fi')), r(f.get('sf')), r(f.get('salt'))])
json.dump(rows, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(rows), 'aliments ; sans énergie :', len(skipped), skipped[:8])
