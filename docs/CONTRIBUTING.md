# 데이터 기여 가이드

이 문서는 `revlibc-atlas`에 새 항목(함수/타입/개념/패턴/상수)을 추가하는 방법을 설명한다.
스키마 자체는 [`DATA_FORMAT.md`](./DATA_FORMAT.md)를 참고한다.

## 원칙

1. **일반 프로그래밍 강의가 아니라 리버싱 사전이다.** 모든 항목은 "IDA/Ghidra에서
   이걸 봤을 때 무슨 뜻인가"에 답할 수 있어야 한다. `reversing.notes`를 대충 쓰지 않는다.
2. **추측 금지.** 모르는 내용은 공식 문서(man7.org, cppreference, GNU libc manual,
   Microsoft Learn, POSIX 표준, NIST/RFC)를 확인하고 직접 요약해서 쓴다. 대량 복사는
   하지 않는다. `sources`에 실제 존재하는 URL만 남긴다.
3. **취약점 단정 금지.** `gets`처럼 사용 자체가 위험 신호인 함수는 명확히 그렇다고
   쓰되, `strcpy`처럼 상황에 따라 안전할 수도 있는 함수는 "~할 경우 위험할 수 있다"는
   조건부 서술을 사용한다.
4. **숫자 상수는 hex와 decimal을 함께 기록한다.** `validate_data.py`가 두 값의
   일치를 엄격히 검사하므로 반드시 직접 계산해서 채운다.

## 새 항목 추가 절차

1. `data/<도메인>/` 아래 적절한 파일을 고르거나 새로 만든다 (JSON 배열).
2. `docs/DATA_FORMAT.md`의 id 네이밍 규칙(`c-`, `posix-`, `win-`, `ida-`, `conv-`,
   `reg-`, `pattern-`, `crypto-`, `compiler-`, `concept-`)을 따라 소문자 kebab-case id를
   부여한다.
3. 최소 다음을 채운다: `id`, `type`, `name`, `category`, `platform`, `summary`,
   `signature`(function이면 필수), `return_value`, `reversing.importance`,
   `reversing.notes`, `tags`, `sources`.
4. 가능하면 `example_code`를 실제로 컴파일/실행해서 `example_output`이 정확한지
   확인한다 (`gcc example.c -o example && ./example`).
5. `related`에는 실제로 존재하는 다른 항목의 id만 넣는다.
6. 빌드 + 검증을 실행한다.

```bash
python3 tools/build.py
python3 tests/run_all.py
```

7. `validate_data.py`가 통과하고 `tests/run_all.py`가 실패 없이 끝나면 커밋한다.

## 카테고리/플랫폼 값이 헷갈릴 때

`docs/DATA_FORMAT.md`의 CATEGORY/PLATFORM 목록에 없는 값이 필요하다고 느껴지면,
새 값을 마음대로 추가하지 말고 `tools/common.py`의 `ALLOWED_CATEGORIES` /
`ALLOWED_PLATFORMS`를 함께 업데이트한다 (검색 필터 UI가 이 값들을 기준으로 자동
생성되므로, 늘릴 때는 신중하게 — 카테고리가 너무 잘게 쪼개지면 필터 UI가 지저분해진다).
