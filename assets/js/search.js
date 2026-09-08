// revlibc-atlas 검색 엔진 (순수 JS, DOM 비의존)
//
// window.REVLIBC_SEARCH_INDEX (tools/build_index.py 가 생성) 를 대상으로
// 매 키 입력마다 in-memory 스코어링을 수행한다. 수천 항목 규모까지는
// Web Worker 없이도 충분히 빠르므로(선형 스캔 + 문자열 비교) 단순하게 구현했다.
//
// Node.js 에서도 그대로 require 해서 단위 테스트할 수 있도록 module.exports를
// 함께 노출한다 (tests/test_search.js 참고).
(function (global) {
  "use strict";

  // 랭킹 가중치 (AGENTS.md #19 표를 그대로 따름)
  var SCORE_EXACT_NAME = 1000;
  var SCORE_NAME_PREFIX = 850;
  var SCORE_ALIAS_EXACT = 800;
  var SCORE_CONSTANT_EXACT = 780;
  var SCORE_HEADER_EXACT = 500;
  var SCORE_TAG_EXACT = 450;
  var SCORE_TITLE_TOKEN = 400;
  var SCORE_BODY_SUBSTRING = 100;
  var SCORE_PHRASE_BONUS = 300; // 여러 단어 쿼리가 name 안에 통째로 포함될 때 추가 보너스

  var IMPORTANCE_RANK = { Critical: 3, High: 2, Medium: 1, Low: 0 };

  // CTF Mode에서 우선 노출할 항목 (요구사항.md #15)
  var CTF_PRIORITY_NAMES = [
    "strcmp", "strncmp", "memcmp", "strstr", "mprotect", "mmap",
    "dlopen", "dlsym", "ptrace", "execve", "virtualprotect", "virtualalloc",
    "getprocaddress", "loadlibrary", "loadlibrarya", "loadlibraryw",
    "isdebuggerpresent",
  ];
  var CTF_PRIORITY_SET = {};
  CTF_PRIORITY_NAMES.forEach(function (n, i) {
    CTF_PRIORITY_SET[n] = CTF_PRIORITY_NAMES.length - i; // 앞에 있을수록 높은 보너스
  });

  var HEX_RE = /^0x[0-9a-f]+$/i;
  var DEC_RE = /^[0-9]+$/;

  function toNumericVariants(term) {
    var out = null;
    if (HEX_RE.test(term)) {
      var dec = parseInt(term.slice(2), 16);
      if (!isNaN(dec)) {
        out = { decimal: dec, hexNoPrefix: term.slice(2).toLowerCase() };
      }
    } else if (DEC_RE.test(term)) {
      var d = parseInt(term, 10);
      if (!isNaN(d)) {
        out = { decimal: d, hexNoPrefix: d.toString(16).toLowerCase() };
      }
    }
    return out;
  }

  function splitQuery(raw) {
    var trimmed = (raw || "").trim().toLowerCase();
    if (!trimmed) return { terms: [], fullLower: "" };
    var terms = trimmed.split(/\s+/).filter(Boolean);
    return { terms: terms, fullLower: trimmed };
  }

  function matchConstant(list, term, numeric) {
    if (!list) return false;
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (numeric && (c.d === numeric.decimal || c.h === numeric.hexNoPrefix)) return true;
      if (c.n && c.n === term) return true;
      if (c.l && c.l === term) return true;
    }
    return false;
  }

  // 단일 term이 entry(index 레코드)와 얼마나 강하게 일치하는지 점수 반환.
  // 매치가 전혀 없으면 0을 반환한다 (호출부에서 0이면 term 매칭 실패로 처리).
  function scoreTerm(idx, term) {
    if (idx.nameLower === term) return SCORE_EXACT_NAME;
    if (idx.aliasesLower.indexOf(term) !== -1) return SCORE_ALIAS_EXACT;

    var numeric = toNumericVariants(term);
    if (matchConstant(idx.constantsExact, term, numeric)) return SCORE_CONSTANT_EXACT;
    if (matchConstant(idx.numericExact, term, numeric)) return SCORE_CONSTANT_EXACT;

    if (idx.nameLower.indexOf(term) === 0) return SCORE_NAME_PREFIX;
    if (idx.headerLower && idx.headerLower === term) return SCORE_HEADER_EXACT;
    if (idx.tagsLower.indexOf(term) !== -1) return SCORE_TAG_EXACT;
    if (idx.nameTokens.indexOf(term) !== -1) return SCORE_TITLE_TOKEN;

    if (idx.nameLower.indexOf(term) !== -1) return SCORE_BODY_SUBSTRING;
    if (idx.headerLower && idx.headerLower.indexOf(term) !== -1) return SCORE_BODY_SUBSTRING;
    for (var i = 0; i < idx.tagsLower.length; i++) {
      if (idx.tagsLower[i].indexOf(term) !== -1) return SCORE_BODY_SUBSTRING;
    }
    if (idx.textBlob.indexOf(term) !== -1) return SCORE_BODY_SUBSTRING;

    return 0;
  }

  function scoreEntry(idx, parsed, ctfMode) {
    var score;
    if (parsed.fullLower && (idx.nameLower === parsed.fullLower || idx.aliasesLower.indexOf(parsed.fullLower) !== -1)) {
      score = SCORE_EXACT_NAME;
    } else {
      score = 0;
      for (var i = 0; i < parsed.terms.length; i++) {
        var t = scoreTerm(idx, parsed.terms[i]);
        if (t === 0) return null; // AND 매칭: 한 단어라도 못 찾으면 제외
        score += t;
      }
      if (parsed.terms.length > 1 && idx.nameLower.indexOf(parsed.fullLower) !== -1) {
        score += SCORE_PHRASE_BONUS;
      }
    }

    if (ctfMode) {
      var bonus = CTF_PRIORITY_SET[idx.nameLower];
      if (bonus) score += 50 + bonus;
    }
    return score;
  }

  function passesFilters(idx, filters) {
    if (!filters) return true;
    if (filters.platform && filters.platform !== "all") {
      if (idx.platform.indexOf(filters.platform) === -1) return false;
    }
    if (filters.category && filters.category !== "all") {
      if (idx.category !== filters.category) return false;
    }
    if (filters.importance && filters.importance !== "all") {
      if (idx.importance !== filters.importance) return false;
    }
    if (filters.ctfOnly) {
      var isPriority = !!CTF_PRIORITY_SET[idx.nameLower];
      var isHighValue = idx.importance === "Critical" || idx.importance === "High";
      if (!isPriority && !isHighValue) return false;
    }
    return true;
  }

  function tieBreak(aIdx, bIdx) {
    var ai = IMPORTANCE_RANK[aIdx.importance] || 0;
    var bi = IMPORTANCE_RANK[bIdx.importance] || 0;
    if (ai !== bi) return bi - ai;
    return aIdx.nameLower < bIdx.nameLower ? -1 : aIdx.nameLower > bIdx.nameLower ? 1 : 0;
  }

  // 메인 검색 함수.
  // index: {id -> indexRecord} (window.REVLIBC_SEARCH_INDEX)
  // query: 사용자 입력 문자열
  // filters: { platform, category, importance, ctfOnly }
  // ctfMode: boolean (CTF Mode 토글 - 랭킹 부스트용, ctfOnly와는 별개로도 쓸 수 있음)
  // returns: [{id, score}] score desc 정렬
  function search(index, query, filters, ctfMode) {
    var parsed = splitQuery(query);
    var results = [];
    var ids = Object.keys(index);

    if (!parsed.terms.length) {
      // 빈 쿼리: 필터만 적용한 전체 목록 (CTF Mode 부스트 -> 중요도 desc -> 이름 asc)
      for (var i = 0; i < ids.length; i++) {
        var idx0 = index[ids[i]];
        if (!passesFilters(idx0, filters)) continue;
        var base = 0;
        if (ctfMode) {
          var b0 = CTF_PRIORITY_SET[idx0.nameLower];
          if (b0) base = 50 + b0;
        }
        results.push({ id: ids[i], score: base, idx: idx0 });
      }
      results.sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        return tieBreak(a.idx, b.idx);
      });
      return results.map(function (r) { return { id: r.id, score: r.score }; });
    }

    for (var j = 0; j < ids.length; j++) {
      var id = ids[j];
      var idx = index[id];
      if (!passesFilters(idx, filters)) continue;
      var score = scoreEntry(idx, parsed, ctfMode);
      if (score === null) continue;
      results.push({ id: id, score: score, idx: idx });
    }

    results.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return tieBreak(a.idx, b.idx);
    });

    return results.map(function (r) { return { id: r.id, score: r.score }; });
  }

  var api = {
    search: search,
    splitQuery: splitQuery,
    toNumericVariants: toNumericVariants,
    CTF_PRIORITY_NAMES: CTF_PRIORITY_NAMES,
    _scoreEntry: scoreEntry,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    global.RevlibcSearch = api;
  }
})(typeof window !== "undefined" ? window : this);
