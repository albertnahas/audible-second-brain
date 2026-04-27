#!/usr/bin/env python3
"""CI: hooks.json must declare a top-level "hooks" object."""
from __future__ import annotations

import json
import pathlib
import sys


def main() -> int:
    hooks_path = pathlib.Path('hooks/hooks.json')
    if not hooks_path.exists():
        return 0  # plugin without hooks is valid

    try:
        data = json.loads(hooks_path.read_text())
    except json.JSONDecodeError as exc:
        print(f'::error::hooks.json is not valid JSON: {exc}', file=sys.stderr)
        return 1

    if 'hooks' not in data:
        print('::error::hooks.json missing top-level "hooks" key', file=sys.stderr)
        return 1

    print(f'hooks.json OK — events: {sorted(data["hooks"].keys())}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
