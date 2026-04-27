#!/usr/bin/env python3
"""CI: validate .claude-plugin/plugin.json shape."""
from __future__ import annotations

import json
import pathlib
import re
import sys


def main() -> int:
    manifest = pathlib.Path('.claude-plugin/plugin.json')
    if not manifest.exists():
        print('::error::.claude-plugin/plugin.json missing', file=sys.stderr)
        return 1

    data = json.loads(manifest.read_text())

    for field in ('name', 'description'):
        if not data.get(field):
            print(f'::error::plugin.json missing required field: {field}', file=sys.stderr)
            return 1

    version = data.get('version')
    if version and not re.match(r'^\d+\.\d+\.\d+', version):
        print(f'::error::version "{version}" must be SemVer', file=sys.stderr)
        return 1

    print(
        f"plugin.json OK — name={data['name']} "
        f"version={data.get('version', 'unversioned')}"
    )
    return 0


if __name__ == '__main__':
    sys.exit(main())
