#!/usr/bin/env python3
"""Regenerate library.md and wishlist.md from the CLI's JSON exports.

Reads ./library.json and ./wishlist.json (produced by `audible library export -f json`
and `audible wishlist export -f json`) and writes matching .md snapshots grouped and
sorted to be useful as a second-brain reference.

Run after every snapshot refresh. Idempotent.
"""
from __future__ import annotations

import json
from collections import Counter
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIB = ROOT / "library.json"
WL = ROOT / "wishlist.json"
LIB_MD = ROOT / "library.md"
WL_MD = ROOT / "wishlist.md"

URL_BASE = "https://www.audible.com/pd/"


def fmt_runtime(mins: int | None) -> str:
    if not mins:
        return "?"
    h, m = divmod(int(mins), 60)
    if h and m:
        return f"{h}h {m}m"
    if h:
        return f"{h}h"
    return f"{m}m"


def listening_status(rec: dict) -> str:
    if rec.get("is_finished"):
        return "Finished"
    if (rec.get("percent_complete") or 0) > 0:
        return "In progress"
    return "Not started"


def remaining(rec: dict) -> str:
    runtime = rec.get("runtime_length_min") or 0
    pc = rec.get("percent_complete") or 0
    if not runtime or pc <= 0 or pc >= 100:
        return ""
    left = round(runtime * (100 - pc) / 100)
    return f"{fmt_runtime(left)} left"


def title_link(rec: dict) -> str:
    title = rec["title"]
    return f"[{title}]({URL_BASE}{rec['asin']})"


def render_library(records: list[dict]) -> str:
    today = date.today().isoformat()
    by_status: dict[str, list[dict]] = {"Finished": [], "In progress": [], "Not started": []}
    for r in records:
        by_status[listening_status(r)].append(r)
    for v in by_status.values():
        v.sort(key=lambda r: r["title"].lower())

    lines: list[str] = []
    lines.append("# Audible Library — Comprehensive Reference")
    lines.append("")
    lines.append(
        f"_Snapshot: {today} · Source: `audible library export` · Total titles: **{len(records)}**_"
    )
    lines.append("")
    lines.append("## Summary")
    lines.append("")
    lines.append("| Listening status | Count |")
    lines.append("|---|---:|")
    for k in ("Finished", "In progress", "Not started"):
        lines.append(f"| {k} | {len(by_status[k])} |")
    lines.append("")
    lines.append("Legend: `[F]` Finished · `[~]` In progress · `[ ]` Not started")
    lines.append("")

    for status in ("In progress", "Not started", "Finished"):
        items = by_status[status]
        lines.append(f"## {status} ({len(items)})")
        lines.append("")
        for r in items:
            tag = {"Finished": "[F]", "In progress": "[~]", "Not started": "[ ]"}[status]
            lines.append(f"### {tag} {title_link(r)}")
            sub = r.get("subtitle")
            if sub:
                lines.append(f"_{sub}_")
            lines.append("")
            authors = r.get("authors") or "—"
            narrators = r.get("narrators") or "—"
            lines.append(f"- **Authors:** {authors}")
            lines.append(f"- **Narrators:** {narrators}")
            length = fmt_runtime(r.get("runtime_length_min"))
            left = remaining(r)
            length_line = f"- **Length:** {length}"
            if left:
                length_line += f" · {left}"
            pc = r.get("percent_complete")
            if pc is not None and not r.get("is_finished"):
                length_line += f" · {pc:.0f}%"
            lines.append(length_line)
            series = r.get("series_title")
            if series:
                seq = r.get("series_sequence")
                lines.append(f"- **Series:** {series}" + (f" #{seq}" if seq else ""))
            genres = r.get("genres")
            if genres:
                lines.append(f"- **Genres:** {genres}")
            rating = r.get("rating")
            num = r.get("num_ratings")
            if rating and rating != "-":
                lines.append(f"- **Rating:** {rating} ({num} ratings)")
            added = r.get("date_added") or r.get("purchase_date")
            if added:
                lines.append(f"- **Added:** {added[:10]}")
            release = r.get("release_date")
            if release:
                lines.append(f"- **Released:** {release[:10]}")
            lines.append(f"- **ASIN:** `{r['asin']}`")
            lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def render_wishlist(records: list[dict]) -> str:
    today = date.today().isoformat()
    # Newest additions first
    records_sorted = sorted(
        records,
        key=lambda r: (r.get("date_added") or "", r["title"]),
        reverse=True,
    )

    lines: list[str] = []
    lines.append("# Audible Wishlist — Reference")
    lines.append("")
    lines.append(
        f"_Snapshot: {today} · Source: `audible wishlist export` · Total items: **{len(records)}**_"
    )
    lines.append("")
    lines.append("Sorted by date added (newest first).")
    lines.append("")
    lines.append("| # | Title | Author | Length | Released | Rating |")
    lines.append("|---:|---|---|---|---|---:|")
    for i, r in enumerate(records_sorted, 1):
        rating = r.get("rating") or "-"
        num = r.get("num_ratings") or "-"
        rating_cell = f"{rating} ({num})" if rating != "-" else "-"
        title_cell = title_link(r)
        sub = r.get("subtitle")
        if sub:
            title_cell += f"<br/><sub>{sub}</sub>"
        length = fmt_runtime(r.get("runtime_length_min"))
        released = (r.get("release_date") or "")[:10] or "-"
        lines.append(
            f"| {i} | {title_cell} | {r.get('authors') or '-'} | {length} | {released} | {rating_cell} |"
        )
    return "\n".join(lines) + "\n"


def main() -> None:
    if not LIB.exists():
        raise SystemExit(f"missing {LIB} — run: audible library export -f json")
    if not WL.exists():
        raise SystemExit(f"missing {WL} — run: audible wishlist export -f json")

    lib = json.loads(LIB.read_text())
    wl = json.loads(WL.read_text())

    LIB_MD.write_text(render_library(lib))
    WL_MD.write_text(render_wishlist(wl))

    status_counts = Counter(listening_status(r) for r in lib)
    print(f"library.md: {len(lib)} titles ({dict(status_counts)})")
    print(f"wishlist.md: {len(wl)} items")


if __name__ == "__main__":
    main()
