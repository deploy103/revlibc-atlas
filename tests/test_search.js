// assets/js/search.js 검색 랭킹 회귀 테스트 (Node.js, DOM/브라우저 불필요)
//
// 실행: node tests/test_search.js
// data/generated/*.js 를 실제로 로드해서 요구사항.md #30 에 명시된 검색 시나리오를 검증한다.
"use strict";

const path = require("path");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "..");

// data/generated/*.js 와 assets/js/search.js 는 `window.X = ...` 형태로 전역에 값을
// 대입하는 브라우저용 스크립트다. Node에서 그대로 재사용하기 위해 window === global
// 로 만들어준 뒤 그냥 실행(vm)한다.
global.window = global;

function loadScript(relPath) {
  const full = path.join(ROOT, relPath);
  const code = fs.readFileSync(full, "utf-8");
  // eslint-disable-next-line no-eval
  (0, eval)(code);
}

const generatedDir = path.join(ROOT, "data", "generated");
if (!fs.existsSync(path.join(generatedDir, "entries.js"))) {
  console.error("data/generated/entries.js 가 없습니다. 먼저 `python3 tools/build.py` 를 실행하세요.");
  process.exit(1);
}

loadScript("data/generated/metadata.js");
loadScript("data/generated/entries.js");
loadScript("data/generated/search-index.js");
loadScript("assets/js/search.js");

const RevlibcSearch = global.RevlibcSearch;
const INDEX = global.REVLIBC_SEARCH_INDEX;
const DATA = global.REVLIBC_DATA;

let failed = 0;
let passed = 0;

function topId(query, filters, ctfMode) {
  const results = RevlibcSearch.search(INDEX, query, filters, !!ctfMode);
  return results.length ? results[0].id : null;
}

function anyId(query, filters, ctfMode) {
  const results = RevlibcSearch.search(INDEX, query, filters, !!ctfMode);
  return results.map((r) => r.id);
}

function check(desc, cond) {
  if (cond) {
    passed++;
    console.log("  OK   " + desc);
  } else {
    failed++;
    console.log("  FAIL " + desc);
  }
}

function expectTop(desc, query, expectedId) {
  const got = topId(query);
  check(`${desc} (query="${query}" -> top=${got}, expected=${expectedId})`, got === expectedId);
}

function expectContains(desc, query, expectedId) {
  const ids = anyId(query);
  check(`${desc} (query="${query}" -> contains ${expectedId}? ${ids.indexOf(expectedId) !== -1})`, ids.indexOf(expectedId) !== -1);
}

console.log(`총 ${Object.keys(INDEX).length}개 항목 색인 로드됨\n`);

// ----- 요구사항.md #30 필수 검색 테스트 -----
expectTop("정확한 함수명이 본문 언급보다 우선", "strcmp", "c-strcmp");
expectContains("strcmp + 0 조합 검색", "strcmp 0", "c-strcmp");
expectContains("fgets + newline 조합 검색", "fgets newline", "c-fgets");
expectTop("strcspn 정확 매치", "strcspn", "c-strcspn");
expectTop("mprotect 정확 매치", "mprotect", "posix-mprotect");
expectContains("mprotect + 7 (RWX) 조합", "mprotect 7", "posix-mprotect");
expectContains("PROT_EXEC 상수 검색", "PROT_EXEC", "posix-mprotect");
expectTop("VirtualProtect 정확 매치", "VirtualProtect", "win-virtualprotect");
expectContains("0x40 hex 상수 검색 (PAGE_EXECUTE_READWRITE)", "0x40", "win-virtualprotect");
expectTop("_BYTE 정확 매치", "_BYTE", "ida-_byte");
expectContains("fastcall 별칭 검색", "fastcall", "conv-fastcall");
expectContains("positive sp 경고 문구 검색", "positive sp", "ida-positive-sp");
expectContains("SHA-256 H0 decimal 검색", "1779033703", "crypto-sha256-h0");
expectContains("SHA-256 H0 hex 검색", "6A09E667", "crypto-sha256-h0");
expectContains("FNV prime decimal 검색", "16777619", "crypto-fnv");
expectContains("stack canary 검색", "stack canary", "compiler-stack-chk-fail");
expectTop("__stack_chk_fail 정확 매치", "__stack_chk_fail", "compiler-stack-chk-fail");

// ----- 숫자/hex 상호 변환 -----
check("decimal 7 / hex 0x7 이 동일 결과 집합을 반환", (() => {
  const a = anyId("7").filter((id) => INDEX[id].constantsExact.some((c) => c.d === 7));
  const b = anyId("0x7").filter((id) => INDEX[id].constantsExact.some((c) => c.d === 7));
  return a.length > 0 && b.length > 0 && a.join(",") === b.join(",");
})());

// ----- 대소문자 무시 -----
expectTop("대소문자 무시 (STRCMP)", "STRCMP", "c-strcmp");

// ----- 필터 동작 -----
// mprotect는 Linux 전용 함수이므로 platform=windows 필터에서는 posix-mprotect 자체는
// 제외되어야 한다 (단, win-virtualprotect처럼 본문/equivalents에서 mprotect를 언급하는
// windows 항목은 정상적으로 남아있을 수 있다 - 이는 버그가 아니라 의도된 교차 참조다).
check("platform=windows 필터가 posix-mprotect 자체를 제외", (() => {
  const results = RevlibcSearch.search(INDEX, "mprotect", { platform: "windows" }, false);
  return results.every((r) => r.id !== "posix-mprotect");
})());

// ----- 성능: 전체 데이터셋 기준 검색이 50ms 이내 -----
(function perfTest() {
  const t0 = Date.now();
  for (let i = 0; i < 200; i++) {
    RevlibcSearch.search(INDEX, "strcmp mprotect", null, false);
  }
  const elapsed = Date.now() - t0;
  const avg = elapsed / 200;
  check(`검색 200회 반복 평균 ${avg.toFixed(2)}ms (< 20ms 목표)`, avg < 20);
})();

console.log(`\n${passed}개 통과, ${failed}개 실패 (총 데이터 ${DATA.length}건)`);
process.exit(failed > 0 ? 1 : 0);
