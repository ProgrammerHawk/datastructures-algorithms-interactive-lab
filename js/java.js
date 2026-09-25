/* A small Java-subset interpreter so the playground can run real Java in the browser.
 * Types are parsed but not checked; int/double division semantics are honoured. */
(function () {
  const DSA = (window.DSA = window.DSA || {});

  /* ============================ values ============================ */
  function JDouble(v) { this.v = v; }          // marks a value as floating point
  function JChar(c) { this.c = c; }            // c is a char code
  function JList(a) { this.a = a || []; }      // ArrayList / List
  function JMap() { this.m = new Map(); }      // HashMap / Map
  function JSet() { this.m = new Map(); }      // HashSet (insertion ordered)
  function JDeque() { this.a = []; }           // ArrayDeque / LinkedList queue
  function JArray(a) { this.a = a; }           // Java array
  function JObj(cls) { this.cls = cls; this.f = new Map(); }

  const NATIVE = { JDouble, JChar, JList, JMap, JSet, JDeque, JArray, JObj };

  function num(v) {
    if (v instanceof JDouble) return v.v;
    if (v instanceof JChar) return v.c;
    if (typeof v === "boolean") return v ? 1 : 0;
    if (v === null || v === undefined) return 0;
    return v;
  }
  const isDbl = (v) => v instanceof JDouble || (typeof v === "number" && !Number.isInteger(v));
  const truthy = (v) => v === true || (typeof v === "number" && v !== 0);

  function jstr(v) {
    if (v === null || v === undefined) return "null";
    if (v && v.__exc) return v.__exc;
    if (v && v.__sb) return v.__sb[0];
    if (v instanceof JChar) return String.fromCharCode(v.c);
    if (v instanceof JDouble) return String(v.v);
    if (v instanceof JList) return "[" + v.a.map(jstr).join(", ") + "]";
    if (v instanceof JArray) return "[" + v.a.map(jstr).join(", ") + "]";
    if (v instanceof JSet) return "[" + Array.from(v.m.values()).map(jstr).join(", ") + "]";
    if (v instanceof JMap) {
      const out = [];
      v.m.forEach((val, k) => out.push(k + "=" + jstr(val)));
      return "{" + out.join(", ") + "}";
    }
    if (v instanceof JObj) return v.cls.name + "@obj";
    return String(v);
  }

  /* ============================ lexer ============================ */
  const KEYWORDS = new Set([
    "class", "interface", "extends", "implements", "new", "return", "if", "else", "while", "for",
    "do", "break", "continue", "static", "final", "public", "private", "protected", "abstract",
    "void", "int", "long", "short", "byte", "double", "float", "boolean", "char", "true", "false",
    "null", "this", "super", "import", "package", "throw", "throws", "try", "catch", "finally",
    "switch", "case", "default", "instanceof",
  ]);

  const OPS = [
    ">>>=", "<<=", ">>=", "...", "->", "++", "--", "+=", "-=", "*=", "/=", "%=", "==", "!=",
    "<=", ">=", "&&", "||", "<<", ">>", "&=", "|=", "^=",
    "+", "-", "*", "/", "%", "=", "<", ">", "!", "&", "|", "^", "~", "?", ":", ";", ",", ".",
    "(", ")", "[", "]", "{", "}",
  ];

  function lex(src) {
    const out = [];
    let i = 0, line = 1;
    const err = (m) => { throw new Error("Syntax error on line " + line + ": " + m); };
    while (i < src.length) {
      const c = src[i];
      if (c === "\n") { line++; i++; continue; }
      if (/\s/.test(c)) { i++; continue; }
      if (c === "/" && src[i + 1] === "/") { while (i < src.length && src[i] !== "\n") i++; continue; }
      if (c === "/" && src[i + 1] === "*") {
        i += 2;
        while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) { if (src[i] === "\n") line++; i++; }
        i += 2; continue;
      }
      if (/[0-9]/.test(c)) {
        let j = i, dot = false;
        while (j < src.length && /[0-9._]/.test(src[j])) { if (src[j] === ".") { if (dot) break; dot = true; } j++; }
        let raw = src.slice(i, j).replace(/_/g, "");
        if (/[dDfFlL]/.test(src[j] || "")) { if (/[dDfF]/.test(src[j])) dot = true; j++; }
        out.push({ t: dot ? "dbl" : "num", v: parseFloat(raw), line });
        i = j; continue;
      }
      if (c === '"') {
        let j = i + 1, s = "";
        while (j < src.length && src[j] !== '"') {
          if (src[j] === "\\") { s += unescapeChar(src[j + 1]); j += 2; }
          else s += src[j++];
        }
        if (j >= src.length) err("unterminated string");
        out.push({ t: "str", v: s, line });
        i = j + 1; continue;
      }
      if (c === "'") {
        let j = i + 1, ch;
        if (src[j] === "\\") { ch = unescapeChar(src[j + 1]); j += 2; }
        else ch = src[j++];
        if (src[j] !== "'") err("unterminated char literal");
        out.push({ t: "chr", v: ch.charCodeAt(0), line });
        i = j + 1; continue;
      }
      if (/[A-Za-z_$]/.test(c)) {
        let j = i;
        while (j < src.length && /[A-Za-z0-9_$]/.test(src[j])) j++;
        const w = src.slice(i, j);
        out.push({ t: KEYWORDS.has(w) ? "kw" : "id", v: w, line });
        i = j; continue;
      }
      const op = OPS.find((o) => src.startsWith(o, i));
      if (!op) err("unexpected character '" + c + "'");
      out.push({ t: "op", v: op, line });
      i += op.length;
    }
    out.push({ t: "eof", v: "", line });
    return out;
  }

  function unescapeChar(c) {
    return { n: "\n", t: "\t", r: "\r", "0": "\0", "\\": "\\", "'": "'", '"': '"' }[c] || c;
  }

  /* ============================ parser ============================ */
  const PRIMS = new Set(["int", "long", "short", "byte", "double", "float", "boolean", "char", "void"]);
  const MODS = new Set(["public", "private", "protected", "static", "final", "abstract"]);

  function parse(toks) {
    let p = 0;
    const peek = (k) => toks[p + (k || 0)];
    const at = (t, v) => peek().t === t && (v === undefined || peek().v === v);
    const atOp = (v) => at("op", v);
    const next = () => toks[p++];
    const err = (m) => { throw new Error("Syntax error on line " + peek().line + ": " + m + " (got '" + peek().v + "')"); };
    const expect = (t, v) => { if (!at(t, v)) err("expected " + (v || t)); return next(); };
    const eatOp = (v) => { if (atOp(v)) { p++; return true; } return false; };

    function parseUnit() {
      const classes = [];
      while (!at("eof")) {
        if (at("kw", "import") || at("kw", "package")) { while (!atOp(";") && !at("eof")) p++; eatOp(";"); continue; }
        const mods = parseMods();
        if (at("kw", "class") || at("kw", "interface")) classes.push(parseClass(mods));
        else err("expected a class declaration");
      }
      return classes;
    }

    function parseMods() {
      const m = [];
      while (at("kw") && MODS.has(peek().v)) m.push(next().v);
      return m;
    }

    function parseClass(mods) {
      next(); // class | interface
      const name = expect("id").v;
      skipTypeParams();
      if (at("kw", "extends") || at("kw", "implements")) { while (!atOp("{") && !at("eof")) p++; }
      expect("op", "{");
      const cls = { name, mods, fields: [], methods: [], ctors: [] };
      while (!atOp("}") && !at("eof")) {
        if (eatOp(";")) continue;
        const mm = parseMods();
        if (at("id", name) && toks[p + 1] && toks[p + 1].t === "op" && toks[p + 1].v === "(") {
          next();
          cls.ctors.push({ params: parseParams(), body: parseBlock(), mods: mm });
          continue;
        }
        const type = parseType();
        const mname = expect("id").v;
        if (atOp("(")) {
          const params = parseParams();
          const body = atOp("{") ? parseBlock() : (expect("op", ";"), null);
          cls.methods.push({ name: mname, params, body, static: mm.indexOf("static") >= 0, type });
        } else {
          let init = eatOp("=") ? parseVarInit() : null;
          cls.fields.push({ name: mname, type, init, static: mm.indexOf("static") >= 0 });
          while (eatOp(",")) {
            const n2 = expect("id").v;
            const i2 = eatOp("=") ? parseVarInit() : null;
            cls.fields.push({ name: n2, type, init: i2, static: mm.indexOf("static") >= 0 });
          }
          expect("op", ";");
        }
      }
      expect("op", "}");
      return cls;
    }

    function skipTypeParams() {
      if (!atOp("<")) return;
      let depth = 0;
      do {
        if (atOp("<")) depth++;
        else if (atOp(">")) depth--;
        else if (atOp(">>")) depth -= 2;
        p++;
      } while (depth > 0 && !at("eof"));
    }

    /* Returns {name, dims} or null when the tokens are not a type. */
    function tryType() {
      const start = p;
      let name;
      if (at("kw") && PRIMS.has(peek().v)) name = next().v;
      else if (at("id")) {
        name = next().v;
        while (atOp(".") && toks[p + 1] && toks[p + 1].t === "id") { p++; name = next().v; }
      } else return (p = start, null);
      if (atOp("<")) {
        const save = p;
        let depth = 0, ok = false;
        while (!at("eof")) {
          if (atOp("<")) depth++;
          else if (atOp(">")) { depth--; if (depth === 0) { p++; ok = true; break; } }
          else if (atOp(">>")) { depth -= 2; if (depth <= 0) { p++; ok = true; break; } }
          else if (atOp(";") || atOp("{")) break;
          p++;
        }
        if (!ok) p = save;
      }
      let dims = 0;
      while (atOp("[") && toks[p + 1] && toks[p + 1].t === "op" && toks[p + 1].v === "]") { p += 2; dims++; }
      return { name, dims };
    }
    function parseType() {
      const t = tryType();
      if (!t) err("expected a type");
      return t;
    }

    function parseParams() {
      expect("op", "(");
      const ps = [];
      while (!atOp(")")) {
        parseMods();
        const type = parseType();
        const name = expect("id").v;
        ps.push({ name, type });
        if (!eatOp(",")) break;
      }
      expect("op", ")");
      return ps;
    }

    function parseBlock() {
      expect("op", "{");
      const body = [];
      while (!atOp("}") && !at("eof")) body.push(parseStmt());
      expect("op", "}");
      return { k: "block", body };
    }

    function parseStmt() {
      if (atOp("{")) return parseBlock();
      if (eatOp(";")) return { k: "empty" };
      if (at("kw", "if")) {
        next(); expect("op", "(");
        const cond = parseExpr(); expect("op", ")");
        const then = parseStmt();
        const els = at("kw", "else") ? (next(), parseStmt()) : null;
        return { k: "if", cond, then, els };
      }
      if (at("kw", "while")) {
        next(); expect("op", "(");
        const cond = parseExpr(); expect("op", ")");
        return { k: "while", cond, body: parseStmt() };
      }
      if (at("kw", "do")) {
        next();
        const body = parseStmt();
        expect("kw", "while"); expect("op", "(");
        const cond = parseExpr(); expect("op", ")"); expect("op", ";");
        return { k: "do", cond, body };
      }
      if (at("kw", "for")) {
        next(); expect("op", "(");
        const save = p;
        const t = tryType();
        if (t && at("id") && toks[p + 1] && toks[p + 1].t === "op" && toks[p + 1].v === ":") {
          const name = next().v; next();
          const seq = parseExpr(); expect("op", ")");
          return { k: "foreach", name, seq, body: parseStmt() };
        }
        p = save;
        let init = null;
        if (!atOp(";")) init = parseSimpleStmt();
        expect("op", ";");
        const cond = atOp(";") ? null : parseExpr();
        expect("op", ";");
        const upd = [];
        while (!atOp(")")) { upd.push(parseExpr()); if (!eatOp(",")) break; }
        expect("op", ")");
        return { k: "for", init, cond, upd, body: parseStmt() };
      }
      if (at("kw", "return")) {
        next();
        const v = atOp(";") ? null : parseExpr();
        expect("op", ";");
        return { k: "return", value: v };
      }
      if (at("kw", "break")) { next(); expect("op", ";"); return { k: "break" }; }
      if (at("kw", "continue")) { next(); expect("op", ";"); return { k: "continue" }; }
      if (at("kw", "throw")) { next(); const e = parseExpr(); expect("op", ";"); return { k: "throw", value: e }; }
      const s = parseSimpleStmt();
      expect("op", ";");
      return s;
    }

    /* local variable declaration, or a bare expression */
    function parseSimpleStmt() {
      const save = p;
      const t = tryType();
      if (t && at("id")) {
        const after = toks[p + 1];
        if (after && after.t === "op" && (after.v === "=" || after.v === ";" || after.v === ",")) {
          const decls = [];
          do {
            const name = expect("id").v;
            const init = eatOp("=") ? parseVarInit() : null;
            decls.push({ name, init });
          } while (eatOp(","));
          return { k: "local", type: t, decls };
        }
      }
      p = save;
      return { k: "expr", expr: parseExpr() };
    }

    /* ---- expressions ---- */
    const ASSIGN = ["=", "+=", "-=", "*=", "/=", "%="];
    function parseExpr() { return parseAssign(); }

    /* `int[] a = {1,2,3}` uses a brace initializer rather than an expression. */
    function parseVarInit() {
      if (atOp("{")) return { k: "arraylit", type: null, items: parseArrayLit() };
      return parseExpr();
    }

    function parseAssign() {
      const left = parseTernary();
      if (at("op") && ASSIGN.indexOf(peek().v) >= 0) {
        const op = next().v;
        const right = parseAssign();
        return { k: "assign", op, target: left, value: right };
      }
      return left;
    }
    function parseTernary() {
      const c = parseBin(0);
      if (eatOp("?")) {
        const a = parseAssign(); expect("op", ":");
        const b = parseAssign();
        return { k: "ternary", cond: c, a, b };
      }
      return c;
    }
    const LEVELS = [["||"], ["&&"], ["|"], ["^"], ["&"], ["==", "!="], ["<", ">", "<=", ">="], ["<<", ">>"], ["+", "-"], ["*", "/", "%"]];
    function parseBin(lv) {
      if (lv >= LEVELS.length) return parseUnary();
      let left = parseBin(lv + 1);
      while (at("op") && LEVELS[lv].indexOf(peek().v) >= 0) {
        const op = next().v;
        const right = parseBin(lv + 1);
        left = { k: "bin", op, left, right };
      }
      return left;
    }
    function parseUnary() {
      if (atOp("!") || atOp("-") || atOp("+") || atOp("~")) {
        const op = next().v;
        return { k: "unary", op, expr: parseUnary() };
      }
      if (atOp("++") || atOp("--")) {
        const op = next().v;
        return { k: "preinc", op, target: parseUnary() };
      }
      // cast to a primitive type only, to stay unambiguous with grouping
      if (atOp("(") && toks[p + 1] && toks[p + 1].t === "kw" && PRIMS.has(toks[p + 1].v) &&
          toks[p + 2] && toks[p + 2].t === "op" && toks[p + 2].v === ")") {
        p++; const type = next().v; p++;
        return { k: "cast", type, expr: parseUnary() };
      }
      return parsePostfix();
    }
    function parsePostfix() {
      let e = parsePrimary();
      for (;;) {
        if (atOp(".")) {
          p++;
          const name = at("kw") ? next().v : expect("id").v;
          if (atOp("(")) e = { k: "call", target: e, name, args: parseArgs() };
          else e = { k: "field", target: e, name };
        } else if (atOp("[")) {
          p++; const idx = parseExpr(); expect("op", "]");
          e = { k: "index", target: e, index: idx };
        } else if (atOp("++") || atOp("--")) {
          const op = next().v;
          e = { k: "postinc", op, target: e };
        } else break;
      }
      return e;
    }
    function parseArgs() {
      expect("op", "(");
      const args = [];
      while (!atOp(")")) { args.push(parseExpr()); if (!eatOp(",")) break; }
      expect("op", ")");
      return args;
    }
    function parsePrimary() {
      if (at("num")) return { k: "lit", value: next().v };
      if (at("dbl")) return { k: "lit", value: new JDouble(next().v) };
      if (at("str")) return { k: "lit", value: next().v };
      if (at("chr")) return { k: "lit", value: new JChar(next().v) };
      if (at("kw", "true")) { next(); return { k: "lit", value: true }; }
      if (at("kw", "false")) { next(); return { k: "lit", value: false }; }
      if (at("kw", "null")) { next(); return { k: "lit", value: null }; }
      if (at("kw", "this")) { next(); return { k: "this" }; }
      if (at("kw", "new")) return parseNew();
      if (atOp("(")) { p++; const e = parseExpr(); expect("op", ")"); return e; }
      if (at("id") || (at("kw") && PRIMS.has(peek().v))) {
        const name = next().v;
        if (atOp("(")) return { k: "call", target: null, name, args: parseArgs() };
        return { k: "name", name };
      }
      err("unexpected token");
    }
    function parseNew() {
      next();
      const t = parseTypeForNew();
      if (atOp("[")) {
        const dims = [];
        while (atOp("[")) {
          p++;
          if (atOp("]")) { p++; dims.push(null); }
          else { dims.push(parseExpr()); expect("op", "]"); }
        }
        if (atOp("{")) return { k: "arraylit", type: t, items: parseArrayLit() };
        return { k: "newarray", type: t, dims };
      }
      const args = parseArgs();
      return { k: "new", type: t, args };
    }
    function parseTypeForNew() {
      let name;
      if (at("kw") && PRIMS.has(peek().v)) name = next().v;
      else {
        name = expect("id").v;
        while (atOp(".") && toks[p + 1] && toks[p + 1].t === "id") { p++; name = next().v; }
      }
      skipTypeParams();
      return name;
    }
    function parseArrayLit() {
      expect("op", "{");
      const items = [];
      while (!atOp("}")) {
        items.push(atOp("{") ? { k: "arraylit", type: null, items: parseArrayLit() } : parseExpr());
        if (!eatOp(",")) break;
      }
      expect("op", "}");
      return items;
    }

    return parseUnit();
  }

  /* ============================ interpreter ============================ */
  function Ret(v) { this.v = v; }
  function Brk() {}
  function Cont() {}

  class Interp {
    constructor(logs) {
      this.classes = new Map();
      this.logs = logs;
      this.steps = 0;
    }

    load(classes) {
      classes.forEach((c) => {
        c.statics = new Map();
        this.classes.set(c.name, c);
      });
      // static fields after every class is registered
      this.classes.forEach((c) => {
        c.fields.filter((f) => f.static).forEach((f) => {
          c.statics.set(f.name, f.init ? this.eval(f.init, this.scope(null, null)) : this.defaultFor(f.type));
        });
      });
    }

    tick() {
      if (++this.steps > 4000000) throw new Error("Execution stopped — this looks like an infinite loop.");
    }

    scope(self, cls, parent) {
      return { vars: new Map(), self, cls, parent };
    }
    lookup(env, name) {
      for (let e = env; e; e = e.parent) if (e.vars.has(name)) return e;
      return null;
    }

    defaultFor(type) {
      if (!type) return null;
      if (type.dims > 0) return null;
      switch (type.name) {
        case "int": case "long": case "short": case "byte": return 0;
        case "double": case "float": return new JDouble(0);
        case "boolean": return false;
        case "char": return new JChar(0);
        default: return null;
      }
    }

    findMethods(cls, name) { return cls.methods.filter((m) => m.name === name); }

    instantiate(cls, args) {
      const obj = new JObj(cls);
      cls.fields.filter((f) => !f.static).forEach((f) => obj.f.set(f.name, this.defaultFor(f.type)));
      const env0 = this.scope(obj, cls);
      cls.fields.filter((f) => !f.static).forEach((f) => {
        if (f.init) obj.f.set(f.name, this.coerce(this.eval(f.init, env0), f.type));
      });
      const ctor = cls.ctors.find((c) => c.params.length === args.length) || cls.ctors[0];
      if (ctor) this.runBody(ctor.body, ctor.params, args, obj, cls);
      return obj;
    }

    runBody(body, params, args, self, cls) {
      const env = this.scope(self, cls);
      (params || []).forEach((prm, i) => env.vars.set(prm.name, this.coerce(args[i], prm.type)));
      try { this.exec(body, env); }
      catch (e) { if (e instanceof Ret) return e.v; throw e; }
      return null;
    }

    invoke(obj, name, args) {
      const cands = this.findMethods(obj.cls, name);
      const m = cands.find((x) => x.params.length === args.length) || cands[0];
      if (!m) throw new Error("No method '" + name + "' on class " + obj.cls.name);
      const r = this.runBody(m.body, m.params, args, obj, obj.cls);
      return this.coerce(r, m.type);
    }

    invokeStatic(cls, name, args) {
      const cands = this.findMethods(cls, name);
      const m = cands.find((x) => x.params.length === args.length) || cands[0];
      if (!m) throw new Error("No method '" + name + "' on class " + cls.name);
      const r = this.runBody(m.body, m.params, args, null, cls);
      return this.coerce(r, m.type);
    }

    coerce(v, type) {
      if (!type || type.dims > 0) return v;
      if (type.name === "double" || type.name === "float") {
        if (v === null || v === undefined) return v;
        return v instanceof JDouble ? v : new JDouble(num(v));
      }
      if (type.name === "int" || type.name === "long" || type.name === "short" || type.name === "byte") {
        if (v === null || v === undefined) return v;
        return Math.trunc(num(v));
      }
      return v;
    }

    /* ---- statements ---- */
    exec(node, env) {
      this.tick();
      switch (node.k) {
        case "block": {
          const inner = this.scope(env.self, env.cls, env);
          for (const s of node.body) this.exec(s, inner);
          return;
        }
        case "empty": return;
        case "expr": this.eval(node.expr, env); return;
        case "local":
          node.decls.forEach((d) => {
            const v = d.init ? this.coerce(this.eval(d.init, env), node.type) : this.defaultFor(node.type);
            env.vars.set(d.name, v);
          });
          return;
        case "if":
          if (truthy(this.eval(node.cond, env))) this.exec(node.then, env);
          else if (node.els) this.exec(node.els, env);
          return;
        case "while":
          while (truthy(this.eval(node.cond, env))) {
            this.tick();
            try { this.exec(node.body, env); }
            catch (e) { if (e instanceof Brk) break; if (!(e instanceof Cont)) throw e; }
          }
          return;
        case "do":
          do {
            this.tick();
            try { this.exec(node.body, env); }
            catch (e) { if (e instanceof Brk) break; if (!(e instanceof Cont)) throw e; }
          } while (truthy(this.eval(node.cond, env)));
          return;
        case "for": {
          const outer = this.scope(env.self, env.cls, env);
          if (node.init) this.exec(node.init, outer);
          while (node.cond === null || truthy(this.eval(node.cond, outer))) {
            this.tick();
            try { this.exec(node.body, outer); }
            catch (e) { if (e instanceof Brk) break; if (!(e instanceof Cont)) throw e; }
            node.upd.forEach((u) => this.eval(u, outer));
          }
          return;
        }
        case "foreach": {
          const seq = this.eval(node.seq, env);
          for (const item of this.iterate(seq)) {
            this.tick();
            const inner = this.scope(env.self, env.cls, env);
            inner.vars.set(node.name, item);
            try { this.exec(node.body, inner); }
            catch (e) { if (e instanceof Brk) break; if (!(e instanceof Cont)) throw e; }
          }
          return;
        }
        case "return": throw new Ret(node.value ? this.eval(node.value, env) : null);
        case "break": throw new Brk();
        case "continue": throw new Cont();
        case "throw": throw new Error(jstr(this.eval(node.value, env)));
        default: throw new Error("Cannot execute " + node.k);
      }
    }

    iterate(v) {
      if (v instanceof JList) return v.a.slice();
      if (v instanceof JArray) return v.a.slice();
      if (v instanceof JSet) return Array.from(v.m.values());
      if (v instanceof JDeque) return v.a.slice();
      if (v instanceof JMap) return Array.from(v.m.keys());
      if (v === null) throw new Error("NullPointerException: cannot iterate over null");
      throw new Error("Cannot iterate over this value");
    }

    /* ---- expressions ---- */
    eval(node, env) {
      this.tick();
      switch (node.k) {
        case "lit": return node.value;
        case "this": return env.self;
        case "name": {
          const e = this.lookup(env, node.name);
          if (e) return e.vars.get(node.name);
          if (env.self && env.self.f.has(node.name)) return env.self.f.get(node.name);
          if (env.cls && env.cls.statics.has(node.name)) return env.cls.statics.get(node.name);
          if (this.classes.has(node.name)) return { __classRef: this.classes.get(node.name) };
          if (NATIVE_STATICS[node.name]) return { __nativeRef: node.name };
          throw new Error("Unknown identifier '" + node.name + "'");
        }
        case "field": return this.getField(this.eval(node.target, env), node.name, node);
        case "index": {
          const arr = this.eval(node.target, env);
          const i = num(this.eval(node.index, env));
          if (arr === null) throw new Error("NullPointerException: array is null");
          const a = arr instanceof JArray ? arr.a : arr;
          if (i < 0 || i >= a.length) throw new Error("ArrayIndexOutOfBoundsException: index " + i);
          return a[i];
        }
        case "bin": return this.binop(node, env);
        case "unary": {
          const v = this.eval(node.expr, env);
          if (node.op === "!") return !truthy(v);
          if (node.op === "-") return isDbl(v) ? new JDouble(-num(v)) : -num(v);
          if (node.op === "+") return v;
          if (node.op === "~") return ~num(v);
          break;
        }
        case "ternary": return truthy(this.eval(node.cond, env)) ? this.eval(node.a, env) : this.eval(node.b, env);
        case "cast": {
          const v = this.eval(node.expr, env);
          if (node.type === "double" || node.type === "float") return new JDouble(num(v));
          if (node.type === "char") return new JChar(num(v));
          if (node.type === "int" || node.type === "long" || node.type === "short" || node.type === "byte")
            return Math.trunc(num(v));
          return v;
        }
        case "assign": return this.assign(node, env);
        case "preinc": {
          const cur = num(this.eval(node.target, env));
          const nv = node.op === "++" ? cur + 1 : cur - 1;
          this.store(node.target, nv, env);
          return nv;
        }
        case "postinc": {
          const cur = num(this.eval(node.target, env));
          const nv = node.op === "++" ? cur + 1 : cur - 1;
          this.store(node.target, nv, env);
          return cur;
        }
        case "new": {
          const cls = this.classes.get(node.type);
          const args = node.args.map((a) => this.eval(a, env));
          if (cls) return this.instantiate(cls, args);
          return makeNative(node.type, args);
        }
        case "newarray": {
          const dims = node.dims.filter(Boolean).map((d) => num(this.eval(d, env)));
          return this.buildArray(dims, 0, node.type);
        }
        case "arraylit":
          return new JArray(node.items.map((it) => this.eval(it, env)));
        case "call": return this.call(node, env);
      }
      throw new Error("Cannot evaluate " + node.k);
    }

    buildArray(dims, i, type) {
      if (i >= dims.length) return null;
      const n = dims[i];
      const out = new Array(n);
      for (let j = 0; j < n; j++) {
        out[j] = i === dims.length - 1 ? this.defaultFor({ name: type, dims: 0 }) : this.buildArray(dims, i + 1, type);
      }
      return new JArray(out);
    }

    getField(target, name, node) {
      if (target === null || target === undefined) throw new Error("NullPointerException: reading '" + name + "' of null");
      if (target instanceof JArray && name === "length") return target.a.length;
      if (target && target.__classRef) return target.__classRef.statics.get(name);
      if (target && target.__nativeRef) return nativeStatic(target.__nativeRef, name);
      if (target instanceof JObj) {
        if (!target.f.has(name)) throw new Error("No field '" + name + "' on " + target.cls.name);
        return target.f.get(name);
      }
      throw new Error("Cannot read field '" + name + "'");
    }

    store(target, value, env) {
      if (target.k === "name") {
        const e = this.lookup(env, target.name);
        if (e) { e.vars.set(target.name, value); return; }
        if (env.self && env.self.f.has(target.name)) { env.self.f.set(target.name, value); return; }
        if (env.cls && env.cls.statics.has(target.name)) { env.cls.statics.set(target.name, value); return; }
        env.vars.set(target.name, value);
        return;
      }
      if (target.k === "field") {
        const o = this.eval(target.target, env);
        if (o === null) throw new Error("NullPointerException: writing '" + target.name + "' of null");
        if (o && o.__classRef) { o.__classRef.statics.set(target.name, value); return; }
        if (o instanceof JObj) { o.f.set(target.name, value); return; }
        throw new Error("Cannot assign to that field");
      }
      if (target.k === "index") {
        const arr = this.eval(target.target, env);
        const i = num(this.eval(target.index, env));
        const a = arr instanceof JArray ? arr.a : arr;
        if (i < 0 || i >= a.length) throw new Error("ArrayIndexOutOfBoundsException: index " + i);
        a[i] = value;
        return;
      }
      throw new Error("Invalid assignment target");
    }

    assign(node, env) {
      let v;
      if (node.op === "=") v = this.eval(node.value, env);
      else {
        const cur = this.eval(node.target, env);
        const rhs = this.eval(node.value, env);
        v = this.arith(node.op[0], cur, rhs);
      }
      // keep declared int variables integral
      const prev = node.op === "=" ? undefined : this.eval(node.target, env);
      if (typeof prev === "number" && Number.isInteger(prev) && v instanceof JDouble) v = v;
      this.store(node.target, v, env);
      return v;
    }

    arith(op, a, b) {
      if (op === "+" && (typeof a === "string" || typeof b === "string")) return jstr(a) + jstr(b);
      const x = num(a), y = num(b);
      const dbl = isDbl(a) || isDbl(b);
      let r;
      switch (op) {
        case "+": r = x + y; break;
        case "-": r = x - y; break;
        case "*": r = x * y; break;
        case "%":
          if (y === 0) throw new Error("ArithmeticException: / by zero");
          r = x % y; break;
        case "/":
          if (y === 0 && !dbl) throw new Error("ArithmeticException: / by zero");
          r = dbl ? x / y : Math.trunc(x / y);
          break;
        default: throw new Error("Bad operator " + op);
      }
      return dbl ? new JDouble(r) : r;
    }

    binop(node, env) {
      const op = node.op;
      if (op === "&&") return truthy(this.eval(node.left, env)) ? truthy(this.eval(node.right, env)) : false;
      if (op === "||") return truthy(this.eval(node.left, env)) ? true : truthy(this.eval(node.right, env));
      const a = this.eval(node.left, env), b = this.eval(node.right, env);
      switch (op) {
        case "+": case "-": case "*": case "/": case "%": return this.arith(op, a, b);
        case "==": return jeq(a, b);
        case "!=": return !jeq(a, b);
        case "<": return num(a) < num(b);
        case ">": return num(a) > num(b);
        case "<=": return num(a) <= num(b);
        case ">=": return num(a) >= num(b);
        case "&": return typeof a === "boolean" ? (a && b) : (num(a) & num(b));
        case "|": return typeof a === "boolean" ? (a || b) : (num(a) | num(b));
        case "^": return typeof a === "boolean" ? (a !== b) : (num(a) ^ num(b));
        case "<<": return num(a) << num(b);
        case ">>": return num(a) >> num(b);
      }
      throw new Error("Bad operator " + op);
    }

    call(node, env) {
      const args = node.args.map((a) => this.eval(a, env));
      if (node.target === null) {
        if (env.self) {
          const cands = this.findMethods(env.self.cls, node.name);
          if (cands.length) return this.invoke(env.self, node.name, args);
        }
        if (env.cls) {
          const cands = this.findMethods(env.cls, node.name);
          if (cands.length) return this.invokeStatic(env.cls, node.name, args);
        }
        throw new Error("Unknown method '" + node.name + "'");
      }
      const t = this.eval(node.target, env);
      if (t && t.__classRef) return this.invokeStatic(t.__classRef, node.name, args);
      if (t && t.__nativeRef) return nativeStaticCall(this, t.__nativeRef, node.name, args);
      if (t instanceof JObj) return this.invoke(t, node.name, args);
      if (t === null || t === undefined) throw new Error("NullPointerException: calling '" + node.name + "()' on null");
      return nativeCall(this, t, node.name, args);
    }
  }

  /* ============================ equality ============================ */
  function jeq(a, b) {
    if (a instanceof JChar || b instanceof JChar) return num(a) === num(b);
    if (a instanceof JDouble || b instanceof JDouble) return num(a) === num(b);
    if (a === null || b === null) return a === b;
    if (typeof a === "number" && typeof b === "number") return a === b;
    return a === b;
  }
  const keyOf = (v) => (v instanceof JChar ? "c" + v.c : v instanceof JDouble ? "n" + v.v : typeof v === "number" ? "n" + v : typeof v === "string" ? "s" + v : v);

  /* ============================ natives ============================ */
  function makeNative(type, args) {
    switch (type) {
      case "ArrayList": case "List": case "LinkedList": {
        const l = new JList();
        if (args[0] instanceof JList) l.a = args[0].a.slice();
        return l;
      }
      case "HashMap": case "Map": case "TreeMap": case "LinkedHashMap": return new JMap();
      case "HashSet": case "Set": case "TreeSet": case "LinkedHashSet": {
        const s = new JSet();
        if (args[0] instanceof JList) args[0].a.forEach((v) => s.m.set(keyOf(v), v));
        return s;
      }
      case "ArrayDeque": case "Stack": case "Queue": case "Deque": case "PriorityQueue": return new JDeque();
      case "StringBuilder": return { __sb: [""] };
      case "RuntimeException": case "Exception": case "IllegalStateException":
      case "IllegalArgumentException": case "UnsupportedOperationException":
      case "NoSuchElementException": case "IndexOutOfBoundsException":
        return { __exc: type + (args[0] === undefined ? "" : ": " + jstr(args[0])) };
      case "String": return args[0] === undefined ? "" : jstr(args[0]);
      case "Integer": case "Double": return args[0];
      default: throw new Error("Unknown class '" + type + "'");
    }
  }

  const NATIVE_STATICS = { Math: 1, System: 1, Integer: 1, Double: 1, Arrays: 1, String: 1, Character: 1, Boolean: 1, Objects: 1 };

  function nativeStatic(ns, name) {
    if (ns === "System" && name === "out") return { __nativeRef: "System.out" };
    if (ns === "Integer") {
      if (name === "MAX_VALUE") return 2147483647;
      if (name === "MIN_VALUE") return -2147483648;
    }
    if (ns === "Double") {
      if (name === "MAX_VALUE") return new JDouble(1.7976931348623157e308);
      if (name === "POSITIVE_INFINITY") return new JDouble(Infinity);
      if (name === "NEGATIVE_INFINITY") return new JDouble(-Infinity);
    }
    if (ns === "Math" && name === "PI") return new JDouble(Math.PI);
    throw new Error("Unknown constant " + ns + "." + name);
  }

  function nativeStaticCall(interp, ns, name, args) {
    const n = args.map(num);
    if (ns === "System.out") {
      if (name === "println") { interp.logs.push(args.length ? jstr(args[0]) : ""); return null; }
      if (name === "print") { interp.logs.push(args.length ? jstr(args[0]) : ""); return null; }
    }
    if (ns === "Math") {
      switch (name) {
        case "max": return isDbl(args[0]) || isDbl(args[1]) ? new JDouble(Math.max(n[0], n[1])) : Math.max(n[0], n[1]);
        case "min": return isDbl(args[0]) || isDbl(args[1]) ? new JDouble(Math.min(n[0], n[1])) : Math.min(n[0], n[1]);
        case "abs": return isDbl(args[0]) ? new JDouble(Math.abs(n[0])) : Math.abs(n[0]);
        case "sqrt": return new JDouble(Math.sqrt(n[0]));
        case "pow": return new JDouble(Math.pow(n[0], n[1]));
        case "floor": return new JDouble(Math.floor(n[0]));
        case "ceil": return new JDouble(Math.ceil(n[0]));
        case "round": return Math.round(n[0]);
        case "log": return new JDouble(Math.log(n[0]));
        case "random": return new JDouble(Math.random());
      }
    }
    if (ns === "Integer") {
      if (name === "parseInt") return parseInt(args[0], 10);
      if (name === "valueOf") return typeof args[0] === "string" ? parseInt(args[0], 10) : num(args[0]);
      if (name === "toString") return String(num(args[0]));
      if (name === "compare") return n[0] - n[1];
    }
    if (ns === "String" && name === "valueOf") return jstr(args[0]);
    if (ns === "Arrays") {
      if (name === "fill") { const a = args[0].a; for (let i = 0; i < a.length; i++) a[i] = args[1]; return null; }
      if (name === "toString") return jstr(args[0]);
      if (name === "sort") { args[0].a.sort((x, y) => num(x) - num(y)); return null; }
      if (name === "asList") return new JList(args[0] instanceof JArray ? args[0].a.slice() : args.slice());
      if (name === "copyOf") return new JArray(args[0].a.slice(0, num(args[1])));
    }
    if (ns === "Objects" && name === "equals") return jeq(args[0], args[1]);
    if (ns === "Character") {
      if (name === "isDigit") return /[0-9]/.test(String.fromCharCode(n[0]));
      if (name === "isLetter") return /[a-zA-Z]/.test(String.fromCharCode(n[0]));
    }
    throw new Error("Unknown method " + ns + "." + name + "()");
  }

  function nativeCall(interp, t, name, args) {
    /* --- String --- */
    if (typeof t === "string") {
      switch (name) {
        case "length": return t.length;
        case "charAt": return new JChar(t.charCodeAt(num(args[0])));
        case "equals": return t === (typeof args[0] === "string" ? args[0] : jstr(args[0]));
        case "equalsIgnoreCase": return t.toLowerCase() === jstr(args[0]).toLowerCase();
        case "isEmpty": return t.length === 0;
        case "substring": return args.length > 1 ? t.slice(num(args[0]), num(args[1])) : t.slice(num(args[0]));
        case "indexOf": return t.indexOf(jstr(args[0]));
        case "contains": return t.indexOf(jstr(args[0])) >= 0;
        case "startsWith": return t.startsWith(jstr(args[0]));
        case "endsWith": return t.endsWith(jstr(args[0]));
        case "toUpperCase": return t.toUpperCase();
        case "toLowerCase": return t.toLowerCase();
        case "trim": return t.trim();
        case "compareTo": return t < args[0] ? -1 : t > args[0] ? 1 : 0;
        case "hashCode": { let h = 0; for (let i = 0; i < t.length; i++) h = (Math.imul(31, h) + t.charCodeAt(i)) | 0; return h; }
        case "toString": return t;
        case "split": return new JArray(t.split(jstr(args[0])));
      }
    }
    /* --- ArrayList --- */
    if (t instanceof JList) {
      const a = t.a;
      switch (name) {
        case "add":
          if (args.length === 2) { a.splice(num(args[0]), 0, args[1]); return null; }
          a.push(args[0]); return true;
        case "addFirst": a.unshift(args[0]); return null;
        case "addLast": a.push(args[0]); return null;
        case "get": {
          const i = num(args[0]);
          if (i < 0 || i >= a.length) throw new Error("IndexOutOfBoundsException: index " + i + ", size " + a.length);
          return a[i];
        }
        case "set": { const i = num(args[0]); const old = a[i]; a[i] = args[1]; return old; }
        case "size": return a.length;
        case "isEmpty": return a.length === 0;
        case "clear": a.length = 0; return null;
        case "contains": return a.some((v) => jeq(v, args[0]));
        case "indexOf": { for (let i = 0; i < a.length; i++) if (jeq(a[i], args[0])) return i; return -1; }
        case "remove": {
          if (typeof args[0] === "number" && Number.isInteger(args[0])) {
            const i = args[0];
            if (i < 0 || i >= a.length) throw new Error("IndexOutOfBoundsException: index " + i);
            return a.splice(i, 1)[0];
          }
          for (let i = 0; i < a.length; i++) if (jeq(a[i], args[0])) { a.splice(i, 1); return true; }
          return false;
        }
        case "toString": return jstr(t);
      }
    }
    /* --- HashMap --- */
    if (t instanceof JMap) {
      switch (name) {
        case "put": { const k = keyOf(args[0]); const old = t.m.has(k) ? t.m.get(k)[1] : null; t.m.set(k, [args[0], args[1]]); return old; }
        case "get": { const e = t.m.get(keyOf(args[0])); return e ? e[1] : null; }
        case "getOrDefault": { const e = t.m.get(keyOf(args[0])); return e ? e[1] : args[1]; }
        case "containsKey": return t.m.has(keyOf(args[0]));
        case "remove": { const k = keyOf(args[0]); const e = t.m.get(k); t.m.delete(k); return e ? e[1] : null; }
        case "size": return t.m.size;
        case "isEmpty": return t.m.size === 0;
        case "clear": t.m.clear(); return null;
        case "keySet": return new JList(Array.from(t.m.values()).map((e) => e[0]));
        case "values": return new JList(Array.from(t.m.values()).map((e) => e[1]));
        case "toString": return jstr(t);
      }
    }
    /* --- HashSet --- */
    if (t instanceof JSet) {
      switch (name) {
        case "add": { const k = keyOf(args[0]); if (t.m.has(k)) return false; t.m.set(k, args[0]); return true; }
        case "contains": return t.m.has(keyOf(args[0]));
        case "remove": return t.m.delete(keyOf(args[0]));
        case "size": return t.m.size;
        case "isEmpty": return t.m.size === 0;
        case "clear": t.m.clear(); return null;
        case "toString": return jstr(t);
      }
    }
    /* --- Deque / Queue --- */
    if (t instanceof JDeque) {
      const a = t.a;
      switch (name) {
        case "add": case "offer": case "addLast": case "offerLast": a.push(args[0]); return true;
        case "push": case "addFirst": a.unshift(args[0]); return null;
        case "poll": case "pollFirst": case "remove": return a.length ? a.shift() : null;
        case "pop": return a.length ? a.shift() : null;
        case "pollLast": return a.length ? a.pop() : null;
        case "peek": case "peekFirst": case "element": return a.length ? a[0] : null;
        case "peekLast": return a.length ? a[a.length - 1] : null;
        case "size": return a.length;
        case "isEmpty": return a.length === 0;
        case "toString": return jstr(t);
      }
    }
    /* --- StringBuilder --- */
    if (t && t.__sb) {
      if (name === "append") { t.__sb[0] += jstr(args[0]); return t; }
      if (name === "toString") return t.__sb[0];
      if (name === "length") return t.__sb[0].length;
    }
    if (t instanceof JArray && name === "length") return t.a.length;
    if (name === "equals") return jeq(t, args[0]);
    if (name === "toString") return jstr(t);
    if (name === "hashCode") return typeof t === "number" ? t : 0;
    if (name === "intValue") return Math.trunc(num(t));
    if (name === "doubleValue") return new JDouble(num(t));
    throw new Error("Unknown method '" + name + "()' on this value");
  }

  /* ============================ JS <-> Java bridge ============================ */
  function toJS(v, interp) {
    if (v === null || v === undefined) return null;
    if (v instanceof JDouble) return v.v;
    if (v instanceof JChar) return String.fromCharCode(v.c);
    if (v instanceof JList) return v.a.map((x) => toJS(x, interp));
    if (v instanceof JArray) return v.a.map((x) => toJS(x, interp));
    if (v instanceof JDeque) return v.a.map((x) => toJS(x, interp));
    if (v instanceof JSet) return Array.from(v.m.values()).map((x) => toJS(x, interp));
    if (v instanceof JMap) {
      const o = {};
      v.m.forEach((e) => { o[typeof e[0] === "string" ? e[0] : jstr(e[0])] = toJS(e[1], interp); });
      return o;
    }
    if (v instanceof JObj) return wrapObj(v, interp);
    return v;
  }

  function toJava(v) {
    if (v === null || v === undefined) return null;
    if (v && v.__jobj) return v.__jobj;
    if (Array.isArray(v)) return new JList(v.map(toJava));
    if (typeof v === "object" && v.constructor === Object) {
      const m = new JMap();
      Object.keys(v).forEach((k) => m.m.set("s" + k, [k, toJava(v[k])]));
      return m;
    }
    return v;
  }

  function wrapObj(obj, interp) {
    return new Proxy({}, {
      get(_, prop) {
        if (prop === "__jobj") return obj;
        if (prop === "__className") return obj.cls.name;
        if (typeof prop !== "string") return undefined;
        if (interp.findMethods(obj.cls, prop).length)
          return (...a) => toJS(interp.invoke(obj, prop, a.map(toJava)), interp);
        if (obj.f.has(prop)) return toJS(obj.f.get(prop), interp);
        return undefined;
      },
      set(_, prop, value) { obj.f.set(prop, toJava(value)); return true; },
      has(_, prop) { return obj.f.has(prop) || interp.findMethods(obj.cls, prop).length > 0; },
    });
  }

  /**
   * Compile and run Java source, returning bridged constructors for the named classes.
   */
  DSA.runJava = function (src, exportNames) {
    const logs = [];
    let classes;
    try {
      classes = parse(lex(src));
    } catch (err) {
      return { ok: false, error: err, logs, exports: {} };
    }
    const interp = new Interp(logs);
    try {
      interp.load(classes);
    } catch (err) {
      return { ok: false, error: err, logs, exports: {} };
    }

    const exports = {};
    (exportNames || []).forEach((name) => {
      const cls = interp.classes.get(name);
      if (!cls) return;
      const Bridge = function (...args) {
        return wrapObj(interp.instantiate(cls, args.map(toJava)), interp);
      };
      cls.methods.filter((m) => m.static).forEach((m) => {
        if (Bridge[m.name]) return;
        Bridge[m.name] = (...a) => toJS(interp.invokeStatic(cls, m.name, a.map(toJava)), interp);
      });
      cls.fields.filter((f) => f.static).forEach((f) => {
        if (f.name in Bridge) return;
        Object.defineProperty(Bridge, f.name, { get: () => toJS(cls.statics.get(f.name), interp) });
      });
      exports[name] = Bridge;
    });
    return { ok: true, exports, logs, interp };
  };

  DSA.javaInternals = { lex, parse, Interp, NATIVE, toJS, toJava };
})();
