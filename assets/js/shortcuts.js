// revlibc-atlas 전역 키보드 단축키 (요구사항.md #12, #19 참고)
//   /        검색창 포커스 (검색창 자체에 입력 중이 아닐 때만)
//   Ctrl+K   검색창 포커스 (항상)
//   ArrowUp/Down  결과 목록 이동
//   Enter    선택된 항목 상세 보기로 포커스 이동
//   Esc      검색창이면 비우기, 아니면 검색창으로 포커스 복귀
(function (global) {
  "use strict";

  function isTypingTarget(el) {
    if (!el) return false;
    var tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
  }

  // handlers: { focusSearch, moveSelection(delta), openSelected, onEscape }
  function install(handlers) {
    document.addEventListener("keydown", function (e) {
      var target = e.target;

      if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handlers.focusSearch();
        return;
      }

      if (e.key === "/" && !isTypingTarget(target)) {
        e.preventDefault();
        handlers.focusSearch();
        return;
      }

      if (e.key === "ArrowDown") {
        if (isTypingTarget(target) && target.id !== "search-input") return;
        e.preventDefault();
        handlers.moveSelection(1);
        return;
      }

      if (e.key === "ArrowUp") {
        if (isTypingTarget(target) && target.id !== "search-input") return;
        e.preventDefault();
        handlers.moveSelection(-1);
        return;
      }

      if (e.key === "Enter") {
        if (target && target.id === "search-input") {
          e.preventDefault();
          handlers.openSelected();
        }
        return;
      }

      if (e.key === "Escape") {
        handlers.onEscape();
        return;
      }
    });
  }

  var api = { install: install };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    global.RevlibcShortcuts = api;
  }
})(typeof window !== "undefined" ? window : this);
