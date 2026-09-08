#!/usr/bin/env python3
"""tests/ 아래 모든 테스트를 순서대로 실행한다.

사용법:
    python3 tools/build.py   # 먼저 빌드
    python3 tests/run_all.py
"""
import subprocess
import sys
from pathlib import Path

TESTS_DIR = Path(__file__).resolve().parent
TESTS = ["test_data.py", "test_links.py", "test_search.py"]


def main():
    overall = 0
    for t in TESTS:
        print(f"\n===== {t} =====")
        result = subprocess.run([sys.executable, str(TESTS_DIR / t)])
        if result.returncode != 0:
            overall = result.returncode
    print("\n" + ("모든 테스트 통과" if overall == 0 else "일부 테스트 실패") + f" (exit {overall})")
    return overall


if __name__ == "__main__":
    sys.exit(main())
