#!/usr/bin/env python3
"""검색 성능을 위해 항목별 소문자 필드 / 숫자 표현을 미리 계산한다.

런타임에 search.js가 매 키 입력마다 문자열을 lower() 하거나 정규식을 새로 만들지
않도록, 여기서 한 번에 계산해서 data/generated/search-index.js 로 저장한다.
(요구사항.md #13: "검색 입력마다 전체 DOM을 다시 생성하지 않는다" /
 "필요하면 사전에 search index를 Python에서 생성한다")

index는 entry id -> 검색용 필드 로 매핑되는 object이다 (entries.js의 배열 순서와
독립적으로 안전하게 매칭하기 위해 배열이 아닌 dict를 사용).
"""
import json
import re
import sys

from common import GENERATED_DIR, load_all_entries

TOKEN_SPLIT_RE = re.compile(r"[^a-z0-9_]+")


def tokenize(text):
    return [t for t in TOKEN_SPLIT_RE.split(text.lower()) if t]


def hex_no_prefix(hx):
    if not hx:
        return ""
    hx = hx.strip()
    if hx.lower().startswith("0x"):
        hx = hx[2:]
    return hx.lower()


def build_text_blob(e):
    parts = [
        e.get("summary", ""),
        e.get("internals", ""),
        e.get("signature", ""),
        e.get("assembly_pattern", ""),
        e.get("security_notes", ""),
        e.get("example_code", ""),
        e.get("example_output", ""),
    ]
    rev = e.get("reversing") or {}
    parts.append(rev.get("notes", ""))
    parts.append(rev.get("decompiler_pattern", ""))
    parts.append(rev.get("ida_example", ""))
    for p in e.get("pitfalls") or []:
        parts.append(p)
    for p in e.get("parameters") or []:
        parts.append(p.get("desc", ""))
    rv = e.get("return_value") or {}
    for key in ("success", "failure", "meaning"):
        parts.append(str(rv.get(key, "")))
    for c in e.get("constants") or []:
        parts.append(c.get("name", ""))
        parts.append(c.get("desc", ""))
    for c in e.get("numeric_constants") or []:
        parts.append(c.get("label", ""))
    eq = e.get("equivalents") or {}
    parts.append(eq.get("linux", ""))
    parts.append(eq.get("windows", ""))
    return " \n ".join(str(p) for p in parts if p).lower()


def build_entry_index(e):
    name = e.get("name", "")
    aliases = e.get("aliases") or []
    tags = e.get("tags") or []

    constants_exact = []
    for c in e.get("constants") or []:
        dec = c.get("decimal")
        if dec is None:
            continue
        constants_exact.append({
            "n": (c.get("name") or "").lower(),
            "d": dec,
            "h": hex_no_prefix(c.get("hex", "")),
        })

    numeric_exact = []
    for c in e.get("numeric_constants") or []:
        dec = c.get("decimal")
        if dec is None:
            continue
        numeric_exact.append({
            "l": (c.get("label") or "").lower(),
            "d": dec,
            "h": hex_no_prefix(c.get("hex", "")),
        })

    return {
        "id": e["id"],
        "name": name,
        "nameLower": name.lower(),
        "nameTokens": tokenize(name),
        "aliasesLower": [a.lower() for a in aliases],
        "headerLower": (e.get("header") or "").lower(),
        "libraryLower": (e.get("library") or "").lower(),
        "tagsLower": [t.lower() for t in tags],
        "category": e.get("category", ""),
        "platform": e.get("platform") or [],
        "importance": (e.get("reversing") or {}).get("importance"),
        "constantsExact": constants_exact,
        "numericExact": numeric_exact,
        "textBlob": build_text_blob(e),
    }


def main():
    entries, errors = load_all_entries(verbose=False)
    if errors:
        print("[build_index] 데이터 로드 오류가 있습니다. validate_data.py를 먼저 실행하세요.")
        for e in errors:
            print(f"  - {e}")
        return 1

    index = {}
    for e in entries:
        eid = e.get("id")
        if not eid:
            continue
        index[eid] = build_entry_index(e)

    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    out_path = GENERATED_DIR / "search-index.js"
    payload = json.dumps(index, ensure_ascii=False, separators=(",", ":"))
    out_path.write_text(
        "// 자동 생성 파일. tools/build_index.py 로 재생성하십시오. 직접 수정하지 마세요.\n"
        f"window.REVLIBC_SEARCH_INDEX = {payload};\n",
        encoding="utf-8",
    )
    print(f"[build_index] {len(index)}개 항목 색인 -> {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
