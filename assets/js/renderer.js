// revlibc-atlas DOM 렌더링 유틸리티 (순수 함수 위주, 상태는 app.js가 관리)
(function (global) {
  "use strict";

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  var IMPORTANCE_CLASS = {
    Critical: "badge-critical",
    High: "badge-high",
    Medium: "badge-medium",
    Low: "badge-low",
  };

  function importanceBadge(importance) {
    if (!importance) return "";
    var cls = IMPORTANCE_CLASS[importance] || "badge-low";
    return '<span class="badge ' + cls + '">' + escapeHtml(importance) + "</span>";
  }

  function platformBadges(platforms) {
    return (platforms || [])
      .map(function (p) {
        return '<span class="badge badge-platform">' + escapeHtml(p) + "</span>";
      })
      .join("");
  }

  // mprotect류: 결과 리스트에 표시할 "빠른 설명" 한 줄 (요구사항 #16)
  function quickHint(entry) {
    var bits = [];
    if (entry.category) bits.push(entry.category);
    if (entry.platform && entry.platform.length) bits.push(entry.platform.join("/"));
    var importance = entry.reversing && entry.reversing.importance;
    if (importance) bits.push(importance);
    return bits.join(" · ");
  }

  function renderResultItem(entry, isSelected) {
    var li = document.createElement("li");
    li.className = "result-item" + (isSelected ? " selected" : "");
    li.setAttribute("data-id", entry.id);
    li.setAttribute("role", "option");
    li.id = "result-" + entry.id;

    var importance = entry.reversing && entry.reversing.importance;
    li.innerHTML =
      '<div class="result-row1">' +
        '<span class="result-name">' + escapeHtml(entry.name) + "</span>" +
        importanceBadge(importance) +
        platformBadges(entry.platform) +
      "</div>" +
      '<div class="result-meta">' + escapeHtml(quickHint(entry)) + "</div>" +
      '<div class="result-summary">' + escapeHtml(entry.summary || "") + "</div>";
    return li;
  }

  function renderResultsList(listEl, entries, selectedId, maxRender) {
    listEl.innerHTML = "";
    var limit = typeof maxRender === "number" ? maxRender : entries.length;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < Math.min(entries.length, limit); i++) {
      frag.appendChild(renderResultItem(entries[i], entries[i].id === selectedId));
    }
    listEl.appendChild(frag);
  }

  function codeBlock(code, lang) {
    if (!code) return "";
    var id = "code-" + Math.random().toString(36).slice(2, 9);
    return (
      '<div class="code-block">' +
        '<div class="code-toolbar">' +
          '<span class="code-lang">' + escapeHtml(lang || "") + "</span>" +
          '<button type="button" class="copy-btn" data-copy-target="' + id + '">Copy</button>' +
        "</div>" +
        '<pre><code id="' + id + '">' + escapeHtml(code) + "</code></pre>" +
      "</div>"
    );
  }

  function section(title, innerHtml) {
    if (!innerHtml) return "";
    return (
      '<section class="detail-section">' +
        "<h3>" + escapeHtml(title) + "</h3>" +
        '<div class="detail-section-body">' + innerHtml + "</div>" +
      "</section>"
    );
  }

  function renderParameters(params) {
    if (!params || !params.length) return "";
    var rows = params
      .map(function (p) {
        var flags = [];
        if (p.direction) flags.push(p.direction);
        if (p.nullable) flags.push("nullable");
        return (
          "<tr>" +
            "<td><code>" + escapeHtml(p.name || "") + "</code></td>" +
            "<td><code>" + escapeHtml(p.type || "") + "</code></td>" +
            "<td>" + escapeHtml(p.desc || "") + "</td>" +
            "<td>" + escapeHtml(flags.join(", ")) + "</td>" +
          "</tr>"
        );
      })
      .join("");
    return (
      '<table class="param-table"><thead><tr>' +
        "<th>name</th><th>type</th><th>설명</th><th>flags</th>" +
      "</tr></thead><tbody>" + rows + "</tbody></table>"
    );
  }

  function renderReturnValue(rv) {
    if (!rv) return "";
    var lines = [];
    if (rv.success !== undefined && rv.success !== "") {
      lines.push('<div class="rv-row rv-success"><strong>성공</strong> = <code>' + escapeHtml(rv.success) + "</code></div>");
    }
    if (rv.failure !== undefined && rv.failure !== "") {
      lines.push('<div class="rv-row rv-failure"><strong>실패</strong> = <code>' + escapeHtml(rv.failure) + "</code></div>");
    }
    if (rv.meaning) {
      lines.push('<div class="rv-row rv-meaning">' + escapeHtml(rv.meaning) + "</div>");
    }
    var flags = [];
    if (rv.errno) flags.push("errno 설정됨");
    if (rv.get_last_error) flags.push("GetLastError() 로 확인");
    if (flags.length) {
      lines.push('<div class="rv-row rv-flags">' + escapeHtml(flags.join(" / ")) + "</div>");
    }
    return lines.join("");
  }

  function renderConstants(constants) {
    if (!constants || !constants.length) return "";
    var rows = constants
      .map(function (c) {
        return (
          "<tr><td><code>" + escapeHtml(c.name || "") + "</code></td>" +
          "<td><code>" + escapeHtml(String(c.decimal)) + "</code></td>" +
          "<td><code>" + escapeHtml(c.hex || "") + "</code></td>" +
          "<td>" + escapeHtml(c.desc || "") + "</td></tr>"
        );
      })
      .join("");
    return (
      '<table class="const-table"><thead><tr>' +
        "<th>name</th><th>decimal</th><th>hex</th><th>설명</th>" +
      "</tr></thead><tbody>" + rows + "</tbody></table>"
    );
  }

  function renderNumericConstants(list) {
    if (!list || !list.length) return "";
    var rows = list
      .map(function (c) {
        return (
          "<tr><td><code>" + escapeHtml(String(c.decimal)) + "</code></td>" +
          "<td><code>" + escapeHtml(c.hex || "") + "</code></td>" +
          "<td>" + escapeHtml(c.label || "") + "</td></tr>"
        );
      })
      .join("");
    return (
      '<table class="const-table"><thead><tr>' +
        "<th>decimal</th><th>hex</th><th>의미</th>" +
      "</tr></thead><tbody>" + rows + "</tbody></table>"
    );
  }

  function renderList(items) {
    if (!items || !items.length) return "";
    return "<ul class=\"plain-list\">" + items.map(function (i) { return "<li>" + escapeHtml(i) + "</li>"; }).join("") + "</ul>";
  }

  function renderRelated(relatedIds, dataById, onNavigate) {
    if (!relatedIds || !relatedIds.length) return "";
    var html = relatedIds
      .map(function (id) {
        var e = dataById[id];
        var label = e ? e.name : id;
        return '<button type="button" class="related-chip" data-nav-id="' + escapeHtml(id) + '">' + escapeHtml(label) + "</button>";
      })
      .join("");
    return '<div class="related-chips">' + html + "</div>";
  }

  function renderEquivalents(eq) {
    if (!eq || (!eq.linux && !eq.windows)) return "";
    return (
      '<div class="equiv-row">' +
        '<div class="equiv-col"><div class="equiv-label">Linux</div><code>' + escapeHtml(eq.linux || "-") + "</code></div>" +
        '<div class="equiv-arrow">↔</div>' +
        '<div class="equiv-col"><div class="equiv-label">Windows</div><code>' + escapeHtml(eq.windows || "-") + "</code></div>" +
      "</div>"
    );
  }

  function renderSources(sources) {
    if (!sources || !sources.length) return "";
    return (
      '<ul class="source-list">' +
        sources
          .map(function (s) {
            if (s.url) {
              return "<li>" + escapeHtml(s.title || s.url) + ' <span class="source-url">(' + escapeHtml(s.url) + ")</span></li>";
            }
            return "<li>" + escapeHtml(s.title || "") + "</li>";
          })
          .join("") +
      "</ul>"
    );
  }

  // 요구사항.md #6 순서를 그대로 따른다.
  function renderDetail(entry) {
    if (!entry) {
      return '<div class="detail-empty">왼쪽 목록에서 항목을 선택하거나 검색어를 입력하세요.<br>' +
        '<span class="hint">단축키: <kbd>/</kbd> 또는 <kbd>Ctrl</kbd>+<kbd>K</kbd> 로 검색창 포커스, ' +
        "<kbd>↑</kbd>/<kbd>↓</kbd> 이동, <kbd>Enter</kbd> 상세보기, <kbd>Esc</kbd> 닫기</span></div>";
    }

    var rev = entry.reversing || {};
    var head =
      '<div class="detail-header">' +
        "<h2>" + escapeHtml(entry.name) + "</h2>" +
        importanceBadge(rev.importance) +
        platformBadges(entry.platform) +
      "</div>" +
      '<p class="detail-summary">' + escapeHtml(entry.summary || "") + "</p>";

    var metaBits = [];
    if (entry.header) metaBits.push('<div><span class="meta-label">Header</span><code>' + escapeHtml(entry.header) + "</code></div>");
    if (entry.library) metaBits.push('<div><span class="meta-label">Library</span><code>' + escapeHtml(entry.library) + "</code></div>");
    if (entry.standard) metaBits.push('<div><span class="meta-label">Standard</span><code>' + escapeHtml(entry.standard) + "</code></div>");
    if (entry.aliases && entry.aliases.length) {
      metaBits.push('<div><span class="meta-label">Aliases</span><code>' + escapeHtml(entry.aliases.join(", ")) + "</code></div>");
    }
    var metaBlock = metaBits.length ? '<div class="meta-grid">' + metaBits.join("") + "</div>" : "";

    var html = head + metaBlock;
    html += section("Prototype", entry.signature ? codeBlock(entry.signature, "c") : "");
    html += section("Parameters", renderParameters(entry.parameters));
    html += section("Return Value", renderReturnValue(entry.return_value));
    html += section("Constants / Flags", renderConstants(entry.constants) + renderNumericConstants(entry.numeric_constants));
    if (entry.example_code) {
      var exampleHtml = codeBlock(entry.example_code, "c");
      if (entry.compile_cmd) {
        exampleHtml += '<div class="compile-cmd">$ ' + escapeHtml(entry.compile_cmd) + "</div>";
      }
      html += section("Example", exampleHtml);
    }
    html += section("Expected Output", entry.example_output ? codeBlock(entry.example_output, "text") : "");
    html += section("What it really does", entry.internals ? "<p>" + escapeHtml(entry.internals) + "</p>" : "");

    var revHtml = "";
    if (rev.notes) revHtml += "<p>" + escapeHtml(rev.notes) + "</p>";
    html += section("Reversing Notes", revHtml);

    var decompHtml = "";
    if (rev.decompiler_pattern) decompHtml += codeBlock(rev.decompiler_pattern, "c");
    if (rev.ida_example) decompHtml += codeBlock(rev.ida_example, "c");
    html += section("Decompiler Example", decompHtml);

    html += section("Assembly Pattern", entry.assembly_pattern ? "<p>" + escapeHtml(entry.assembly_pattern) + "</p>" : "");
    html += section("Common Mistakes", renderList(entry.pitfalls));
    html += section("Security Notes", entry.security_notes ? "<p>" + escapeHtml(entry.security_notes) + "</p>" : "");
    html += section("Linux ↔ Windows", renderEquivalents(entry.equivalents));
    html += section("Related Functions", renderRelated(entry.related, global.__revlibcDataById || {}));
    html += section("Sources", renderSources(entry.sources));

    return html;
  }

  var api = {
    escapeHtml: escapeHtml,
    renderResultItem: renderResultItem,
    renderResultsList: renderResultsList,
    renderDetail: renderDetail,
    quickHint: quickHint,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    global.RevlibcRenderer = api;
  }
})(typeof window !== "undefined" ? window : this);
