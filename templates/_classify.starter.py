"""Classify books into clusters using Claude Haiku via the headless CLI.

Reads library.json + wishlist.json, classifies each book whose ASIN isn't
already cached in classifications.json, persists incrementally.

Run from the workspace root:
    python3 _classify.py            # classify any uncached books
    python3 _classify.py --force    # re-classify everything

The CLI must be authenticated (`claude --version` should work).
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path('.')
CACHE_PATH = ROOT / 'classifications.json'
BATCH_SIZE = 20
MODEL = 'claude-haiku-4-5'

CLUSTERS: dict[str, str] = {
    'software_engineering': 'Programming, software architecture, infra, dev culture, engineering practice. Hands-on technical books.',
    'ai_society': "AI as societal force — alignment, policy, AI critique, AI history. NOT hands-on ML implementation.",
    'cognition': 'Decision-making, cognitive biases, behavioral economics, judgment, rationality, mental models.',
    'psychology_health': 'Trauma, somatic work, mental health, therapy, anxiety, mind-body practices.',
    'habits_productivity': 'Habits, focus, routines, deep work, motivation, behavior change, self-discipline.',
    'leadership_influence': 'Influence, persuasion, negotiation, organizational power, strategy, leadership style.',
    'economics_finance': 'Personal finance, investing, markets, macroeconomics, money, wealth, economic history.',
    'philosophy_spirituality': 'Meditation, consciousness, religion, ethics, presence, contemplative practice.',
    'history_civilization': 'Big-picture human history, civilization, anthropology, sociology, political/social history.',
    'science_evolution': 'Genes, biology, evolution, neuroscience, natural sciences, physics.',
    'other': "Fiction, language learning, parody, biography of a single person, anything that doesn't fit above.",
}


def build_prompt(books: list[dict]) -> str:
    cluster_lines = '\n'.join(f'- {k}: {v}' for k, v in CLUSTERS.items())
    book_lines = []
    for i, b in enumerate(books, start=1):
        title = b.get('title') or ''
        author = b.get('authors') or b.get('author') or ''
        subtitle = b.get('subtitle') or '(none)'
        genres = (b.get('genres') or '')[:300]
        book_lines.append(f'{i}. "{title}" by {author} | subtitle: {subtitle} | genres: {genres}')
    book_block = '\n'.join(book_lines)
    return (
        f'Classify each audiobook into exactly ONE of the clusters below. Pick the cluster that best '
        f'matches the BOOK\'S ACTUAL CONTENT — Audible\'s genre tags are noisy umbrellas, so consider '
        f'title, subtitle, and author together.\n\n'
        f'Clusters:\n{cluster_lines}\n\n'
        f'Books:\n{book_block}\n\n'
        f'Output ONLY a JSON array of {len(books)} cluster slug strings (lowercase, with underscores) '
        f'in the same order as the books above. No prose, no explanation, no markdown fences.'
    )


def classify_batch(books: list[dict]) -> list[str]:
    prompt = build_prompt(books)
    result = subprocess.run(
        ['claude', '-p', prompt, '--model', MODEL],
        capture_output=True, text=True, timeout=180,
    )
    if result.returncode != 0:
        raise RuntimeError(f'claude CLI failed (exit {result.returncode}): {result.stderr.strip()}')
    text = result.stdout.strip()
    # Strip markdown fences if Haiku decides to wrap anyway.
    if text.startswith('```'):
        lines = text.split('\n')
        text = '\n'.join(lines[1:-1] if lines[-1].startswith('```') else lines[1:])
    try:
        clusters = json.loads(text)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f'classifier returned non-JSON: {text[:200]}') from exc
    if not isinstance(clusters, list):
        raise RuntimeError(f'classifier returned non-array: {text[:200]}')
    valid = set(CLUSTERS)
    cleaned = []
    for c in clusters:
        if not isinstance(c, str):
            cleaned.append('other')
            continue
        c = c.strip().lower()
        cleaned.append(c if c in valid else 'other')
    return cleaned


def load_cache() -> dict[str, str]:
    if CACHE_PATH.exists():
        try:
            return json.loads(CACHE_PATH.read_text())
        except json.JSONDecodeError:
            print(f'warning: {CACHE_PATH} is corrupt — starting fresh', file=sys.stderr)
    return {}


def save_cache(cache: dict[str, str]) -> None:
    CACHE_PATH.write_text(json.dumps(cache, indent=2, sort_keys=True))


def main() -> int:
    parser = argparse.ArgumentParser(description='Classify Audible books via Haiku.')
    parser.add_argument('--force', action='store_true', help='re-classify all books, ignoring cache')
    args = parser.parse_args()

    cache = {} if args.force else load_cache()

    library = json.loads((ROOT / 'library.json').read_text())
    wishlist = json.loads((ROOT / 'wishlist.json').read_text())
    all_books = library + wishlist
    by_asin = {b['asin']: b for b in all_books if b.get('asin')}

    todo = [b for b in by_asin.values() if b['asin'] not in cache]
    if not todo:
        print(f'All {len(by_asin)} books already classified — nothing to do.')
        return 0

    print(f'Classifying {len(todo)} of {len(by_asin)} books in batches of {BATCH_SIZE} via {MODEL}...')
    total_batches = (len(todo) + BATCH_SIZE - 1) // BATCH_SIZE
    for i in range(0, len(todo), BATCH_SIZE):
        batch = todo[i:i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        try:
            clusters = classify_batch(batch)
        except RuntimeError as exc:
            print(f'  batch {batch_num}/{total_batches} failed: {exc}', file=sys.stderr)
            continue
        if len(clusters) != len(batch):
            print(
                f'  batch {batch_num}/{total_batches} returned {len(clusters)} clusters for '
                f'{len(batch)} books — skipping',
                file=sys.stderr,
            )
            continue
        for b, c in zip(batch, clusters):
            cache[b['asin']] = c
        save_cache(cache)
        print(f'  batch {batch_num}/{total_batches} done ({len(clusters)} books)')

    print(f'Cached {len(cache)} classifications in {CACHE_PATH}')
    from collections import Counter
    print('Distribution:')
    for k, v in Counter(cache.values()).most_common():
        print(f'  {k:28s} {v:>4d}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
