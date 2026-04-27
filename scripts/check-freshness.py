#!/usr/bin/env python3
"""SessionStart hook: emit additionalContext when the local Audible snapshot
is stale or calibration is overdue. Silent (exit 0, no stdout) otherwise.

Reads ./.audible-snapshot.json from the current working directory. Claude Code
runs SessionStart hooks with cwd = $CLAUDE_PROJECT_DIR, so this works for the
expected workflow (project root contains the snapshot). If the user starts
Claude from a parent dir of an audible-second-brain workspace, the hook stays
silent — no false positives.
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import sys

SNAPSHOT = pathlib.Path('.audible-snapshot.json')
STALE_DAYS = 14
CALIBRATE_THRESHOLD = 20


def main() -> int:
    if not SNAPSHOT.exists():
        return 0

    try:
        data = json.loads(SNAPSHOT.read_text())
    except (json.JSONDecodeError, OSError):
        return 0

    notes: list[str] = []

    last_sync_raw = data.get('last_sync')
    if last_sync_raw:
        try:
            last_sync = dt.datetime.fromisoformat(last_sync_raw.replace('Z', '+00:00'))
            age_days = (dt.datetime.now(dt.timezone.utc) - last_sync).days
            if age_days >= STALE_DAYS:
                notes.append(
                    f'Audible snapshot is {age_days} days old — consider running '
                    '/audible-second-brain:sync to refresh.'
                )
        except ValueError:
            pass

    finished = int(data.get('books_finished') or 0)
    calibrated = bool(data.get('calibrated'))
    if not calibrated and finished >= CALIBRATE_THRESHOLD:
        notes.append(
            f'You have {finished} finished books and have not yet calibrated the rubric. '
            'Run /audible-second-brain:calibrate to personalize the scorer.'
        )

    if not notes:
        return 0

    payload = {
        'hookSpecificOutput': {
            'hookEventName': 'SessionStart',
            'additionalContext': ' '.join(notes),
        }
    }
    json.dump(payload, sys.stdout)
    return 0


if __name__ == '__main__':
    sys.exit(main())
