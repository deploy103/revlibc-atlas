#!/usr/bin/env python3
"""AGENTS.md/요구사항.md 에 명시된 target inventory 대비 구현 현황을 계산한다.

여기 정의된 target 목록은 두 spec 문서에 실제로 열거된 이름만 사용한다.
(임의로 "전체 ISO C 함수" 같은 걸 추측해서 채우지 않는다 - 26항 규칙)
아직 target으로 스코프하지 않은 header/영역은 0/0 으로 정직하게 표시하고
"v1 스코프 아님"이라고 명시한다.

결과를 stdout에 출력하고 docs/COVERAGE.md 를 갱신한다.
"""
import sys
from datetime import datetime, timezone

from common import ROOT, load_all_entries

TARGET_GROUPS = {
    "ISO C - string.h": [
        "strlen", "strcmp", "strncmp", "strcpy", "strncpy", "strcat", "strncat",
        "strchr", "strrchr", "strstr", "strtok", "strspn", "strcspn", "strpbrk",
        "strdup", "memcpy", "memmove", "memset", "memcmp", "memchr",
    ],
    "ISO C - stdio.h": [
        "printf", "fprintf", "sprintf", "snprintf", "puts", "putchar", "scanf",
        "fscanf", "sscanf", "gets", "fgets", "fputs", "fread", "fwrite",
        "fopen", "fclose", "fseek", "ftell", "rewind",
    ],
    "ISO C - stdlib.h (memory/conversion/sort/process)": [
        "malloc", "calloc", "realloc", "free", "aligned_alloc",
        "atoi", "atol", "atoll", "strtol", "strtoul", "strtoll", "strtoull",
        "strtof", "strtod", "strtold", "qsort", "bsearch",
        "system", "exit", "_exit", "abort", "atexit", "getenv",
    ],
    "ISO C - other headers (assert/ctype/errno/limits/stdint/time/signal/setjmp/math scope)": [
        # 요구사항에 개별 함수로 명시되지 않은 header 그룹 - v1에서는 스코프 대상만 포함.
    ],
    "POSIX/Linux - file": [
        "open", "openat", "close", "read", "write", "pread", "pwrite", "lseek",
        "stat", "fstat", "lstat", "access", "unlink", "rename", "dup", "dup2", "pipe",
    ],
    "POSIX/Linux - memory": [
        "mmap", "munmap", "mprotect", "brk", "sbrk", "mlock",
    ],
    "POSIX/Linux - process": [
        "fork", "vfork", "execve", "execl", "execv", "execvp",
        "wait", "waitpid", "kill", "getpid", "getppid", "ptrace",
    ],
    "POSIX/Linux - dynamic linking": [
        "dlopen", "dlsym", "dlclose", "dlerror",
    ],
    "POSIX/Linux - environment": [
        "sysconf", "confstr", "pathconf",
    ],
    "POSIX/Linux - thread": [
        "pthread_create", "pthread_join", "pthread_mutex_lock",
        "pthread_mutex_unlock", "pthread_cond_wait", "pthread_once",
    ],
    "POSIX/Linux - socket": [
        "socket", "bind", "listen", "accept", "connect", "send", "recv",
        "sendto", "recvfrom", "setsockopt", "getsockopt", "shutdown",
        "inet_addr", "inet_pton", "inet_ntop", "htons", "htonl", "ntohs", "ntohl",
    ],
    "Windows - memory": [
        "VirtualAlloc", "VirtualFree", "VirtualProtect", "VirtualQuery",
        "HeapAlloc", "HeapFree",
    ],
    "Windows - process/thread": [
        "CreateProcessA", "CreateProcessW", "OpenProcess", "TerminateProcess",
        "GetCurrentProcess", "GetCurrentProcessId", "CreateThread", "OpenThread",
        "SuspendThread", "ResumeThread", "WaitForSingleObject",
    ],
    "Windows - DLL/module": [
        "LoadLibraryA", "LoadLibraryW", "GetProcAddress", "FreeLibrary",
        "GetModuleHandleA", "GetModuleHandleW",
    ],
    "Windows - file": [
        "CreateFileA", "CreateFileW", "ReadFile", "WriteFile",
        "SetFilePointer", "CloseHandle",
    ],
    "Windows - environment/registry/string": [
        "GetCommandLineA", "GetCommandLineW", "GetEnvironmentVariableA",
        "GetEnvironmentVariableW", "RegOpenKeyEx", "RegQueryValueEx",
        "RegSetValueEx", "RegCloseKey", "lstrcmp", "lstrcmpi",
        "MultiByteToWideChar", "WideCharToMultiByte",
    ],
    "Windows - anti-debug/misc": [
        "IsDebuggerPresent", "CheckRemoteDebuggerPresent", "OutputDebugString",
        "QueryPerformanceCounter", "GetTickCount", "GetTickCount64", "Sleep",
        "NtQueryInformationProcess",
    ],
    "Compiler/security symbols": [
        "__stack_chk_fail", "__libc_start_main", "__cxa_finalize",
        "__gmon_start__", "__errno_location", "__security_check_cookie",
        "__scrt_common_main_seh", "__printf_chk", "__memcpy_chk",
        "__strcpy_chk", "__sprintf_chk",
    ],
    "IDA pseudo types": [
        "_BYTE", "_WORD", "_DWORD", "_QWORD", "_OWORD",
        "__int8", "__int16", "__int32", "__int64", "BYREF",
    ],
    "IDA macros": [
        "LOBYTE", "HIBYTE", "LOWORD", "HIWORD",
        "BYTE1", "BYTE2", "BYTE3", "WORD1", "DWORD1",
    ],
    "Calling conventions": [
        "__cdecl", "__stdcall", "__fastcall", "__thiscall", "__vectorcall",
        "__noreturn", "System V AMD64 ABI", "Microsoft x64 ABI", "AAPCS",
    ],
    "Registers": [
        "rax", "eax", "ax", "al", "ah", "rbx", "rsp", "rbp", "rip", "rflags",
    ],
    "ELF/PE & reversing concepts": [
        "PLT", "GOT", "IAT", "ELF", "PE", "PIE", "NX", "RELRO", "ASLR",
        "stack canary", ".text", ".data", ".rodata", ".bss", "TLS",
        "entry point", "OEP", "stack frame",
    ],
    "Reversing patterns": [
        "strcmp == 0", "memcmp == 0", "strcspn newline removal", "XOR loop",
        "ROL/ROR", "byte swap", "little endian", "big endian",
        "PLT/GOT", "init_array", "fini_array", "constructor", "destructor",
        "positive sp value has been detected, the output may be wrong!",
    ],
    "Crypto/hash magic constants": [
        "MD5", "SHA-1", "SHA-224", "SHA-256", "SHA-384", "SHA-512",
        "CRC32", "Adler32", "FNV-1", "FNV-1a", "DJB2", "MurmurHash",
        "TEA", "XTEA", "XXTEA", "RC4", "AES key schedule",
    ],
}


