#!/usr/bin/env python3
"""검색 엔진 회귀 테스트 실행기.

실제 랭킹 로직은 assets/js/search.js (순수 JS)에 있으므로, Node.js로 실행되는
tests/test_search.js 를 이 스크립트가 호출하는 방식으로 구성한다 (요구사항.md #30).
Node가 없는 환경에서는 명확한 안내와 함께 스킵(exit 0)한다.
"""
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main():
    node = shutil.which("node") or shutil.which("nodejs")
    if not node:
        print("[test_search] node를 찾을 수 없어 JS 검색 테스트를 건너뜁니다.")
        print("[test_search] node.js 설치 후 `node tests/test_search.js` 로 직접 실행할 수 있습니다.")
        return 0

    result = subprocess.run([node, str(ROOT / "tests" / "test_search.js")], cwd=str(ROOT))
    return result.returncode


if __name__ == "__main__":
    sys.exit(main())
