#!/usr/bin/env python3
"""data/*.json 을 모아 data/generated/entries.js 와 metadata.js 를 만든다.

런타임에 fetch()로 JSON을 읽지 않기 위해, JSON을 JS 리터럴로 그대로 박아 넣은
<script> 파일을 생성한다. index.html은 이 파일만 <script src>로 로드한다.
"""
import json
import sys

from common import GENERATED_DIR, load_all_entries

CATEGORY_LABELS = {
    "string": "String",
    "memory": "Memory",
    "io": "I/O",
    "file": "File",
    "process": "Process",
    "thread": "Thread",
    "network": "Network",
    "dynamic-linking": "Dynamic Linking",
    "crypto": "Crypto",
    "hash": "Hash",
    "anti-debug": "Anti-Debugging",
    "decompiler": "Decompiler",
    "assembly": "Assembly",
    "conversion": "Conversion",
    "sorting": "Sorting/Search",
    "registry": "Registry",
    "register": "Register",
    "calling-convention": "Calling Convention",
    "elf-pe": "ELF/PE",
    "pattern": "Reversing Pattern",
    "warning": "Decompiler Warning",
    "concept": "Concept",
    "environment": "Environment",
    "signal": "Signal",
    "ipc": "IPC",
}

PLATFORM_LABELS = {
    "c": "C",
    "posix": "POSIX",
    "linux": "Linux",
    "windows": "Windows",
    "ida": "IDA",
    "ghidra": "Ghidra",
    "glibc": "glibc",
}


def strip_internal_fields(entry):
    return {k: v for k, v in entry.items() if not k.startswith("_")}


def main():
    entries, errors = load_all_entries(verbose=False)
    if errors:
        print("[build_data] 데이터 로드 오류가 있습니다. validate_data.py를 먼저 실행하세요:")
        for e in errors:
            print(f"  - {e}")
        return 1

    entries_sorted = sorted(entries, key=lambda e: (e.get("name") or "").lower())
    clean = [strip_internal_fields(e) for e in entries_sorted]

    GENERATED_DIR.mkdir(parents=True, exist_ok=True)

    entries_js = GENERATED_DIR / "entries.js"
    payload = json.dumps(clean, ensure_ascii=False, separators=(",", ":"))
    entries_js.write_text(
        "// 자동 생성 파일. tools/build_data.py 로 재생성하십시오. 직접 수정하지 마세요.\n"
        f"window.REVLIBC_DATA = {payload};\n",
        encoding="utf-8",
    )

    categories = sorted({e["category"] for e in clean})
    platforms = sorted({p for e in clean for p in e.get("platform", [])})

    metadata = {
        "count": len(clean),
        "categories": [
            {"id": c, "label": CATEGORY_LABELS.get(c, c)} for c in categories
        ],
        "platforms": [
            {"id": p, "label": PLATFORM_LABELS.get(p, p)} for p in platforms
        ],
        "importance_levels": ["Critical", "High", "Medium", "Low"],
    }
    metadata_js = GENERATED_DIR / "metadata.js"
    metadata_js.write_text(
        "// 자동 생성 파일. tools/build_data.py 로 재생성하십시오. 직접 수정하지 마세요.\n"
        f"window.REVLIBC_META = {json.dumps(metadata, ensure_ascii=False, indent=2)};\n",
        encoding="utf-8",
    )

    print(f"[build_data] {len(clean)}개 항목 -> {entries_js}")
    print(f"[build_data] 카테고리 {len(categories)}개, 플랫폼 {len(platforms)}개 -> {metadata_js}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
