// revlibc-atlas 애플리케이션 진입점.
// window.REVLIBC_DATA / REVLIBC_SEARCH_INDEX / REVLIBC_META 는
// data/generated/*.js 가 <script> 로 미리 로드해 둔 전역이다 (fetch 없음, file:// 안전).
(function () {
  "use strict";

  var MAX_RENDER = 50;

  var state = {
    query: "",
    filters: { platform: "all", category: "all", importance: "all" },
    ctfMode: false,
    darkMode: true,
    results: [],
    selectedIndex: 0,
  };

  var dataById = {};
  (window.REVLIBC_DATA || []).forEach(function (e) {
    dataById[e.id] = e;
  });
  window.__revlibcDataById = dataById; // renderer.js의 related 링크 표시용

  var els = {};

  function qs(id) {
    return document.getElementById(id);
  }

  function cacheEls() {
    els.searchInput = qs("search-input");
    els.resultsList = qs("results-list");
    els.resultsCount = qs("results-count");
    els.detailPanel = qs("detail-panel");
    els.platformFilters = qs("filter-platform");
    els.categoryFilters = qs("filter-category");
    els.importanceFilters = qs("filter-importance");
    els.ctfModeBtn = qs("ctf-mode-toggle");
    els.darkModeBtn = qs("dark-mode-toggle");
    els.clearFiltersBtn = qs("clear-filters");
    els.searchTime = qs("search-time");
  }

  function loadLocal(key, fallback) {
    try {
      var v = window.localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }
  function saveLocal(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      /* file:// 환경 등에서 localStorage가 막혀 있어도 앱은 계속 동작해야 함 */
    }
  }

  function buildFilterButtons(container, items, filterKey, allLabel) {
    container.innerHTML = "";
    var allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = "filter-btn active";
    allBtn.textContent = allLabel;
    allBtn.setAttribute("data-value", "all");
    container.appendChild(allBtn);

    items.forEach(function (item) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-btn";
      btn.textContent = item.label;
      btn.setAttribute("data-value", item.id);
      container.appendChild(btn);
    });

    container.addEventListener("click", function (e) {
      var btn = e.target.closest(".filter-btn");
      if (!btn) return;
      Array.prototype.forEach.call(container.querySelectorAll(".filter-btn"), function (b) {
        b.classList.remove("active");
      });
      btn.classList.add("active");
      state.filters[filterKey] = btn.getAttribute("data-value");
      state.selectedIndex = 0;
      runSearch();
    });
  }

  var IMPORTANCE_ITEMS = [
    { id: "Critical", label: "Critical" },
    { id: "High", label: "High" },
    { id: "Medium", label: "Medium" },
    { id: "Low", label: "Low" },
  ];

  function initFilters() {
    var meta = window.REVLIBC_META || { categories: [], platforms: [] };
    buildFilterButtons(els.platformFilters, meta.platforms, "platform", "All");
    buildFilterButtons(els.categoryFilters, meta.categories, "category", "All");
    buildFilterButtons(els.importanceFilters, IMPORTANCE_ITEMS, "importance", "All");
  }

  function resetFilterButtons() {
    [els.platformFilters, els.categoryFilters, els.importanceFilters].forEach(function (container) {
      Array.prototype.forEach.call(container.querySelectorAll(".filter-btn"), function (b) {
        b.classList.toggle("active", b.getAttribute("data-value") === "all");
      });
    });
  }

  function runSearch() {
    var t0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : 0;
    var index = window.REVLIBC_SEARCH_INDEX || {};
    state.results = window.RevlibcSearch.search(index, state.query, state.filters, state.ctfMode);
    var t1 = (typeof performance !== "undefined" && performance.now) ? performance.now() : 0;

    if (state.selectedIndex >= state.results.length) state.selectedIndex = 0;
    renderResults();
    if (els.searchTime) {
      els.searchTime.textContent = state.results.length + "건 · " + (t1 - t0).toFixed(1) + "ms";
    }
  }

  function currentEntries() {
    return state.results.map(function (r) {
      return dataById[r.id];
    }).filter(Boolean);
  }

  function renderResults() {
    var entries = currentEntries();
    var selectedId = entries[state.selectedIndex] ? entries[state.selectedIndex].id : null;
    window.RevlibcRenderer.renderResultsList(els.resultsList, entries, selectedId, MAX_RENDER);

    if (entries.length > MAX_RENDER) {
      var more = document.createElement("li");
      more.className = "results-more-hint";
      more.textContent = "+" + (entries.length - MAX_RENDER) + "개 더 있음. 검색어를 구체화하세요.";
      els.resultsList.appendChild(more);
    }

    els.resultsCount.textContent = entries.length + "개 결과";
    renderDetailFor(entries[state.selectedIndex] || null);
    scrollSelectedIntoView();
  }

  function renderDetailFor(entry) {
    els.detailPanel.innerHTML = window.RevlibcRenderer.renderDetail(entry);
  }

  function scrollSelectedIntoView() {
    var selected = els.resultsList.querySelector(".result-item.selected");
    if (selected && selected.scrollIntoView) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }

  function moveSelection(delta) {
    var entries = currentEntries();
    if (!entries.length) return;
    var max = Math.min(entries.length, MAX_RENDER);
    state.selectedIndex = (state.selectedIndex + delta + max) % max;
    renderResults();
  }

  function selectById(id) {
    var entry = dataById[id];
    if (!entry) return;
    // 현재 필터 때문에 결과에 없을 수 있으므로 필터를 초기화하고 이름으로 재검색한다.
    state.filters = { platform: "all", category: "all", importance: "all" };
    resetFilterButtons();
    state.query = entry.name;
    els.searchInput.value = entry.name;
    runSearch();
    var entries = currentEntries();
    var idx = entries.findIndex(function (e) { return e.id === id; });
    state.selectedIndex = idx >= 0 ? idx : 0;
    renderResults();
  }

  function focusSearch() {
    els.searchInput.focus();
    els.searchInput.select();
  }

  function applyDarkMode() {
    document.documentElement.classList.toggle("light-mode", !state.darkMode);
    if (els.darkModeBtn) {
      els.darkModeBtn.textContent = state.darkMode ? "☾ Dark" : "☀ Light";
      els.darkModeBtn.setAttribute("aria-pressed", String(state.darkMode));
    }
  }

  function applyCtfMode() {
    if (els.ctfModeBtn) {
      els.ctfModeBtn.classList.toggle("active", state.ctfMode);
      els.ctfModeBtn.setAttribute("aria-pressed", String(state.ctfMode));
    }
  }

  function wireEvents() {
    els.searchInput.addEventListener("input", function () {
      state.query = els.searchInput.value;
      state.selectedIndex = 0;
      runSearch();
    });

    els.ctfModeBtn.addEventListener("click", function () {
      state.ctfMode = !state.ctfMode;
      applyCtfMode();
      runSearch();
    });

    els.darkModeBtn.addEventListener("click", function () {
      state.darkMode = !state.darkMode;
      saveLocal("revlibc-dark-mode", state.darkMode ? "1" : "0");
      applyDarkMode();
    });

    els.clearFiltersBtn.addEventListener("click", function () {
      state.filters = { platform: "all", category: "all", importance: "all" };
      resetFilterButtons();
      state.selectedIndex = 0;
      runSearch();
    });

    els.resultsList.addEventListener("click", function (e) {
      var li = e.target.closest(".result-item");
      if (!li) return;
      selectById(li.getAttribute("data-id"));
      var entries = currentEntries();
      var idx = entries.findIndex(function (en) { return en.id === li.getAttribute("data-id"); });
      if (idx >= 0) state.selectedIndex = idx;
      renderResults();
    });

    els.detailPanel.addEventListener("click", function (e) {
      var chip = e.target.closest(".related-chip");
      if (chip) {
        selectById(chip.getAttribute("data-nav-id"));
        return;
      }
      var copyBtn = e.target.closest(".copy-btn");
      if (copyBtn) {
        var targetId = copyBtn.getAttribute("data-copy-target");
        var codeEl = document.getElementById(targetId);
        if (codeEl) copyText(codeEl.textContent, copyBtn);
      }
    });

    window.RevlibcShortcuts.install({
      focusSearch: focusSearch,
      moveSelection: moveSelection,
      openSelected: function () {
        els.detailPanel.scrollIntoView({ block: "start", behavior: "instant" in window ? "instant" : "auto" });
      },
      onEscape: function () {
        if (document.activeElement === els.searchInput && state.query) {
          state.query = "";
          els.searchInput.value = "";
          state.selectedIndex = 0;
          runSearch();
        } else {
          els.searchInput.blur();
        }
      },
    });
  }

  function copyText(text, btn) {
    function done(ok) {
      var original = btn.textContent;
      btn.textContent = ok ? "Copied!" : "Failed";
      setTimeout(function () {
        btn.textContent = original;
      }, 1200);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      return;
    }
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      done(true);
    } catch (e) {
      done(false);
    }
  }

  function init() {
    cacheEls();
    state.darkMode = loadLocal("revlibc-dark-mode", "1") !== "0";
    applyDarkMode();
    initFilters();
    applyCtfMode();
    wireEvents();
    runSearch();
    focusSearch();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
