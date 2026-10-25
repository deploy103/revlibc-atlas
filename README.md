# RevLibc Atlas

**CTF 대회장에서 인터넷 없이 쓰는 리버싱 전용 오프라인 사전.**

IDA/Ghidra 디컴파일 코드에서 모르는 함수, 타입, 상수, API, 표현을 발견했을 때
검색창에 입력하고 몇 초 안에 의미를 파악하기 위한 도구다. 일반적인 C 언어 학습
사이트가 아니다 — "이 코드가 리버싱 맥락에서 무슨 뜻인가"에 집중한다.

```c
s[strcspn(s, "\r\n")] = 0;      // -> fgets 입력의 개행 제거 패턴
mprotect(addr, size, 7);        // -> 7 = RWX, self-modifying code 가능성
```

---

## 1. 대회장에서 사용하는 법 (가장 중요)

1. USB/SSD에서 `revlibc-atlas` 폴더 전체를 복사한다.
2. `index.html` 을 더블클릭해서 연다. (인터넷 연결 불필요, 서버 불필요)
3. `Ctrl+K` 또는 `/` 를 눌러 검색창에 포커스를 준다.
4. 함수명, API 이름, 숫자/hex 상수, IDA 표현(`_BYTE`, `__fastcall`, `positive sp` 등)을 입력한다.
5. `↑`/`↓` 로 결과를 이동하고 `Enter`/클릭으로 상세 화면을 확인한다. `Esc` 로 검색어를 초기화한다.
6. 리버싱/CTF에서 특히 자주 쓰이는 항목만 보고 싶다면 우측 상단 **CTF Mode** 버튼을 켠다.

인터넷 연결, 웹서버, 백엔드, 브라우저 확장 프로그램 중 어느 것도 필요하지 않다.
Chrome / Edge / Firefox 최신 버전에서 `file://index.html` 그대로 동작한다.

---

## 2. 무엇을 검색할 수 있는가

- **ISO C 표준 라이브러리**: `strcmp`, `strcpy`, `malloc`, `qsort`, `atoi` ...
- **POSIX / Linux / glibc**: `mmap`, `mprotect`, `dlopen`, `ptrace`, `fork`, `socket` ...
- **Windows CRT / Win32 API**: `VirtualProtect`, `CreateThread`, `LoadLibraryA`, `IsDebuggerPresent` ...
- **IDA/Ghidra 의사코드 타입·매크로**: `_BYTE`, `_QWORD`, `__int64`, `BYREF`, `LOBYTE`, `HIWORD` ...
- **Calling convention**: `__cdecl`, `__stdcall`, `__fastcall`, System V AMD64 ABI, MS x64 ABI ...
- **레지스터**: `rax`/`eax`/`ax`/`al`, `rsp`, `rbp`, `rip` ...
- **ELF/PE 개념**: PLT, GOT, IAT, PIE, NX, RELRO, ASLR, `.text`/`.data`/`.bss` ...
- **리버싱 패턴**: XOR 루프, stack frame 그림, buffer overflow 판단법, `strcmp == 0` 관용구 ...
- **IDA 경고 메시지**: `positive sp value has been detected, the output may be wrong!`
- **암호/해시 magic constant**: SHA-256 초기값(`0x6A09E667` / `1779033703`), FNV prime(`16777619`) ...

숫자는 10진수/16진수를 상호 변환해서 매칭한다. `mprotect 7`, `0x40 VirtualProtect`,
`1779033703`, `6A09E667` 모두 의미 있는 결과를 낸다.

---

## 3. 오프라인 보장 (Offline Guarantee)

이 프로젝트는 런타임에 다음을 **절대 사용하지 않는다**:

- CDN, 외부 JS/CSS, Google Fonts
- 원격 API, 원격 이미지/문서 fetch
- `fetch()`로 JSON을 읽어오는 방식

대신 빌드 시점(`tools/build_data.py`)에 모든 데이터를 JS 리터럴로 변환해
`data/generated/entries.js` (`window.REVLIBC_DATA = [...]`)에 박아 넣고,
`index.html`이 이를 평범한 `<script src>` 태그로 로드한다. 따라서
`file://` 프로토콜(더블클릭 실행)에서도 브라우저의 로컬 파일 보안 정책에
막히지 않고 그대로 동작한다.

개발 중에는 다음처럼 로컬 서버를 띄워도 되지만, 필수는 아니다.

```bash
python3 -m http.server 8000
```

---

## 4. 프로젝트 구조

