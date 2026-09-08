# 데이터 포맷 (DATA_FORMAT)

`revlibc-atlas`의 모든 콘텐츠는 `data/**/*.json` 파일에 구조화된 형태로 저장한다.
`index.html`은 이 JSON을 직접 읽지 않는다. `tools/build_data.py`가 모든 JSON을 모아
`data/generated/entries.js` (`window.REVLIBC_DATA`)와
`data/generated/search-index.js` (`window.REVLIBC_INDEX`)로 번들링하며,
이 파일들만 `<script>` 태그로 로드된다.

## 파일 배치 규칙

```
data/
├── c/         ISO C 표준 라이브러리 (string.h, stdio.h, stdlib.h, ...)
├── posix/     POSIX / Linux API, syscall wrapper, socket, pthread, dlopen
├── linux/     Linux 전용 개념 (mmap 플래그, ELF, RELRO, ASLR 등 배포판/커널 특성)
├── windows/   Win32 / CRT / Ntdll
├── reversing/ 리버싱 패턴, calling convention, 레지스터, 실수 사전
├── ida/       IDA/Ghidra pseudo type, macro, warning
└── crypto/    해시/암호 알고리즘 magic constant
```

파일 하나에는 JSON 배열(리스트) 형태로 여러 항목을 담을 수 있다. 예:

```json
[
  { "id": "c-strcmp", "...": "..." },
  { "id": "c-strncmp", "...": "..." }
]
```

## 항목(entry) 스키마

```jsonc
{
  // 필수, 전역 유일. "<domain>-<name>" 형태 권장 (예: "c-strcmp", "win-VirtualProtect")
  "id": "c-strcmp",

  // 필수. 항목의 성격.
  // function | type | macro | register | convention | concept | pattern | warning | constant_group
  "type": "function",

  // 필수. 화면/검색 결과에 표시되는 이름. 함수는 실제 함수명 그대로 (대소문자 보존)
  "name": "strcmp",

  // 선택. 동의어, 축약형, 다른 표기 (예: "lstrcmpA" 같은 별칭, "sys_mprotect")
  "aliases": [],

  // 필수. 필터 카테고리 (하나). CATEGORY 목록 참고.
  "category": "string",

  // 필수. 플랫폼 태그 배열 (여러 개 가능). PLATFORM 목록 참고.
  "platform": ["c", "linux", "windows"],

  // 선택. 표준/버전 표기. 예: "C89", "C99", "C17", "POSIX.1-2017", "glibc", "WinAPI", "N/A"
  "standard": "C89",

  // 선택. 필요한 헤더. 여러 개면 콤마로 구분한 문자열이 아니라 배열 사용 가능하지만
  // 통일성을 위해 대표 헤더 하나는 header, 나머지는 tags에 추가.
  "header": "string.h",

  // 선택. 소속 라이브러리/DLL. 예: "libc", "kernel32.dll", "ntdll.dll", "ws2_32.dll", "N/A"
  "library": "libc",

  // 함수/매크로면 필수. 프로토타입 문자열. concept/pattern류는 빈 문자열 허용.
  "signature": "int strcmp(const char *s1, const char *s2);",

  // 필수. 한 줄 요약 (한국어).
  "summary": "두 널 종료 문자열을 사전식으로 비교한다.",

  // 선택. 인자 설명 배열.
  "parameters": [
    {
      "name": "s1",
      "type": "const char *",
      "desc": "비교할 첫 번째 문자열",
      "direction": "in",
      "nullable": false,
      "notes": ""
    }
  ],

  // 선택. 반환값 상세. 리버싱에서 성공/실패 판정이 중요한 함수는 반드시 채운다.
  "return_value": {
    "success": "0",
    "failure": "0이 아닌 값 (부호는 구현별)",
    "meaning": "s1 < s2 이면 음수, s1 == s2 이면 0, s1 > s2 이면 양수",
    "errno": false,
    "get_last_error": false
  },

  // 선택. 함수와 연관된 명명 상수/플래그. 숫자 검색의 핵심 데이터.
  "constants": [
    { "name": "PROT_READ", "decimal": 1, "hex": "0x1", "desc": "읽기 권한" }
  ],

  // 선택. 함수와 직접 연관되지 않는 magic number (해시 초기값 등)를 검색 가능하게 하기 위한 필드.
  "numeric_constants": [
    { "decimal": 1779033703, "hex": "0x6A09E667", "label": "SHA-256 H0[0]" }
  ],

  // 선택이지만 강력 권장. 컴파일 가능한 예제.
  "example_code": "#include <stdio.h>\n...\n",
  "example_output": "hello\n",
  "compile_cmd": "gcc example.c -o example && ./example",

  // 선택. "실제로 무엇을 하는지" 개념 설명 (요구사항 6항 What it really does).
  "internals": "'\\0'을 만날 때까지 두 문자열의 각 바이트를 unsigned char로 비교한다.",

  // 매우 중요. 리버싱 관점. 거의 모든 function/pattern 항목에 있어야 한다.
  "reversing": {
    "importance": "Critical",       // Critical | High | Medium | Low
    "notes": "패스워드/플래그 비교, 커맨드 디스패치, 인자 검증에서 자주 발견된다.",
    "decompiler_pattern": "if ( !strcmp(input, \"admin\") )",
    "ida_example": "if ( !strcmp(a1, \"admin\") )\n  sub_401000();"
  },

  // 선택. 최적화/컴파일러가 만들어내는 어셈블리 패턴 설명.
  "assembly_pattern": "짧은 상수 문자열 비교는 컴파일러가 strcmp 호출 없이 mov/cmp로 인라인화하기도 한다.",

  // 선택. 흔한 실수/오해.
  "pitfalls": [
    "strcmp(a,b) == 0 이 '같다'이다. true/false로 착각하면 반대로 해석하게 된다."
  ],

  // 선택. 보안 메모 (취약점 단정 금지, 조건부로 설명).
  "security_notes": "",

  // 선택. Linux/Windows 대응 함수 (있는 경우만).
  "equivalents": { "linux": "", "windows": "" },

  // 선택. 다른 항목의 id 배열. related functions.
  "related": ["c-strncmp", "c-memcmp"],

  // 선택. 자유 태그. 검색 가중치가 있는 필드이므로 실제로 사용자가 검색할 법한 키워드를 넣는다.
  "tags": ["string comparison", "password check", "command dispatch"],

  // 선택. 출처. 오프라인에서는 텍스트로만 존재.
  "sources": [
    { "title": "cppreference - strcmp", "url": "https://en.cppreference.com/w/c/string/byte/strcmp" }
  ]
}
```

