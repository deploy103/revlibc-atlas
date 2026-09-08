#!/usr/bin/env python3
"""data/*.json 데이터 품질 검증기.

검사 항목 (요구사항.md #29, AGENTS.md #25):
  - JSON 파싱 오류
  - 중복 id
  - 함수명/시그니처/요약 누락
  - category / platform / type / importance 값 오류
  - related 에 존재하지 않는 id (broken link)
  - reversing notes 누락 (function/pattern/warning 타입)
  - constants / numeric_constants 의 hex-decimal 불일치

오류가 하나라도 있으면 non-zero exit code로 종료한다.
"""
import re
import sys

from common import (
    ALLOWED_CATEGORIES,
    ALLOWED_IMPORTANCE,
    ALLOWED_PLATFORMS,
    ALLOWED_TYPES,
    REVERSING_REQUIRED_TYPES,
    load_all_entries,
)

ID_PATTERN = re.compile(r"^[a-z0-9]+(-[a-z0-9_.]+)+$")


def check_hex_decimal(item, ctx, errors):
    dec = item.get("decimal")
    hx = item.get("hex")
    name = item.get("name") or item.get("label") or "?"
    if dec is None or hx is None:
        errors.append(f"{ctx}: '{name}' 항목에 decimal/hex가 모두 있어야 함")
        return
    try:
        hx_clean = hx[2:] if hx.lower().startswith("0x") else hx
        hx_val = int(hx_clean, 16)
    except (ValueError, TypeError):
        errors.append(f"{ctx}: '{name}' hex 값 파싱 실패 ({hx!r})")
        return
    if not isinstance(dec, int):
        errors.append(f"{ctx}: '{name}' decimal 값이 정수가 아님 ({dec!r})")
        return
    if hx_val != dec:
        errors.append(
            f"{ctx}: '{name}' decimal({dec}) != hex({hx} = {hx_val}) 불일치"
        )
    if not hx.lower().startswith("0x"):
        errors.append(f"{ctx}: '{name}' hex 값은 '0x' 접두사가 있어야 함 ({hx!r})")


def validate(entries):
    errors = []
    warnings = []
    seen_ids = {}

    for e in entries:
        src = e.get("_source_file", "?")
        eid = e.get("id")
        ctx = f"{src} (id={eid!r})"

        if not eid or not isinstance(eid, str):
            errors.append(f"{src}: id 누락")
            continue
        if not ID_PATTERN.match(eid):
            errors.append(f"{ctx}: id 네이밍 규칙 위반 (kebab-case 필요)")
        if eid in seen_ids:
            errors.append(f"{ctx}: id 중복 (이미 {seen_ids[eid]} 에 존재)")
        else:
            seen_ids[eid] = src

        name = e.get("name")
        if not name or not isinstance(name, str):
            errors.append(f"{ctx}: name 누락")

        etype = e.get("type")
        if etype not in ALLOWED_TYPES:
            errors.append(f"{ctx}: type 값이 올바르지 않음 ({etype!r})")

        category = e.get("category")
        if category not in ALLOWED_CATEGORIES:
            errors.append(f"{ctx}: category 값이 올바르지 않음 ({category!r})")

        platforms = e.get("platform")
        if not platforms or not isinstance(platforms, list):
            errors.append(f"{ctx}: platform 배열이 필요함")
        else:
            for p in platforms:
                if p not in ALLOWED_PLATFORMS:
                    errors.append(f"{ctx}: platform 값이 올바르지 않음 ({p!r})")

        summary = e.get("summary")
        if not summary or not isinstance(summary, str) or len(summary.strip()) < 4:
            errors.append(f"{ctx}: summary 누락 또는 너무 짧음")

        if etype == "function":
            sig = e.get("signature")
            if not sig or not isinstance(sig, str) or not sig.strip():
                errors.append(f"{ctx}: type=function 인데 signature 누락")

        importance = (e.get("reversing") or {}).get("importance")
        if importance is not None and importance not in ALLOWED_IMPORTANCE:
            errors.append(f"{ctx}: reversing.importance 값이 올바르지 않음 ({importance!r})")

        if etype in REVERSING_REQUIRED_TYPES:
            rev = e.get("reversing") or {}
            notes = rev.get("notes")
            if not notes or not str(notes).strip():
                errors.append(f"{ctx}: type={etype} 인데 reversing.notes 가 비어있음")
            if not importance:
                warnings.append(f"{ctx}: reversing.importance 미지정")

        for i, c in enumerate(e.get("constants") or []):
            check_hex_decimal(c, f"{ctx}.constants[{i}]", errors)
        for i, c in enumerate(e.get("numeric_constants") or []):
            check_hex_decimal(c, f"{ctx}.numeric_constants[{i}]", errors)

        for i, p in enumerate(e.get("parameters") or []):
            if not p.get("name"):
                warnings.append(f"{ctx}.parameters[{i}]: name 누락")

        srcs = e.get("sources") or []
        for i, s in enumerate(srcs):
            if not s.get("title"):
                warnings.append(f"{ctx}.sources[{i}]: title 누락")

    # 2차 패스: related id 존재 여부 (broken link)
    for e in entries:
        src = e.get("_source_file", "?")
        eid = e.get("id", "?")
        for rel in e.get("related") or []:
            if rel not in seen_ids:
                errors.append(f"{src} (id={eid}): related 에 존재하지 않는 id 참조 ({rel!r})")

    return errors, warnings


def main():
    entries, load_errors = load_all_entries()
    errors, warnings = validate(entries)
    errors = load_errors + errors

    print(f"[validate_data] 검사한 항목 수: {len(entries)}")
    if warnings:
        print(f"\n경고 {len(warnings)}건:")
        for w in warnings:
            print(f"  - {w}")

    if errors:
        print(f"\n오류 {len(errors)}건:")
        for err in errors:
            print(f"  - {err}")
        print("\n[validate_data] FAILED")
        return 1

    print("[validate_data] OK - 오류 없음")
    return 0


if __name__ == "__main__":
    sys.exit(main())
