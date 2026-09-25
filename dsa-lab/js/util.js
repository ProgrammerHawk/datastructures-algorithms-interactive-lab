/* Shared helpers: DOM, SVG, keyed scene graph, layout math. */
(function () {
  const DSA = (window.DSA = window.DSA || {});
  const SVGNS = "http://www.w3.org/2000/svg";

  DSA.$ = (sel, root) => (root || document).querySelector(sel);
  DSA.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* Lesson registry — must exist before any lesson file runs. */
  DSA.lessons = [];
  DSA.lesson = (def) => DSA.lessons.push(def);

  /* Shared arrowhead markers, added once per <svg>. */
  DSA.ensureDefs = function (svg) {
    if (svg.querySelector("defs")) return;
    const defs = document.createElementNS(SVGNS, "defs");
    defs.innerHTML =
      '<marker id="arw" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
      '<path d="M 0 0 L 10 5 L 0 10 z" fill="#7fae95"/></marker>' +
      '<marker id="arwHot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">' +
      '<path d="M 0 0 L 10 5 L 0 10 z" fill="#0891b2"/></marker>';
    svg.appendChild(defs);
  };

  DSA.el = function (tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs)
      for (const k in attrs) {
        if (k === "class") n.className = attrs[k];
        else if (k === "html") n.innerHTML = attrs[k];
        else if (k === "text") n.textContent = attrs[k];
        else if (k.startsWith("on") && typeof attrs[k] === "function")
          n.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
      }
    (children || []).forEach((c) => n.appendChild(c));
    return n;
  };

  DSA.esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  DSA.clone = (o) => JSON.parse(JSON.stringify(o));

  /* ---------------------------------------------------------------
   * Scene: a keyed SVG renderer.
   * Reusing the same DOM node for a given key is what lets CSS
   * transitions animate movement instead of redrawing from scratch.
   * ------------------------------------------------------------- */
  DSA.Scene = class Scene {
    constructor(svg) {
      this.svg = svg;
      this.items = new Map();
      this.seen = new Set();
    }
    clear() {
      this.items.forEach((n) => n.remove());
      this.items.clear();
    }
    begin() {
      this.seen.clear();
    }
    /** add/update a keyed element; returns the live DOM node */
    put(key, tag, attrs, text) {
      let node = this.items.get(key);
      let fresh = false;
      if (!node || node.tagName.toLowerCase() !== tag) {
        if (node) node.remove();
        node = document.createElementNS(SVGNS, tag);
        this.svg.appendChild(node);
        this.items.set(key, node);
        fresh = true;
      }
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null) node.removeAttribute(k);
        else node.setAttribute(k, v);
      }
      if (text != null && node.textContent !== String(text)) node.textContent = text;
      if (fresh) {
        node.classList.add("is-new");
        setTimeout(() => node.classList.remove("is-new"), 420);
      }
      this.seen.add(key);
      return node;
    }
    /** remove anything not touched since begin() */
    end() {
      for (const [k, node] of Array.from(this.items)) {
        if (!this.seen.has(k)) {
          node.remove();
          this.items.delete(k);
        }
      }
      // keep text/labels painted above shapes
      const labels = [];
      this.items.forEach((n) => {
        if (n.tagName === "text") labels.push(n);
      });
      labels.forEach((n) => this.svg.appendChild(n));
    }
  };

  /** Set the viewBox with padding so content is centred and fully visible. */
  DSA.fit = function (svg, minX, minY, maxX, maxY, pad) {
    pad = pad == null ? 26 : pad;
    const w = Math.max(1, maxX - minX + pad * 2);
    const h = Math.max(1, maxY - minY + pad * 2);
    svg.setAttribute("viewBox", `${minX - pad} ${minY - pad} ${w} ${h}`);
  };

  DSA.COLORS = {
    idle: "#dcf0e5",
    idleLine: "#a8cbb8",
    active: "#10b981",
    activeLine: "#34d399",
    visit: "#0891b2",
    done: "#059669",
    warn: "#d97706",
    bad: "#e11d48",
    purple: "#8b5cf6",
    dim: "#eaf3ed",
    dimLine: "#c3ddcd",
  };

  DSA.legend = function (host, entries) {
    host.innerHTML = "";
    entries.forEach((e) => {
      const s = DSA.el("span");
      s.appendChild(DSA.el("i", { style: `background:${e.color}` }));
      s.appendChild(document.createTextNode(e.label));
      host.appendChild(s);
    });
  };

  /* Build a control row: buttons, number inputs, selects. */
  DSA.controls = function (host, spec) {
    host.innerHTML = "";
    const refs = {};
    spec.forEach((c) => {
      if (c.type === "button") {
        const b = DSA.el("button", { class: "ctl-btn " + (c.variant || ""), text: c.label });
        b.addEventListener("click", () => c.onClick(refs));
        host.appendChild(b);
        if (c.name) refs[c.name] = b;
      } else if (c.type === "input") {
        if (c.label) host.appendChild(DSA.el("span", { class: "ctl-label", text: c.label }));
        const i = DSA.el("input", {
          class: "ctl-input",
          type: c.inputType || "text",
          value: c.value == null ? "" : c.value,
          placeholder: c.placeholder || "",
        });
        host.appendChild(i);
        refs[c.name] = i;
      } else if (c.type === "select") {
        if (c.label) host.appendChild(DSA.el("span", { class: "ctl-label", text: c.label }));
        const s = DSA.el("select", { class: "ctl-select" });
        c.options.forEach((o) =>
          s.appendChild(DSA.el("option", { value: o.value, text: o.label }))
        );
        if (c.value != null) s.value = c.value;
        if (c.onChange) s.addEventListener("change", () => c.onChange(refs));
        host.appendChild(s);
        refs[c.name] = s;
      } else if (c.type === "text") {
        host.appendChild(DSA.el("span", { class: "ctl-label", text: c.label }));
      }
    });
    return refs;
  };

  /** Read an integer from a control input, with fallback + range clamp. */
  DSA.readInt = function (input, fallback, lo, hi) {
    let v = parseInt(String(input && input.value).trim(), 10);
    if (isNaN(v)) v = fallback;
    if (lo != null) v = Math.max(lo, v);
    if (hi != null) v = Math.min(hi, v);
    return v;
  };

  DSA.randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

  /* ---- Pseudocode rendering + line highlight ---- */
  DSA.renderPseudo = function (host, lines) {
    host.innerHTML = "";
    lines.forEach((ln, i) => {
      const div = DSA.el("span", { class: "pl", "data-line": i });
      const isComment = /^\s*(\/\/|#)/.test(ln);
      div.innerHTML = isComment
        ? `<span class="pc">${DSA.esc(ln)}</span>`
        : DSA.esc(ln) || "&nbsp;";
      host.appendChild(div);
    });
  };

  DSA.highlightLine = function (host, line) {
    DSA.$$(".pl", host).forEach((n) => {
      const on = String(n.dataset.line) === String(line);
      n.classList.toggle("on", on);
    });
  };

  /* ---- Trace tables ---- */
  DSA.traceTable = function (host, cols, rows, hotCol) {
    if (!rows || !rows.length) { host.innerHTML = ""; return; }
    let html = "<table><thead><tr>";
    cols.forEach((c) => (html += `<th>${DSA.esc(c)}</th>`));
    html += "</tr></thead><tbody>";
    rows.forEach((r) => {
      html += "<tr>";
      r.forEach((cell, i) => {
        const hot = hotCol != null && i === hotCol;
        html += `<td class="${hot ? "hot" : ""}">${cell == null ? "" : DSA.esc(cell)}</td>`;
      });
      html += "</tr>";
    });
    html += "</tbody></table>";
    host.innerHTML = html;
  };

  DSA.chips = function (label, arr, empty) {
    const inner = !arr || !arr.length
      ? `<span class="chip" style="opacity:.5">${DSA.esc(empty || "empty")}</span>`
      : arr.map((v) => `<span class="chip">${DSA.esc(v)}</span>`).join("");
    return `<div style="margin:2px 0"><span style="color:var(--dim)">${DSA.esc(label)}</span> ${inner}</div>`;
  };
})();
