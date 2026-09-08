#!/usr/bin/env python3
"""전체 빌드 파이프라인: validate -> build_data -> build_index -> coverage.

사용법:
    python3 tools/build.py
"""
import subprocess
import sys
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parent
STEPS = ["validate_data.py", "build_data.py", "build_index.py", "coverage.py"]


def main():
    for step in STEPS:
        print(f"\n===== {step} =====")
        result = subprocess.run([sys.executable, str(TOOLS_DIR / step)])
        if result.returncode != 0:
            print(f"\n[build] {step} 실패 (exit {result.returncode}). 중단합니다.")
            return result.returncode
    print("\n[build] 전체 빌드 완료")
    return 0


if __name__ == "__main__":
    sys.exit(main())
