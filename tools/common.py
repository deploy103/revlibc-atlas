"""revlibc-atlas 빌드 도구 공용 모듈.

data/**/*.json (data/generated 제외)을 로드하는 로직을 한 곳에 모아
build_data.py / validate_data.py / build_index.py / coverage.py 가 공유한다.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
GENERATED_DIR = DATA_DIR / "generated"

ALLOWED_TYPES = {
    "function", "type", "macro", "register", "convention",
    "concept", "pattern", "warning", "constant_group", "struct",
}

ALLOWED_CATEGORIES = {
    "string", "memory", "io", "file", "process", "thread", "network",
    "dynamic-linking", "crypto", "hash", "anti-debug", "decompiler",
    "assembly", "conversion", "sorting", "registry", "register",
    "calling-convention", "elf-pe", "pattern", "warning", "concept",
    "environment", "signal", "ipc",
}

ALLOWED_PLATFORMS = {"c", "posix", "linux", "windows", "ida", "ghidra", "glibc"}

ALLOWED_IMPORTANCE = {"Critical", "High", "Medium", "Low"}

# reversing notes가 필수인 type
REVERSING_REQUIRED_TYPES = {"function", "pattern", "warning"}


class DataLoadError(Exception):
    pass


def find_json_files():
    files = []
    for path in sorted(DATA_DIR.rglob("*.json")):
        if GENERATED_DIR in path.parents or path.parent == GENERATED_DIR:
            continue
        files.append(path)
    return files


def load_all_entries(verbose=False):
    """모든 data/*.json 을 로드하여 (entries, errors) 튜플을 반환한다.

    JSON 자체가 깨진 경우에도 최대한 계속 진행하며 errors 리스트에 기록한다.
    """
    entries = []
    errors = []
    for path in find_json_files():
        rel = path.relative_to(ROOT)
        try:
            text = path.read_text(encoding="utf-8")
        except Exception as exc:  # pragma: no cover - IO 오류는 드묾
            errors.append(f"{rel}: 파일을 읽을 수 없음 ({exc})")
            continue
        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            errors.append(f"{rel}: JSON 파싱 오류 - {exc}")
            continue
        if isinstance(data, dict):
            data = [data]
        if not isinstance(data, list):
            errors.append(f"{rel}: 최상위 요소는 object 또는 array여야 함")
            continue
        for i, entry in enumerate(data):
            if not isinstance(entry, dict):
                errors.append(f"{rel}[{i}]: 항목은 object여야 함")
                continue
            entry.setdefault("_source_file", str(rel))
            entries.append(entry)
        if verbose:
            print(f"loaded {len(data)} entries from {rel}")
    return entries, errors


def hex_to_int(hex_str):
    hex_str = hex_str.strip()
    if hex_str.lower().startswith("0x"):
        return int(hex_str, 16)
    return int(hex_str, 16)