## CATEGORY 목록

```
string, memory, io, file, process, thread, network, dynamic-linking,
crypto, hash, anti-debug, decompiler, assembly, conversion, sorting,
registry, register, calling-convention, elf-pe, pattern, warning, concept, environment, signal, ipc
```

## PLATFORM 목록

```
c, posix, linux, windows, ida, ghidra, glibc
```

## REVERSING IMPORTANCE

```
Critical, High, Medium, Low
```

CTF Mode는 이 값과 `tags`에 포함된 CTF 빈출 키워드를 기준으로 결과를 재정렬한다.

## id 네이밍 규칙

- C 표준 함수: `c-<name>` (예: `c-strcmp`)
- POSIX/Linux: `posix-<name>` (예: `posix-mprotect`)
- Windows: `win-<Name>` (예: `win-VirtualProtect`)
- IDA/Ghidra 개념: `ida-<name>` (예: `ida-_BYTE`, `ida-fastcall`)
- 리버싱 패턴/실수: `pattern-<name>` (예: `pattern-xor-loop`)
- 레지스터: `reg-<name>` (예: `reg-rax`)
- calling convention: `conv-<name>`
- 암호/해시 상수: `crypto-<name>` (예: `crypto-sha256-h0`)
- 컴파일러/보안 심볼: `compiler-<name>` (예: `compiler-stack-chk-fail`)

## 검증 규칙 (tools/validate_data.py 가 강제)

- `id` 전역 유일, kebab 네이밍 패턴을 따를 것
- `name`, `category`, `type`, `summary` 필수
- `platform`은 PLATFORM 목록의 값만, 최소 1개
- `category`는 CATEGORY 목록에 존재해야 함
- `type`이 `function`이면 `signature` 비어있지 않아야 함
- `reversing.importance`가 있으면 Critical/High/Medium/Low 중 하나
- `related` 배열의 모든 id는 실제 존재하는 id여야 함 (broken link 검사)
- `reversing` 섹션이 완전히 비어있으면 경고 (function/pattern 타입은 오류)
- `constants`/`numeric_constants`의 `hex`는 `0x` 접두사 + 대문자/소문자 hex, `decimal`과 값이 일치해야 함
