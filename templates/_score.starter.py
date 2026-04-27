"""Score Audible library and wishlist items.

This is the **starter** rubric shipped by `bootstrap`. It is intentionally
generic — the author/anti-pattern lists below are mostly empty and the cluster
weights are rough defaults. Run `/audible-second-brain:calibrate` to replace
these values with evidence derived from your own completion data.

Reads canonical CLI exports (library.json / wishlist.json from `audible library
export` / `audible wishlist export`). Normalizes the audible-cli schema back into
the legacy field shape the dashboard expects so .scored.json keeps both sets of keys.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path('.')


def to_min(s):
    if isinstance(s, (int, float)):
        return int(s)
    if not s:
        return None
    h = re.search(r'(\d+)\s*h', s)
    m = re.search(r'(\d+)\s*m', s)
    if not h and not m:
        return None
    return (int(h.group(1)) if h else 0) * 60 + (int(m.group(1)) if m else 0)


def fmt_len(mins):
    if not mins:
        return ''
    h, m = divmod(int(mins), 60)
    if h and m:
        return f'{h}h {m}m'
    if h:
        return f'{h}h'
    return f'{m}m'


def normalize(b, source):
    """Augment a raw audible-cli record with legacy fields the scorer + dashboard expect."""
    runtime = b.get('runtime_length_min')
    pc = b.get('percent_complete') or 0
    if 'author' not in b:
        b['author'] = b.get('authors') or ''
    if 'narrator' not in b:
        b['narrator'] = b.get('narrators') or ''
    if 'length' not in b and runtime:
        b['length'] = fmt_len(runtime)
    if 'url' not in b:
        b['url'] = f"https://www.audible.com/pd/{b['asin']}"
    if 'description' not in b:
        b['description'] = ''  # CLI export drops publisher_summary
    if source == 'library':
        if 'listeningStatus' not in b:
            if b.get('is_finished'):
                b['listeningStatus'] = 'Finished'
            elif pc > 0:
                b['listeningStatus'] = 'In progress'
            else:
                b['listeningStatus'] = 'Not started'
        if 'remaining' not in b and runtime and 0 < pc < 100:
            b['remaining'] = fmt_len(round(runtime * (100 - pc) / 100))
        if 'availability' not in b:
            b['availability'] = 'Available'
    elif source == 'wishlist':
        if 'releaseDate' not in b:
            b['releaseDate'] = b.get('release_date') or ''
        if 'ratingsCount' not in b:
            b['ratingsCount'] = b.get('num_ratings') or 0
    return b


# ---------------------------------------------------------------------------
# Personalized lists — populated by `/audible-second-brain:calibrate` from your
# own completion data. Empty on a fresh install: the scorer falls back entirely
# to clusters, length, and anti-patterns until calibration runs.
# ---------------------------------------------------------------------------

HIGH_TRUST: set[str] = set()      # ≥ 2 finished AND completion ratio ≥ 0.6
SCHOOL_AUTHORS: set[str] = set()  # warm authors near a HIGH_TRUST cluster
UNTOUCHED_MAGNUM: dict[str, str] = {}  # author -> reason (e.g. "Principles unread")

EXPLICIT_PASS: set[str] = set()   # titles you explicitly never want resurfaced
PROMOTE_LIBRARY: set[str] = set() # library titles you want surfaced as KEEP regardless of score
PROMOTE_WISHLIST: set[str] = set() # wishlist titles you want surfaced as KEEP regardless of score

INSTITUTIONAL_AUTHORS: set[str] = {
    'Harvard Business Review', 'AudioLearn', 'BBC Studios',
    'SXSW Studios', 'Innovative Language Learning',
}

# Genre + keyword routing. These regexes match against
# title + author + description + genres (joined, case-insensitive).
# Order matters: first match wins.
CLUSTER_RULES = [
    ('software_craft', r'\b(software|engineer|architect|coding|kubernetes|devops|platform|microservice|continuous|staff engineer|tech lead|programmer|designing|clean code|scalab|tidy|refactor|team topolog|flow engineer|accelerate|computers? & technology|computer science)\b', +2),
    ('trauma', r'\b(trauma|nervous system|somatic|polyvagal|body keeps|vagus|cptsd|self-compassion|grief|psychotherapy|stress management|post-traumatic stress disorder|anxiety disorders|emotional & mental health)\b', +2),
    ('habits', r'\b(habit|productivity|focus|discipline|atomic|compound|deep work|mindset|routine|self-control|ultralearn|motivation & self-improvement|personal success|career success|self-development)\b', +2),
    ('power', r'\b(power|influence|persuasion|negotiat|seduction|strategy|leverage|machiavelli|laws of|fascinate|culture map|culture code|management & leadership|business development & entrepreneurship)\b', +2),
    ('ai_socio', r'\b(artificial intelligence|machine learning|chatgpt|llm|alignment|empire of|singularity|superintelligen|co-intelligence|nexus|ai con|ai valley|thinking machine|human compatible)\b', +1),
    ('cognition', r'\b(thinking|cognition|decision|bias|heuristic|judgment|rational|behavioral|nudge|elephant in the brain|decision-making & problem solving|social psychology|psychology & mental health|psychology)\b', +1),
    ('evolution', r'\b(evolution|gene|biolog|sapiens|homo|primal|hunter-gather|natural selection|brain|biological sciences|anthropology)\b', 0),
    ('spirituality', r'\b(meditation|spiritual|enlighten|consciousness|ego|presence|awakening|buddhi|zen|mindful|psychedelic|religion & spirituality)\b', 0),
    ('investing', r'\b(invest|finance|portfolio|market|wealth|money|stock|bond|economy|trading|broke|money & finance|economics)\b', 0),
]

# Anti-patterns: title or author regexes that hard-penalize.
# `calibrate` adds entries here based on "owned ≥ 3, finished 0" patterns.
ANTI_PATTERNS: list[tuple[str, int, str]] = []


def score_item(b):
    score = 0
    reasons: list[str] = []
    title = b.get('title') or ''
    author = b.get('author') or ''
    desc = (b.get('description') or '') + ' ' + (b.get('subtitle') or '')
    genres = b.get('genres') or ''
    blob = f'{title} {author} {desc} {genres}'.lower()
    length_min = to_min(b.get('length'))
    primary_authors = [a.strip() for a in author.split(',') if a.strip()]

    if any(a in HIGH_TRUST for a in primary_authors):
        score += 3
        reasons.append('+3 high-trust author')
    elif any(a in SCHOOL_AUTHORS for a in primary_authors):
        score += 2
        reasons.append('+2 author from proven school')

    for a in primary_authors:
        if a in UNTOUCHED_MAGNUM:
            score -= 2
            reasons.append(f'-2 {UNTOUCHED_MAGNUM[a]}')
            break

    if any(a in INSTITUTIONAL_AUTHORS for a in primary_authors):
        score -= 1
        reasons.append('-1 institutional author')

    cluster = None
    for name, pat, val in CLUSTER_RULES:
        if re.search(pat, blob, re.I):
            score += val
            cluster = name
            if val:
                reasons.append(f'{"+" if val >= 0 else ""}{val} cluster:{name}')
            break

    for pat, val, reason in ANTI_PATTERNS:
        if re.search(pat, title) or re.search(pat, author):
            score += val
            reasons.append(f'{val} {reason}')

    if length_min is not None:
        h = length_min / 60
        if 1 <= h < 3:
            score += 1
            reasons.append(f'+1 length {h:.1f}h very short')
        elif 3 <= h < 8:
            score += 2
            reasons.append(f'+2 length {h:.1f}h sweet spot')
        elif 8 <= h < 12 and cluster in ('software_craft', 'trauma', 'habits', 'power'):
            score += 1
            reasons.append(f'+1 length {h:.1f}h ok for cluster')
        elif h >= 15:
            ref_shape = (
                len(primary_authors) >= 3
                or 'guide' in title.lower()
                or 'principles' in title.lower()
            )
            if ref_shape:
                score -= 2
                reasons.append(f'-2 length {h:.1f}h reference-shaped')
            else:
                score -= 1
                reasons.append(f'-1 length {h:.1f}h above abandon-cliff')
        elif 12 <= h < 15 and cluster not in ('software_craft', 'trauma', 'habits', 'power'):
            score -= 1
            reasons.append(f'-1 length {h:.1f}h long without high-affinity cluster')

    if len(primary_authors) >= 4:
        score -= 1
        reasons.append(f'-1 multi-author ({len(primary_authors)} authors)')

    short_title = re.sub(r':.*', '', title).strip()
    if short_title in EXPLICIT_PASS or title in EXPLICIT_PASS:
        score = -10
        reasons.insert(0, 'EXPLICIT PASS')
    elif short_title in PROMOTE_LIBRARY or title in PROMOTE_LIBRARY:
        score = max(score, 6)
        reasons.insert(0, 'PROMOTE — predicted to land')
    elif short_title in PROMOTE_WISHLIST or title in PROMOTE_WISHLIST:
        score = max(score, 5)
        reasons.insert(0, 'PROMOTE — flagged in preferences.md')

    return score, reasons, cluster


def categorize_library(b, score):
    ls = b.get('listeningStatus')
    if score <= -3:
        return 'PASS'
    if ls == 'In progress':
        rem = to_min(b.get('remaining')) or 0
        if rem >= 600:
            return 'LATER' if score >= 1 else 'PASS'
        if rem >= 300:
            return 'LATER' if score < 2 else 'KEEP'
        return 'KEEP'
    if score <= 0:
        return 'PASS'
    if score <= 2:
        return 'LATER'
    return 'KEEP'


def categorize_wishlist(score):
    if score <= -1:
        return 'CUT'
    if score >= 4:
        return 'KEEP'
    return 'MAYBE'


def main() -> None:
    lib = [normalize(b, 'library') for b in json.loads((ROOT / 'library.json').read_text())]
    wl = [normalize(b, 'wishlist') for b in json.loads((ROOT / 'wishlist.json').read_text())]

    lib_out = []
    for b in lib:
        s, r, c = score_item(b)
        cat = categorize_library(b, s) if b.get('listeningStatus') in ('Not started', 'In progress') else None
        lib_out.append({
            **b, 'score': s, 'reasons': r, 'cluster': c, 'category': cat,
            'lengthMin': to_min(b.get('length')) or 0,
            'remainingMin': to_min(b.get('remaining')) or 0,
        })

    wl_out = []
    for b in wl:
        s, r, c = score_item(b)
        wl_out.append({
            **b, 'score': s, 'reasons': r, 'cluster': c,
            'category': categorize_wishlist(s),
            'lengthMin': to_min(b.get('length')) or 0,
        })

    (ROOT / 'library.scored.json').write_text(json.dumps(lib_out, indent=2, ensure_ascii=False))
    (ROOT / 'wishlist.scored.json').write_text(json.dumps(wl_out, indent=2, ensure_ascii=False))

    rec_path = ROOT / 'recommendations.json'
    if rec_path.exists():
        recs = [normalize(b, 'wishlist') for b in json.loads(rec_path.read_text())]
        rec_out = []
        for b in recs:
            s, r, c = score_item(b)
            rec_out.append({
                **b, 'score': s, 'reasons': r, 'cluster': c,
                'category': categorize_wishlist(s),
                'lengthMin': to_min(b.get('length')) or 0,
            })
        (ROOT / 'recommendations.scored.json').write_text(json.dumps(rec_out, indent=2, ensure_ascii=False))

    from collections import Counter
    print('Library categories:', Counter(b.get('category') for b in lib_out if b.get('category')))
    print('Wishlist categories:', Counter(b['category'] for b in wl_out))
    print('Wrote library.scored.json and wishlist.scored.json')


if __name__ == '__main__':
    main()
