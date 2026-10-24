"""Sélection hors ligne des produits Open Food Facts les plus scannés en France.

1) Extraction (DuckDB lit seulement les colonnes utiles du fichier Parquet d'OFF sur Hugging Face) :
   SELECT code, product_name, brands, nutriments, serving_quantity, quantity, nutriscore_grade, unique_scans_n,
          list_filter(images, lambda x: x.key IN ('front_fr','front_en'))[1].rev AS front_rev, ...[1].key AS front_key
   FROM read_parquet('https://huggingface.co/datasets/openfoodfacts/product-database/resolve/main/food.parquet')
   WHERE list_contains(countries_tags, 'en:france') AND NOT no_nutrition_data AND NOT obsolete
   ORDER BY unique_scans_n DESC LIMIT 54000  -- ~40 000 produits gardés après filtrage
2) Conversion : python3 scripts/off-popular.py extraction.json src/data/off-fr.json [nombre]

Ligne produite : [code, nom, marque, kcal, prot, gluc, lip, sucres, fibres, AGS, sel, portion, unité, nutriscore, image]
Données Open Food Facts, licence ODbL.
"""
import json
import re
import sys

src, out = sys.argv[1], sys.argv[2]
limit = int(sys.argv[3]) if len(sys.argv) > 3 else 40000
rows, seen = [], set()
NON_EU = re.compile(r'^(0|1|6[0-9]|7[0-6]|77|78|79|8[5-9]|9[0-9])')


def nutr(n, name):
    for x in n or []:
        if x.get('name') == name and x.get('100g') is not None:
            return float(x['100g'])
    return None


def r(x):
    return None if x is None else round(x, 2)


for p in json.load(open(src)):
    code = (p.get('code') or '').strip()
    if not code.isdigit() or code in seen:
        continue
    # Écarte les produits de marchés non européens très scannés mais aussi étiquetés « France »
    # (préfixes GS1 : Maghreb, Moyen-Orient, Asie, Amériques…)
    if NON_EU.match(code.zfill(13)):
        continue
    names = {x['lang']: (x['text'] or '').strip() for x in p.get('product_name') or []}
    name = names.get('fr') or names.get('main') or names.get('en') or ''
    name = re.sub(r'\s+', ' ', name)
    if not name or len(name) > 90:
        continue
    n = p.get('nutriments')
    kcal = nutr(n, 'energy-kcal')
    if kcal is None:
        kj = nutr(n, 'energy-kj') or nutr(n, 'energy')
        kcal = kj / 4.184 if kj is not None else None
    prot, carbs, fat = nutr(n, 'proteins'), nutr(n, 'carbohydrates'), nutr(n, 'fat')
    if kcal is None or prot is None or carbs is None or fat is None:
        continue
    if not (0 <= kcal <= 950 and 0 <= prot <= 100 and 0 <= carbs <= 100 and 0 <= fat <= 100):
        continue
    brand = (p.get('brands') or '').split(',')[0].strip()
    unit = 'ml' if re.search(r'\d\s*(ml|cl|l)\b', p.get('quantity') or '', re.I) else 'g'
    try:
        serving = float(str(p.get('serving_quantity')).replace(',', '.'))
        serving = r(serving) if 0 < serving < 2000 else None
    except ValueError:
        serving = None
    grade = p.get('nutriscore_grade') if p.get('nutriscore_grade') in list('abcde') else None
    img = f"{p['front_key']}.{p['front_rev']}" if p.get('front_key') and p.get('front_rev') not in (None, 'None') else None
    seen.add(code)
    rows.append([code, name, brand, round(kcal), r(prot), r(carbs), r(fat), r(nutr(n, 'sugars')), r(nutr(n, 'fiber')),
                 r(nutr(n, 'saturated-fat')), r(nutr(n, 'salt')), serving, unit, grade, img])
    if len(rows) >= limit:
        break

json.dump(rows, open(out, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(rows), 'produits')
