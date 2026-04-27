#!/usr/bin/env python3
"""CI: every SKILL.md must have YAML frontmatter with `name` and `description`."""
from __future__ import annotations

import pathlib
import re
import sys


def main() -> int:
    skills_dir = pathlib.Path('skills')
    skills = list(skills_dir.rglob('SKILL.md'))
    if not skills:
        print('::warning::no skills found under skills/', file=sys.stderr)
        return 0

    failures: list[str] = []
    for skill in skills:
        text = skill.read_text()
        if not text.startswith('---'):
            failures.append(f'{skill}: missing YAML frontmatter')
            continue
        match = re.search(r'^---\n(.*?)\n---', text, re.DOTALL)
        if not match:
            failures.append(f'{skill}: malformed frontmatter')
            continue
        fm = match.group(1)
        if 'name:' not in fm:
            failures.append(f'{skill}: missing "name:" field')
        if 'description:' not in fm:
            failures.append(f'{skill}: missing "description:" field')

    if failures:
        for failure in failures:
            print(f'::error::{failure}', file=sys.stderr)
        return 1

    print(f'All {len(skills)} skill(s) OK')
    return 0


if __name__ == '__main__':
    sys.exit(main())