```text
revlibc-atlas/
├── index.html                 # 진입점 (더블클릭으로 실행)
├── assets/
│   ├── css/main.css           # devtools 스타일 다크/라이트 테마
│   └── js/
│       ├── search.js          # 검색 랭킹 엔진 (순수 JS, Node에서도 테스트 가능)
│       ├── renderer.js        # 결과 목록/상세 화면 DOM 렌더링
│       ├── shortcuts.js       # 키보드 단축키
│       └── app.js             # 상태 관리 및 이벤트 와이어링
├── data/
│   ├── c/ posix/ linux/ windows/ reversing/ ida/ crypto/   # 원본 JSON 데이터
│   └── generated/              # 빌드 산출물 (git에 커밋됨, 직접 수정 금지)
│       ├── entries.js
│       ├── search-index.js
│       └── metadata.js
├── tools/
│   ├── build.py                # validate -> build_data -> build_index -> coverage 전체 실행
│   ├── build_data.py           # data/*.json -> entries.js / metadata.js
│   ├── build_index.py          # data/*.json -> search-index.js (검색용 사전 계산 색인)
│   ├── validate_data.py        # 데이터 품질 검증 (오류 시 non-zero exit)
│   └── coverage.py             # target inventory 대비 구현 현황 -> docs/COVERAGE.md
├── tests/
│   ├── test_data.py            # 데이터 검증 + 규모/플래그십 항목 확인
│   ├── test_links.py           # related 링크 무결성 + 빌드 산출물 일관성
│   ├── test_search.py          # 검색 랭킹 테스트 실행기 (node 래퍼)
│   ├── test_search.js          # 실제 검색 시나리오 테스트
│   └── run_all.py              # 위 세 테스트를 순서대로 실행
└── docs/
    ├── DATA_FORMAT.md           # 데이터 스키마 정의
    └── COVERAGE.md              # 자동 생성되는 coverage 리포트
```

---

## 5. 데이터 추가하는 법

1. `docs/DATA_FORMAT.md`에서 스키마와 id 네이밍 규칙을 확인한다.
2. `data/<도메인>/*.json`에 항목을 추가하거나 새 파일을 만든다 (JSON 배열).
3. 빌드 + 검증을 실행한다.

```bash
python3 tools/build.py
```

이 명령 하나가 다음을 순서대로 실행한다: `validate_data.py` → `build_data.py` →
`build_index.py` → `coverage.py`. 검증에 실패하면 빌드가 중단되고 오류 목록이
출력된다 (중복 id, 필수 필드 누락, 존재하지 않는 id를 가리키는 `related`, 잘못된
category/platform 값, hex/decimal 불일치 등).

개별 도구만 실행하려면:

```bash
python3 tools/validate_data.py   # 데이터 검증만
python3 tools/build_data.py      # entries.js / metadata.js 생성
python3 tools/build_index.py     # search-index.js 생성
python3 tools/coverage.py        # docs/COVERAGE.md 갱신
```

---

## 6. 테스트

```bash
python3 tools/build.py     # 먼저 빌드가 되어 있어야 함
python3 tests/run_all.py   # test_data.py, test_links.py, test_search.py 순서대로 실행
```

`tests/test_search.js` 는 주요 검색 시나리오
(`strcmp`, `mprotect 7`, `0x40`, `_BYTE`, `fastcall`, `positive sp`,
`1779033703`, `6A09E667`, `16777619`, `stack canary`, `__stack_chk_fail` 등)를
Node.js로 직접 실행해 검증하고, 검색 성능(반복 200회 평균 응답시간)도 함께 측정한다.
Node.js가 없는 환경에서는 자동으로 건너뛴다.

---

## 7. CTF Mode / 필터 / 단축키

- **CTF Mode**: 헤더의 토글 버튼. 활성화하면 `strcmp`, `mprotect`, `mmap`, `dlopen`,
  `ptrace`, `execve`, `VirtualProtect`, `GetProcAddress`, `IsDebuggerPresent` 등
  CTF에서 실전 빈출도가 높은 항목이 검색 랭킹에서 가산점을 받아 우선 노출된다.
- **필터**: 좌측 사이드바에서 Platform(C/Linux/POSIX/Windows/IDA/Ghidra),
  Category(String/Memory/File/Process/...), Importance(Critical/High/Medium/Low)를
  조합해서 좁힐 수 있다.
- **단축키**: `/` 또는 `Ctrl+K` 검색창 포커스, `↑`/`↓` 결과 이동, `Enter` 상세 보기로
  스크롤, `Esc` 검색어 초기화(또는 포커스 해제).
- **Dark/Light 모드**: 헤더 우측 버튼으로 전환, 선택은 `localStorage`에 저장된다
  (저장이 막힌 `file://` 환경이어도 앱 동작에는 지장 없음).

---

## 8. Coverage

`python3 tools/coverage.py` 실행 시 스크립트의 `TARGET_GROUPS`에 정의된
target 함수/개념 목록 대비 구현 현황을 계산해 `docs/COVERAGE.md`를 갱신한다.
추측으로 "전체 ISO C 함수 100%" 같은 값을 채우지 않고, 스코프하지 않은 영역은
정직하게 "0/0 (v1 스코프 아님)"으로 표시한다. 최신 수치는 `docs/COVERAGE.md`를
참고할 것.

---

## 9. 기술 스택 / 설계 원칙

- Frontend: HTML5, CSS3, Vanilla JavaScript (프레임워크 없음)
- Build: Python 3 (표준 라이브러리만 사용, 외부 패키지 의존성 없음)
- 데이터와 UI 코드를 완전히 분리 — `index.html`에 콘텐츠를 하드코딩하지 않는다.
- 검색은 Python이 사전 계산한 색인(`search-index.js`)을 순수 JS 스코어링으로 처리하며,
  매 키 입력마다 DOM을 전부 다시 만들지 않는다 (상위 결과만 렌더링).
- 랭킹은 정확한 함수명 일치를 최우선으로 한다 — `strcmp` 검색 시 본문에 `strcmp`가
  언급된 다른 항목보다 함수 `strcmp()` 자체가 항상 먼저 나온다.
