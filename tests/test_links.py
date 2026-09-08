#!/usr/bin/env python3
"""related 링크 무결성 + 빌드 산출물(entries.js/search-index.js) 일관성 테스트.

- data/*.json 의 related 배열이 가리키는 id가 실제로 존재하는지 (broken link)
- data/generated/entries.js 와 data/generated/search-index.js 에 담긴 id 집합이
  원본 data/*.json 의 id 집합과 정확히 일치하는지 (빌드 누락/불일치 방지)
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))

from common import GENERATED_DIR, load_all_entries  # noqa: E402


def extract_json_assignment(js_path, var_name):
    text = js_path.read_text(encoding="utf-8")
    marker = f"window.{var_name} = "
    idx = text.index(marker)
    payload = text[idx + len(marker):].rstrip()
    if payload.endswith(";"):
        payload = payload[:-1]
    return json.loads(payload)


def main():
    entries, load_errors = load_all_entries()
    if load_errors:
        print(f"[test_links] 데이터 로드 오류 {len(load_errors)}건 - 먼저 validate_data.py를 통과시키세요.")
        return 1

    ids = {e["id"] for e in entries if e.get("id")}
    failed = False

    broken = []
    for e in entries:
        for rel in e.get("related") or []:
            if rel not in ids:
                broken.append((e.get("id"), rel))
    if broken:
        print(f"[test_links] broken related 링크 {len(broken)}건")
        for src, rel in broken[:20]:
            print(f"  - {src} -> {rel}")
        failed = True
    else:
        print(f"[test_links] related 링크 무결성: OK ({len(ids)}개 id)")

    entries_js = GENERATED_DIR / "entries.js"
    index_js = GENERATED_DIR / "search-index.js"
    if not entries_js.exists() or not index_js.exists():
        print("[test_links] data/generated/*.js 가 없습니다. `python3 tools/build.py` 를 먼저 실행하세요.")
        return 1

    built_entries = extract_json_assignment(entries_js, "REVLIBC_DATA")
    built_index = extract_json_assignment(index_js, "REVLIBC_SEARCH_INDEX")

    built_ids = {e["id"] for e in built_entries}
    index_ids = set(built_index.keys())

    if built_ids != ids:
        missing_in_build = ids - built_ids
        extra_in_build = built_ids - ids
        print("[test_links] entries.js 의 id 집합이 원본 데이터와 다릅니다 (재빌드 필요).")
        if missing_in_build:
            print(f"  원본에는 있지만 빌드 산출물에 없음: {sorted(missing_in_build)[:10]}")
        if extra_in_build:
            print(f"  빌드 산출물에만 있음(오래된 빌드): {sorted(extra_in_build)[:10]}")
        failed = True
    else:
        print(f"[test_links] entries.js id 일치: OK ({len(built_ids)}개)")

    if index_ids != ids:
        print("[test_links] search-index.js 의 id 집합이 원본 데이터와 다릅니다 (재빌드 필요).")
        failed = True
    else:
        print(f"[test_links] search-index.js id 일치: OK ({len(index_ids)}개)")

    if failed:
        print("\n[test_links] FAILED")
        return 1
    print("\n[test_links] PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