def normalize(name):
    return name.strip().lower()


def main():
    entries, errors = load_all_entries()
    if errors:
        print("[coverage] 경고: 데이터 로드 오류가 있는 상태로 계산합니다.")
        for e in errors:
            print(f"  - {e}")

    known_names = set()
    for e in entries:
        n = e.get("name")
        if n:
            known_names.add(normalize(n))
        for a in e.get("aliases") or []:
            known_names.add(normalize(a))
        for t in e.get("tags") or []:
            known_names.add(normalize(t))

    lines = []
    lines.append("# Coverage Report\n")
    lines.append(
        f"자동 생성됨: `python3 tools/coverage.py` "
        f"({datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')})\n"
    )
    lines.append(
        "target 목록은 AGENTS.md / 요구사항.md 에 실제로 열거된 이름만 사용한다. "
        "아직 스코프하지 않은 항목은 추측으로 채우지 않고 0/0 으로 표시한다.\n"
    )
    lines.append("| 그룹 | 구현 | 목표 | 비율 | 미구현 |")
    lines.append("|---|---:|---:|---:|---|")

    total_impl = 0
    total_target = 0
    print(f"[coverage] 전체 데이터 항목 수: {len(entries)}\n")
    print(f"{'그룹':55s} {'구현/목표':>10s}")

    missing_report = []

    for group, targets in TARGET_GROUPS.items():
        if not targets:
            print(f"{group:55s} {'0/0 (v1 스코프 아님)':>10s}")
            lines.append(f"| {group} | 0 | 0 | - | (v1 스코프 아님) |")
            continue
        missing = [t for t in targets if normalize(t) not in known_names]
        impl = len(targets) - len(missing)
        total_impl += impl
        total_target += len(targets)
        pct = f"{(impl/len(targets)*100):.0f}%" if targets else "-"
        print(f"{group:55s} {impl:>4d}/{len(targets):<4d} ({pct})")
        missing_str = ", ".join(f"`{m}`" for m in missing) if missing else "-"
        lines.append(f"| {group} | {impl} | {len(targets)} | {pct} | {missing_str} |")
        if missing:
            missing_report.append((group, missing))

    overall_pct = f"{(total_impl/total_target*100):.1f}%" if total_target else "0%"
    print(f"\n{'TOTAL':55s} {total_impl:>4d}/{total_target:<4d} ({overall_pct})")

    lines.append(f"| **TOTAL** | **{total_impl}** | **{total_target}** | **{overall_pct}** | |")

    lines.append("\n## 남은 미구현 항목 상세\n")
    if missing_report:
        for group, missing in missing_report:
            lines.append(f"### {group}\n")
            for m in missing:
                lines.append(f"- {m}")
            lines.append("")
    else:
        lines.append("모든 target 항목이 구현되었습니다.\n")

    out_path = ROOT / "docs" / "COVERAGE.md"
    out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"\n[coverage] 리포트 작성: {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
