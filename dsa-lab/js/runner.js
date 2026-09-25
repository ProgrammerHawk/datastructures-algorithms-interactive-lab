/* Code playground: highlighted Java editor + interpreted execution + assertions. */
(function () {
  const DSA = (window.DSA = window.DSA || {});

  const KEYWORDS =
    "abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|extends|final|finally|float|for|goto|if|implements|import|instanceof|int|interface|long|native|new|package|private|protected|public|return|short|static|strictfp|super|switch|synchronized|this|throw|throws|transient|try|void|volatile|while|true|false|null|var|record|sealed";

  const TYPES =
    "String|Integer|Double|Boolean|Character|Object|ArrayList|List|HashMap|Map|HashSet|Set|ArrayDeque|Deque|Queue|LinkedList|StringBuilder|Math|System|Arrays|Iterable|Comparable";

  // One pass over the source so we never inject markup inside another token.
  const TOKEN = new RegExp(
    [
      "(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)",
      "(\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*')",
      "\\b(" + KEYWORDS + ")\\b",
      "\\b(" + TYPES + ")\\b",
      "\\b(\\d+(?:\\.\\d+)?)\\b",
      "\\b([A-Za-z_$][\\w$]*)(?=\\s*\\()",
    ].join("|"),
    "g"
  );

  DSA.highlight = function (src) {
    let out = "";
    let last = 0;
    src.replace(TOKEN, function (m, comment, str, kw, type, num, fn, off) {
      out += DSA.esc(src.slice(last, off));
      const cls = comment ? "c" : str ? "s" : kw ? "k" : type ? "t" : num ? "n" : "f";
      out += `<span class="${cls}">${DSA.esc(m)}</span>`;
      last = off + m.length;
      return m;
    });
    out += DSA.esc(src.slice(last));
    return out;
  };

  DSA.Editor = class Editor {
    constructor(textarea, hl, gutter) {
      this.ta = textarea;
      this.hl = hl;
      this.gutter = gutter;
      this.ta.addEventListener("input", () => this.sync());
      this.ta.addEventListener("scroll", () => this.syncScroll());
      this.ta.addEventListener("keydown", (e) => this.onKey(e));
    }
    setValue(v) {
      this.ta.value = v;
      this.sync();
      this.ta.scrollTop = 0;
      this.syncScroll();
    }
    getValue() { return this.ta.value; }
    sync() {
      const src = this.ta.value;
      // trailing newline keeps the last line visible in the overlay
      this.hl.innerHTML = DSA.highlight(src) + "\n";
      const n = src.split("\n").length;
      let g = "";
      for (let i = 1; i <= n; i++) g += i + "\n";
      this.gutter.textContent = g;
      this.syncScroll();
    }
    syncScroll() {
      this.hl.scrollTop = this.ta.scrollTop;
      this.hl.scrollLeft = this.ta.scrollLeft;
      this.gutter.scrollTop = this.ta.scrollTop;
    }
    onKey(e) {
      if (e.key === "Tab") {
        e.preventDefault();
        const s = this.ta.selectionStart, en = this.ta.selectionEnd;
        this.ta.value = this.ta.value.slice(0, s) + "  " + this.ta.value.slice(en);
        this.ta.selectionStart = this.ta.selectionEnd = s + 2;
        this.sync();
      }
    }
  };

  function fmt(v) {
    if (typeof v === "string") return v;
    if (v === undefined) return "undefined";
    try { return JSON.stringify(v); } catch (e) { return String(v); }
  }

  /* Order-insensitive deep equality, so HashMap iteration order never matters. */
  function deepEq(a, b) {
    if (a === b) return true;
    if (a === null || b === null || a === undefined || b === undefined) return a === b;
    if (typeof a === "number" && typeof b === "number")
      return a === b || (Math.abs(a - b) < 1e-9 && isFinite(a) && isFinite(b));
    if (Array.isArray(a) || Array.isArray(b)) {
      if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
      return a.every((x, i) => deepEq(x, b[i]));
    }
    if (typeof a === "object" && typeof b === "object") {
      const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
      if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
      return ka.every((k) => deepEq(a[k], b[k]));
    }
    return false;
  }

  /* Assertion helpers handed to each test. */
  function makeAssert() {
    return {
      eq(actual, expected, label) {
        if (!deepEq(actual, expected))
          throw new Error(`${label || "expected"} ${fmt(expected)}, got ${fmt(actual)}`);
      },
      ok(cond, label) {
        if (!cond) throw new Error(label || "expected a truthy value");
      },
      throws(fn, label) {
        let threw = false;
        try { fn(); } catch (e) { threw = true; }
        if (!threw) throw new Error(label || "expected the call to throw");
      },
    };
  }

  /** Compile the learner's Java and pull out the exported classes. */
  DSA.runCode = function (src, exportNames) {
    const res = DSA.runJava(src, exportNames || []);
    if (!res.ok) return { ok: false, error: res.error, logs: res.logs, exports: {} };
    const missing = (exportNames || []).filter((n) => !res.exports[n]);
    if (missing.length)
      return {
        ok: false,
        error: new Error("Could not find class " + missing.map((m) => "'" + m + "'").join(", ")),
        logs: res.logs,
        exports: {},
      };
    return { ok: true, exports: res.exports, logs: res.logs };
  };

  /** Run a lesson's tests and paint pass/fail rows. */
  DSA.runTests = function (opts) {
    const { src, spec, resultsEl, consoleEl, summaryEl } = opts;
    resultsEl.innerHTML = "";
    consoleEl.textContent = "";
    summaryEl.textContent = "";
    summaryEl.className = "run-summary";

    const run = DSA.runCode(src, spec.exports);

    if (run.logs.length) consoleEl.textContent = run.logs.join("\n");

    if (!run.ok) {
      consoleEl.innerHTML =
        (run.logs.length ? DSA.esc(run.logs.join("\n")) + "\n" : "") +
        `<span class="err">${DSA.esc(run.error.message)}</span>`;
      summaryEl.textContent = "Could not run — fix the error above.";
      summaryEl.className = "run-summary fail";
      return { passed: 0, total: spec.tests.length };
    }

    const assert = makeAssert();
    let passed = 0;

    spec.tests.forEach((t) => {
      let ok = true, msg = "";
      try {
        t.run(run.exports, assert);
      } catch (err) {
        ok = false;
        msg = err && err.message ? err.message : String(err);
      }
      if (ok) passed++;
      const row = DSA.el("div", { class: "test-row " + (ok ? "pass" : "fail") });
      row.appendChild(DSA.el("span", { class: "test-icon", text: ok ? "✓" : "✗" }));
      const body = DSA.el("div");
      body.appendChild(DSA.el("div", { text: t.name }));
      if (!ok) body.appendChild(DSA.el("div", { class: "test-msg", text: msg }));
      row.appendChild(body);
      resultsEl.appendChild(row);
    });

    const total = spec.tests.length;
    summaryEl.textContent = `${passed}/${total} passing`;
    summaryEl.className = "run-summary " + (passed === total ? "pass" : "fail");
    if (!run.logs.length && passed === total)
      consoleEl.textContent = "All good — nothing logged.";
    return { passed, total };
  };
})();
