#!/usr/bin/env python3
"""데이터셋 무결성/규모 회귀 테스트.

tools/validate_data.py 의 규칙 통과 여부 + 최소 규모/플래그십 항목 존재 여부를
확인한다 (요구사항.md #33 완료 기준 중 데이터 검증 관련 항목).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))

from common import load_all_entries  # noqa: E402
from validate_data import validate  # noqa: E402

# 요구사항/AGENTS.md 본문에 리버싱 예제로 직접 등장하는, 반드시 존재해야 하는 플래그십 항목
REQUIRED_IDS = [
    "c-strcmp",
    "c-strcspn",
    "c-memcmp",
    "c-fgets",
    "c-gets",
    "posix-mprotect",
    "win-virtualprotect",
    "ida-_byte",
    "ida-byref",
    "conv-fastcall",
    "ida-positive-sp",
    "reg-rsp",
    "reg-rbp",
    "pattern-stack-frame",
    "pattern-xor-loop",
    "compiler-stack-chk-fail",
    "crypto-sha256-h0",
    "crypto-fnv",
]

MIN_TOTAL_ENTRIES = 150


def main():
    entries, load_errors = load_all_entries()
    failed = False

    if load_errors:
        print(f"[test_data] 데이터 로드 오류 {len(load_errors)}건")
        for e in load_errors:
            print(f"  - {e}")
        failed = True

    errors, warnings = validate(entries)
    if errors:
        print(f"[test_data] validate_data 규칙 위반 {len(errors)}건 (상위 20개만 표시)")
        for e in errors[:20]:
            print(f"  - {e}")
        failed = True
    else:
        print(f"[test_data] validate_data 규칙: OK ({len(entries)}개 항목)")

    ids = {e.get("id") for e in entries}
    missing = [rid for rid in REQUIRED_IDS if rid not in ids]
    if missing:
        print(f"[test_data] 필수 플래그십 항목 누락: {missing}")
        failed = True
    else:
        print(f"[test_data] 필수 플래그십 항목 {len(REQUIRED_IDS)}개 모두 존재: OK")

    if len(entries) < MIN_TOTAL_ENTRIES:
        print(f"[test_data] 전체 항목 수 {len(entries)}개 < 최소 기준 {MIN_TOTAL_ENTRIES}개")
        failed = True
    else:
        print(f"[test_data] 전체 항목 수 {len(entries)}개 >= 최소 기준 {MIN_TOTAL_ENTRIES}개: OK")

    if failed:
        print("\n[test_data] FAILED")
        return 1
    print("\n[test_data] PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
