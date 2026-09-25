/* Module 2 — Hash tables: chaining and open addressing.
 * The worked example (50, 70, 76, 85 with h(k) = k mod 5) comes from the notes. */
(function () {
  const DSA = (window.DSA = window.DSA || {});
  const C = DSA.COLORS;
  const MOD = "Hash tables";

  const SLOT_W = 84, SLOT_H = 38, SLOT_GAP = 8;
  const CHAIN_W = 60, CHAIN_GAP = 26;

  function slotColumn(scene, m, opts) {
    opts = opts || {};
    for (let i = 0; i < m; i++) {
      const y = i * (SLOT_H + SLOT_GAP);
      const st = opts.slotStyle ? opts.slotStyle(i) : {};
      scene.put(`slot-${i}`, "rect", {
        class: "n-slot", x: 0, y, width: SLOT_W, height: SLOT_H, rx: 8,
        fill: st.fill || "#f1f7f3", stroke: st.stroke || "#c3ddcd",
        "stroke-width": st.bold ? 2.5 : 1.5,
      });
      scene.put(`sidx-${i}`, "text", {
        class: "n-label", x: -14, y: y + SLOT_H / 2,
        fill: st.idxFill || "#7d9a8b", "font-size": 12, "text-anchor": "end",
      }, i);
    }
  }

  /* ================================================================
   * 2.1 HASHING FUNDAMENTALS + CHAINING
   * ============================================================== */
  DSA.lesson({
    id: "hash-chaining",
    module: MOD,
    title: "Hashing & separate chaining",
    blurb:
      "A hash function turns a key into an array index. Collisions are inevitable — chaining parks them in a list hanging off the slot.",
    tags: ["h(k) = k mod m", "O(1) average", "load factor α"],
    notes: `
      <h4>Direct addressing, and why it fails</h4>
      <p>The simplest idea is one array slot per possible key. Lookup is a single index — genuinely
      <code>O(1)</code>. But if keys range over a large universe you allocate an enormous array that is
      almost entirely empty. As the notes put it: <i>as many entries in the array as keys, lots of empty
      spaces.</i></p>
      <h4>Hashing</h4>
      <p>Instead, map the key down into a small table of size <code>m</code>:</p>
      <span class="rule">h(k) = k mod m</span>
      <p>Now the table is compact, but two keys can land in the same slot — a <b>collision</b>.</p>
      <h4>What makes a hash function good</h4>
      <ul>
        <li>It <b>minimises collisions</b>.</li>
        <li>A key is equally likely to hash to <b>any</b> slot, <i>independently of where other keys
        hashed</i> — this is the simple uniform hashing assumption.</li>
        <li>It is cheap to compute and deterministic.</li>
      </ul>
      <div class="callout">Prefer a prime <code>m</code>. With <code>m = 10</code> and keys that are all
      multiples of 10, every single key collides in slot 0.</div>
      <h4>Separate chaining</h4>
      <p>Every slot holds a linked list. Colliding keys are simply appended. Search scans just that
      one chain.</p>
      <p>The <b>load factor</b> is <code>α = n / m</code> — the average chain length. Search costs
      <code>O(1 + α)</code>, so as long as you grow the table to keep <code>α</code> bounded by a
      constant, operations stay effectively constant time.</p>
      <div class="callout warn">Worst case is <code>O(n)</code>: if every key collides, the table
      degenerates into one long linked list.</div>`,
    complexity: [
      ["Operation", "Average", "Worst"],
      ["insert", "O(1)", "O(1)"],
      ["search", "O(1 + α)", "O(n)"],
      ["delete", "O(1 + α)", "O(n)"],
      ["space", "O(n + m)", "O(n + m)"],
    ],
    pseudo: [
      "CHAINED-INSERT(T, k)",
      "  i = h(k)",
      "  insert k at the head of list T[i]",
      "",
      "CHAINED-SEARCH(T, k)",
      "  i = h(k)",
      "  for each node in list T[i]",
      "      if node.key == k",
      "          return node",
      "  return NIL",
    ],
    legend: [
      { color: "#f1f7f3", label: "empty slot" },
      { color: C.visit, label: "slot being probed" },
      { color: C.done, label: "inserted / found" },
      { color: C.warn, label: "collision — chain grew" },
    ],

    mount(ctx) {
      DSA.ensureDefs(ctx.svg);
      let m = 5;
      let table = Array.from({ length: m }, () => []);
      const seed = [50, 70, 76, 85];
      seed.forEach((k) => table[k % m].push(k));

      const refs = DSA.controls(ctx.controls, [
        { type: "input", name: "key", label: "key", inputType: "number", value: 91 },
        { type: "button", label: "Insert", onClick: () => doInsert() },
        { type: "button", label: "Search", variant: "alt", onClick: () => doSearch() },
        { type: "button", label: "Delete", variant: "danger", onClick: () => doDelete() },
        {
          type: "select", name: "m", label: "m =", value: "5",
          options: [{ value: "5", label: "5" }, { value: "7", label: "7" }, { value: "11", label: "11" }],
          onChange: (r) => { m = parseInt(r.m.value, 10); rebuild(); },
        },
        { type: "button", label: "Reset", onClick: () => rebuild() },
      ]);

      function rebuild() {
        table = Array.from({ length: m }, () => []);
        seed.forEach((k) => table[k % m].push(k));
        ctx.load([mk(`Table rebuilt with m = ${m}. h(k) = k mod ${m}.`, null, {})]);
      }

      const mk = (msg, line, opts) => ({
        table: DSA.clone(table), m, msg, line, opts: opts || {},
      });

      function doInsert() {
        const k = DSA.readInt(refs.key, 0);
        const i = ((k % m) + m) % m;
        const before = table[i].length;
        const F = [mk(`Insert <b>${k}</b>: compute <b>h(${k}) = ${k} mod ${m} = ${i}</b>.`, 1, { probe: i })];
        table[i] = table[i].concat([k]);
        F.push(
          mk(
            before === 0
              ? `Slot ${i} was empty — <b>${k}</b> starts the chain.`
              : `Slot ${i} already held ${before} key(s): <b>collision</b>. Append <b>${k}</b> to the chain.`,
            2,
            { probe: i, hotKey: k, collision: before > 0 }
          )
        );
        ctx.load(F);
      }

      function doSearch() {
        const k = DSA.readInt(refs.key, 0);
        const i = ((k % m) + m) % m;
        const F = [mk(`Search <b>${k}</b>: <b>h(${k}) = ${i}</b>. Only slot ${i} can hold it.`, 5, { probe: i })];
        const chain = table[i];
        let found = false;
        for (let j = 0; j < chain.length; j++) {
          if (chain[j] === k) {
            F.push(mk(`Found <b>${k}</b> after ${j + 1} comparison(s) in chain ${i}.`, 8,
              { probe: i, hotKey: k, foundAt: j }));
            found = true;
            break;
          }
          F.push(mk(`Compare with <b>${chain[j]}</b> — not a match, follow next.`, 7,
            { probe: i, scanAt: j }));
        }
        if (!found)
          F.push(mk(`Chain ${i} exhausted — <b>${k}</b> is not in the table.`, 9, { probe: i, miss: true }));
        ctx.load(F);
      }

      function doDelete() {
        const k = DSA.readInt(refs.key, 0);
        const i = ((k % m) + m) % m;
        const j = table[i].indexOf(k);
        if (j < 0) {
          ctx.load([mk(`<b>${k}</b> hashes to slot ${i}, but is not in that chain.`, 5, { probe: i, miss: true })]);
          return;
        }
        const F = [mk(`Delete <b>${k}</b> — found in chain ${i}.`, 5, { probe: i, hotKey: k, foundAt: j })];
        table[i] = table[i].filter((v) => v !== k);
        F.push(mk(`Unlinked <b>${k}</b> from chain ${i}.`, null, { probe: i }));
        ctx.load(F);
      }

      ctx.render = function (f) {
        const scene = ctx.scene;
        scene.begin();
        const o = f.opts;

        slotColumn(scene, f.m, {
          slotStyle: (i) => {
            if (o.probe === i)
              return { fill: o.miss ? "#fbdbe3" : "#d2eef8", stroke: o.miss ? C.bad : C.visit, bold: true, idxFill: C.visit };
            return {};
          },
        });

        let maxX = SLOT_W;
        f.table.forEach((chain, i) => {
          const y = i * (SLOT_H + SLOT_GAP);
          chain.forEach((k, j) => {
            const x = SLOT_W + CHAIN_GAP + j * (CHAIN_W + CHAIN_GAP);
            let fill = C.idle, stroke = C.idleLine;
            if (o.probe === i && o.foundAt === j) { fill = "#cdf0df"; stroke = C.done; }
            else if (o.probe === i && o.scanAt === j) { fill = "#d2eef8"; stroke = C.visit; }
            else if (o.hotKey === k && o.probe === i) { fill = o.collision ? "#fcefd4" : "#cdf0df"; stroke = o.collision ? C.warn : C.done; }
            scene.put(`c-${i}-${k}`, "rect", {
              class: "n-box", x, y: y + 2, width: CHAIN_W, height: SLOT_H - 4, rx: 7,
              fill, stroke, "stroke-width": 1.8,
            });
            scene.put(`ct-${i}-${k}`, "text", {
              class: "n-label", x: x + CHAIN_W / 2, y: y + SLOT_H / 2, fill: "#12291f", "font-size": 13,
            }, k);
            const px = j === 0 ? SLOT_W : x - CHAIN_GAP;
            scene.put(`ca-${i}-${k}`, "path", {
              class: "n-edge", d: `M ${px + 4} ${y + SLOT_H / 2} L ${x - 6} ${y + SLOT_H / 2}`,
              stroke: "#7fae95", "stroke-width": 1.8, fill: "none", "marker-end": "url(#arw)",
            });
            maxX = Math.max(maxX, x + CHAIN_W);
          });
          if (!chain.length)
            scene.put(`nil-${i}`, "text", {
              class: "n-label", x: SLOT_W + 22, y: y + SLOT_H / 2,
              fill: "#9ab3a6", "font-size": 11, "text-anchor": "start",
            }, "∅");
        });

        scene.end();
        DSA.fit(ctx.svg, -46, -12, Math.max(maxX, SLOT_W + 120), f.m * (SLOT_H + SLOT_GAP), 16);

        const n = f.table.reduce((s, c) => s + c.length, 0);
        const longest = f.table.reduce((s, c) => Math.max(s, c.length), 0);
        ctx.trace.innerHTML =
          `<div style="color:var(--dim)">n = ${n} keys · m = ${f.m} slots · load factor α = ${(n / f.m).toFixed(2)} · longest chain = ${longest}</div>`;
      };

      ctx.load([mk("Seeded with 50, 70, 76, 85 — note how 50 and 70 both land in slot 0.", null, {})]);
    },

    code: {
      exports: ["HashTable"],
      starter: `// Hash table with separate chaining.
// Each bucket is a list of Entry objects.
class Entry {
  String key;
  int value;
  Entry(String key, int value) {
    this.key = key;
    this.value = value;
  }
}

class HashTable {
  int size;
  int count = 0;
  ArrayList<ArrayList<Entry>> buckets;

  HashTable() { init(8); }
  HashTable(int size) { init(size); }

  private void init(int size) {
    this.size = size;
    buckets = new ArrayList<>();
    for (int i = 0; i < size; i++) buckets.add(new ArrayList<>());
  }

  int hash(String key) {
    int h = 0;
    for (int i = 0; i < key.length(); i++) {
      h = (h * 31 + key.charAt(i)) % size;
    }
    return h;
  }

  void set(String key, int value) {
    // update in place if the key already exists, otherwise append
  }

  Integer get(String key) {
    // return the value, or null
  }

  boolean has(String key) {
    // return true / false
  }

  boolean delete(String key) {
    // remove the entry; return true if something was removed
  }

  double loadFactor() {
    return (double) count / size;
  }
}`,
      solution: `class Entry {
  String key;
  int value;
  Entry(String key, int value) {
    this.key = key;
    this.value = value;
  }
}

class HashTable {
  int size;
  int count = 0;
  ArrayList<ArrayList<Entry>> buckets;

  HashTable() { init(8); }
  HashTable(int size) { init(size); }

  private void init(int size) {
    this.size = size;
    buckets = new ArrayList<>();
    for (int i = 0; i < size; i++) buckets.add(new ArrayList<>());
  }

  int hash(String key) {
    int h = 0;
    for (int i = 0; i < key.length(); i++) {
      h = (h * 31 + key.charAt(i)) % size;
    }
    return h;
  }

  void set(String key, int value) {
    ArrayList<Entry> b = buckets.get(hash(key));
    for (int i = 0; i < b.size(); i++) {
      Entry e = b.get(i);
      if (e.key.equals(key)) {
        e.value = value;
        return;
      }
    }
    b.add(new Entry(key, value));
    count = count + 1;
  }

  Integer get(String key) {
    ArrayList<Entry> b = buckets.get(hash(key));
    for (int i = 0; i < b.size(); i++) {
      Entry e = b.get(i);
      if (e.key.equals(key)) return e.value;
    }
    return null;
  }

  boolean has(String key) {
    return get(key) != null;
  }

  boolean delete(String key) {
    ArrayList<Entry> b = buckets.get(hash(key));
    for (int i = 0; i < b.size(); i++) {
      if (b.get(i).key.equals(key)) {
        b.remove(i);
        count = count - 1;
        return true;
      }
    }
    return false;
  }

  double loadFactor() {
    return (double) count / size;
  }
}`,
      tests: [
        {
          name: "set then get round-trips a value",
          run(x, a) {
            const t = new x.HashTable();
            t.set("apple", 5);
            a.eq(t.get("apple"), 5, "get('apple') should be");
          },
        },
        {
          name: "setting an existing key updates instead of duplicating",
          run(x, a) {
            const t = new x.HashTable();
            t.set("k", 1); t.set("k", 2);
            a.eq(t.get("k"), 2, "value should be");
            a.eq(t.count, 1, "count should be");
          },
        },
        {
          name: "colliding keys both survive in the same bucket",
          run(x, a) {
            const t = new x.HashTable(1); // force every key into bucket 0
            t.set("a", 1); t.set("b", 2); t.set("c", 3);
            a.eq([t.get("a"), t.get("b"), t.get("c")], [1, 2, 3], "values should be");
          },
        },
        {
          name: "missing keys report correctly",
          run(x, a) {
            const t = new x.HashTable();
            t.set("here", 1);
            a.eq(t.get("nope"), null, "missing get should be");
            a.eq(t.has("nope"), false, "missing has should be");
            a.eq(t.has("here"), true, "present has should be");
          },
        },
        {
          name: "delete removes only the target from a shared bucket",
          run(x, a) {
            const t = new x.HashTable(1);
            t.set("a", 1); t.set("b", 2);
            a.eq(t.delete("a"), true, "delete('a') should be");
            a.eq(t.get("a"), null, "get('a') should be");
            a.eq(t.get("b"), 2, "get('b') should be");
            a.eq(t.delete("zz"), false, "deleting a missing key should be");
          },
        },
        {
          name: "hash always lands inside the table",
          run(x, a) {
            const t = new x.HashTable(8);
            for (const k of ["a", "zzz", "12345", "hello world", ""]) {
              const h = t.hash(k);
              a.ok(h >= 0 && h < 8 && Number.isInteger(h), `hash("${k}") = ${h} is out of range`);
            }
          },
        },
        {
          name: "loadFactor uses floating-point division",
          run(x, a) {
            const t = new x.HashTable(8);
            t.set("a", 1); t.set("b", 2);
            a.eq(t.loadFactor(), 0.25, "loadFactor should be");
          },
        },
      ],
    },

    quiz: [
      {
        q: "With <code>h(k) = k mod 5</code>, which pair collides?",
        options: ["50 and 76", "70 and 85", "50 and 70", "76 and 85"],
        answer: 2,
        why: "50 mod 5 = 0 and 70 mod 5 = 0, so both target slot 0.",
      },
      {
        q: "What does a load factor α = n/m actually measure?",
        options: [
          "How full the largest bucket is",
          "The average chain length, which drives search cost",
          "The number of empty slots",
          "How random the hash function is",
        ],
        answer: 1,
        why: "Chained search costs O(1 + α) because you hash once, then walk an average of α nodes.",
      },
      {
        q: "Why is a table size that is a power of ten a poor choice for <code>k mod m</code>?",
        options: [
          "Modulo is slower for those numbers",
          "It wastes memory",
          "Keys sharing a common factor with m cluster into a few slots",
          "It makes deletion impossible",
        ],
        answer: 2,
        why: "m = 10 only ever looks at the last decimal digit, so structured keys pile into a handful of slots. Primes spread them out.",
      },
    ],
  });

  /* ================================================================
   * 2.2 OPEN ADDRESSING — linear & quadratic probing
   * ============================================================== */
  DSA.lesson({
    id: "hash-open",
    module: MOD,
    title: "Open addressing & probing",
    blurb:
      "No side lists: every key lives directly in a slot. On a collision you probe onward until you find space.",
    tags: ["linear probing", "quadratic probing", "tombstones"],
    notes: `
      <h4>The trade</h4>
      <p>Open addressing stores every element inside the table itself. From the notes:</p>
      <ul>
        <li>Every element occupies <b>one slot</b>.</li>
        <li>The table <b>can become full</b> — you cannot insert more than <code>m</code> keys.</li>
        <li>Knowing the <b>frequency and number of keys</b> up front is valuable for sizing.</li>
        <li><b>No linked lists</b>, so memory is contiguous and caching is much better.</li>
      </ul>
      <h4>Linear probing</h4>
      <span class="rule">h(k)
if occupied → h(k) + 1
if occupied → h(k) + 2  …</span>
      <p>Simple and cache-friendly, but it suffers <b>primary clustering</b>: occupied runs grow and
      merge, and long runs get longer still because any key hashing anywhere into the run extends it.</p>
      <h4>Quadratic probing</h4>
      <span class="rule">h(k)
if occupied → h(k) + 1²
if occupied → h(k) + 2²  …</span>
      <p>Jumping by squares spreads probes out and breaks up primary clustering.</p>
      <h4>The deletion problem</h4>
      <div class="callout warn">You cannot simply blank a slot. Doing so severs a probe chain, and
      keys further along become unreachable. Mark deleted slots with a <b>tombstone</b> — searches
      probe past it, but inserts may reuse it.</div>
      <h4>Worked example from the notes</h4>
      <p>Insert 50, 70, 76, 85 with <code>h(k) = k mod 5</code>, linear probing:</p>
      <ul>
        <li><code>50 mod 5 = 0</code> → slot 0.</li>
        <li><code>70 mod 5 = 0</code>, taken → probe to slot 1.</li>
        <li><code>76 mod 5 = 1</code>, taken → probe to slot 2.</li>
        <li><code>85 mod 5 = 0</code>, taken → probe on to slot 3.</li>
      </ul>`,
    complexity: [
      ["Operation", "Average (α < 1)", "Worst"],
      ["insert", "O(1/(1−α))", "O(n)"],
      ["search hit", "O(1/(1−α))", "O(n)"],
      ["delete", "O(1/(1−α))", "O(n)"],
      ["max keys", "m", "table can fill"],
    ],
    pseudo: [
      "INSERT(T, k)",
      "  i = 0",
      "  repeat",
      "      j = probe(k, i)",
      "      if T[j] is empty or tombstone",
      "          T[j] = k",
      "          return j",
      "      i = i + 1",
      "  until i == m",
      "  error \"table overflow\"",
      "",
      "// linear:    probe(k,i) = (h(k) + i)     mod m",
      "// quadratic: probe(k,i) = (h(k) + i*i)   mod m",
    ],
    legend: [
      { color: "#f1f7f3", label: "empty" },
      { color: C.idle, label: "occupied" },
      { color: C.warn, label: "probe — occupied, move on" },
      { color: C.done, label: "placed / found" },
      { color: C.bad, label: "tombstone" },
    ],

    mount(ctx) {
      DSA.ensureDefs(ctx.svg);
      const m = 11;
      let slots = new Array(m).fill(null); // null | {k} | 'TOMB'
      let mode = "linear";

      function seedNotesExample() {
        slots = new Array(m).fill(null);
      }
      seedNotesExample();

      const refs = DSA.controls(ctx.controls, [
        { type: "input", name: "key", label: "key", inputType: "number", value: 50 },
        { type: "button", label: "Insert", onClick: () => doInsert() },
        { type: "button", label: "Search", variant: "alt", onClick: () => doSearch() },
        { type: "button", label: "Delete", variant: "danger", onClick: () => doDelete() },
        {
          type: "select", name: "mode", label: "probe", value: "linear",
          options: [{ value: "linear", label: "linear" }, { value: "quadratic", label: "quadratic" }],
          onChange: (r) => { mode = r.mode.value; ctx.load([mk(`Switched to <b>${mode}</b> probing.`, null, {})]); },
        },
        { type: "button", label: "Load 50,70,76,85", onClick: () => loadDemo() },
        { type: "button", label: "Clear", onClick: () => { seedNotesExample(); ctx.load([mk("Table cleared.", null, {})]); } },
      ]);

      const mk = (msg, line, opts) => ({ slots: DSA.clone(slots), m, mode, msg, line, opts: opts || {} });

      const probeAt = (h, i) => (mode === "linear" ? (h + i) % m : (h + i * i) % m);
      const probeExpr = (h, i) =>
        mode === "linear" ? `(${h} + ${i}) mod ${m}` : `(${h} + ${i}²) mod ${m}`;

      function loadDemo() {
        seedNotesExample();
        const F = [mk("Loading the worked example: 50, 70, 76, 85.", null, {})];
        [50, 70, 76, 85].forEach((k) => {
          const h = k % m;
          for (let i = 0; i < m; i++) {
            const j = probeAt(h, i);
            if (slots[j] == null) { slots[j] = { k }; F.push(mk(`Placed <b>${k}</b> at slot ${j}.`, 5, { hit: j })); break; }
            F.push(mk(`<b>${k}</b> → slot ${j} is taken by ${slots[j].k}, probe on.`, 7, { probe: j }));
          }
        });
        ctx.load(F);
      }

      function doInsert() {
        const k = DSA.readInt(refs.key, 0);
        const h = ((k % m) + m) % m;
        const F = [mk(`Insert <b>${k}</b>: <b>h(${k}) = ${k} mod ${m} = ${h}</b>.`, 1, { probe: h })];
        for (let i = 0; i < m; i++) {
          const j = probeAt(h, i);
          const cell = slots[j];
          if (cell == null || cell === "TOMB") {
            slots[j] = { k };
            F.push(mk(
              `Probe ${i}: <b>${probeExpr(h, i)} = ${j}</b> is ${cell === "TOMB" ? "a reusable tombstone" : "empty"} — place <b>${k}</b> here.`,
              5, { hit: j }));
            ctx.load(F);
            return;
          }
          if (cell.k === k) {
            F.push(mk(`<b>${k}</b> is already stored at slot ${j}.`, 4, { hit: j }));
            ctx.load(F);
            return;
          }
          F.push(mk(`Probe ${i}: <b>${probeExpr(h, i)} = ${j}</b> holds <b>${cell.k}</b> — collision, keep probing.`,
            7, { probe: j }));
        }
        F.push(mk(`Probed all ${m} slots without finding space — <b>table overflow</b>.`, 9, { error: true }));
        ctx.load(F);
      }

      function doSearch() {
        const k = DSA.readInt(refs.key, 0);
        const h = ((k % m) + m) % m;
        const F = [mk(`Search <b>${k}</b>: start at <b>h(${k}) = ${h}</b>.`, 1, { probe: h })];
        for (let i = 0; i < m; i++) {
          const j = probeAt(h, i);
          const cell = slots[j];
          if (cell == null) {
            F.push(mk(`Slot ${j} is empty — the probe chain ends. <b>${k}</b> is not present.`, 4, { miss: j }));
            ctx.load(F); return;
          }
          if (cell === "TOMB") {
            F.push(mk(`Slot ${j} is a tombstone — a key was deleted here, so keep probing past it.`, 4, { tomb: j }));
            continue;
          }
          if (cell.k === k) {
            F.push(mk(`Found <b>${k}</b> at slot ${j} after ${i + 1} probe(s).`, 5, { hit: j }));
            ctx.load(F); return;
          }
          F.push(mk(`Slot ${j} holds <b>${cell.k}</b>, not ${k} — probe on.`, 7, { probe: j }));
        }
        F.push(mk(`<b>${k}</b> is not in the table.`, 9, { error: true }));
        ctx.load(F);
      }

      function doDelete() {
        const k = DSA.readInt(refs.key, 0);
        const h = ((k % m) + m) % m;
        const F = [mk(`Delete <b>${k}</b>: start at <b>h(${k}) = ${h}</b>.`, 1, { probe: h })];
        for (let i = 0; i < m; i++) {
          const j = probeAt(h, i);
          const cell = slots[j];
          if (cell == null) {
            F.push(mk(`Slot ${j} is empty — <b>${k}</b> was never stored.`, 4, { miss: j }));
            ctx.load(F); return;
          }
          if (cell !== "TOMB" && cell.k === k) {
            slots[j] = "TOMB";
            F.push(mk(
              `Found <b>${k}</b> at slot ${j}. Mark it as a <b>tombstone</b> — blanking it would break probe chains running through this slot.`,
              null, { tomb: j }));
            ctx.load(F); return;
          }
          F.push(mk(`Slot ${j} is not ${k} — probe on.`, 7, { probe: j }));
        }
        F.push(mk(`<b>${k}</b> is not in the table.`, null, { error: true }));
        ctx.load(F);
      }

      ctx.render = function (f) {
        const scene = ctx.scene;
        scene.begin();
        const o = f.opts;
        const W = 96, H = 36, G = 7;

        for (let i = 0; i < f.m; i++) {
          const y = i * (H + G);
          const cell = f.slots[i];
          let fill = "#f1f7f3", stroke = "#c3ddcd", bold = false, label = "—", labelFill = "#9ab3a6";
          if (cell === "TOMB") { fill = "#fbdbe3"; stroke = "#f0a5b4"; label = "✗ deleted"; labelFill = "#e11d48"; }
          else if (cell) { fill = C.idle; stroke = C.idleLine; label = cell.k; labelFill = "#12291f"; }
          if (o.probe === i) { fill = "#fcefd4"; stroke = C.warn; bold = true; }
          if (o.hit === i) { fill = "#cdf0df"; stroke = C.done; bold = true; labelFill = "#12291f"; }
          if (o.miss === i) { fill = "#fbdbe3"; stroke = C.bad; bold = true; }
          if (o.tomb === i) { fill = "#fbdbe3"; stroke = C.bad; bold = true; label = "✗ deleted"; labelFill = "#e11d48"; }

          scene.put(`s-${i}`, "rect", {
            class: "n-slot", x: 0, y, width: W, height: H, rx: 8,
            fill, stroke, "stroke-width": bold ? 2.6 : 1.5,
          });
          scene.put(`t-${i}`, "text", {
            class: "n-label", x: W / 2, y: y + H / 2, fill: labelFill, "font-size": 13,
          }, label);
          scene.put(`i-${i}`, "text", {
            class: "n-label", x: -12, y: y + H / 2,
            fill: o.probe === i || o.hit === i ? C.warn : "#7d9a8b",
            "font-size": 12, "text-anchor": "end",
          }, i);
        }
        scene.end();
        DSA.fit(ctx.svg, -44, -10, 128, f.m * (H + G), 14);

        const used = f.slots.filter((s) => s && s !== "TOMB").length;
        const tombs = f.slots.filter((s) => s === "TOMB").length;
        ctx.trace.innerHTML =
          `<div style="color:var(--dim)">${used}/${f.m} occupied · ${tombs} tombstone(s) · α = ${(used / f.m).toFixed(2)} · ${f.mode} probing</div>`;
      };

      ctx.load([mk("Empty table, m = 11. Try “Load 50,70,76,85” to replay the worked example.", null, {})]);
    },

    code: {
      exports: ["OpenAddressed"],
      starter: `// Open addressing with linear probing.
// A slot is empty when slots[i] == null and tomb[i] is false.
class Slot {
  String key;
  int value;
  Slot(String key, int value) {
    this.key = key;
    this.value = value;
  }
}

class OpenAddressed {
  int size;
  int count = 0;
  Slot[] slots;
  boolean[] tomb;

  OpenAddressed() { init(11); }
  OpenAddressed(int size) { init(size); }

  private void init(int size) {
    this.size = size;
    slots = new Slot[size];
    tomb = new boolean[size];
  }

  int hash(String key) {
    int h = 0;
    for (int i = 0; i < key.length(); i++) {
      h = (h * 31 + key.charAt(i)) % size;
    }
    return h;
  }

  // probe i steps from the home slot
  int probe(String key, int i) {
    return (hash(key) + i) % size;
  }

  void set(String key, int value) {
    // reuse a tombstone or an empty slot; update in place if the key exists
  }

  Integer get(String key) {
    // stop at a truly empty slot; probe past tombstones
  }

  boolean delete(String key) {
    // mark tomb[j] = true rather than only clearing the slot
  }

  boolean isTombstone(int i) { return tomb[i]; }

  int indexOf(String key) {
    for (int i = 0; i < size; i++) {
      int j = probe(key, i);
      if (slots[j] != null && slots[j].key.equals(key)) return j;
    }
    return -1;
  }

  int occupied() {
    int c = 0;
    for (int i = 0; i < size; i++) if (slots[i] != null) c++;
    return c;
  }
}`,
      solution: `class Slot {
  String key;
  int value;
  Slot(String key, int value) {
    this.key = key;
    this.value = value;
  }
}

class OpenAddressed {
  int size;
  int count = 0;
  Slot[] slots;
  boolean[] tomb;

  OpenAddressed() { init(11); }
  OpenAddressed(int size) { init(size); }

  private void init(int size) {
    this.size = size;
    slots = new Slot[size];
    tomb = new boolean[size];
  }

  int hash(String key) {
    int h = 0;
    for (int i = 0; i < key.length(); i++) {
      h = (h * 31 + key.charAt(i)) % size;
    }
    return h;
  }

  int probe(String key, int i) {
    return (hash(key) + i) % size;
  }

  void set(String key, int value) {
    int firstTomb = -1;
    for (int i = 0; i < size; i++) {
      int j = probe(key, i);
      if (slots[j] == null && !tomb[j]) {
        int target = j;
        if (firstTomb >= 0) target = firstTomb;
        slots[target] = new Slot(key, value);
        tomb[target] = false;
        count = count + 1;
        return;
      }
      if (slots[j] == null) {
        if (firstTomb < 0) firstTomb = j;
        continue;
      }
      if (slots[j].key.equals(key)) {
        slots[j].value = value;
        return;
      }
    }
    if (firstTomb >= 0) {
      slots[firstTomb] = new Slot(key, value);
      tomb[firstTomb] = false;
      count = count + 1;
      return;
    }
    throw new RuntimeException("table overflow");
  }

  Integer get(String key) {
    for (int i = 0; i < size; i++) {
      int j = probe(key, i);
      if (slots[j] == null && !tomb[j]) return null;
      if (slots[j] != null && slots[j].key.equals(key)) return slots[j].value;
    }
    return null;
  }

  boolean delete(String key) {
    for (int i = 0; i < size; i++) {
      int j = probe(key, i);
      if (slots[j] == null && !tomb[j]) return false;
      if (slots[j] != null && slots[j].key.equals(key)) {
        slots[j] = null;
        tomb[j] = true;
        count = count - 1;
        return true;
      }
    }
    return false;
  }

  boolean isTombstone(int i) { return tomb[i]; }

  int indexOf(String key) {
    for (int i = 0; i < size; i++) {
      int j = probe(key, i);
      if (slots[j] != null && slots[j].key.equals(key)) return j;
    }
    return -1;
  }

  int occupied() {
    int c = 0;
    for (int i = 0; i < size; i++) if (slots[i] != null) c++;
    return c;
  }
}`,
      tests: [
        {
          name: "set then get round-trips",
          run(x, a) {
            const t = new x.OpenAddressed();
            t.set("a", 1);
            a.eq(t.get("a"), 1, "get('a') should be");
          },
        },
        {
          name: "colliding keys find separate slots",
          run(x, a) {
            const t = new x.OpenAddressed(4);
            t.set("a", 1); t.set("b", 2); t.set("c", 3);
            a.eq([t.get("a"), t.get("b"), t.get("c")], [1, 2, 3], "values should be");
            a.eq(t.occupied(), 3, "occupied slot count should be");
          },
        },
        {
          name: "delete leaves a tombstone, not an empty slot",
          run(x, a) {
            const t = new x.OpenAddressed(5);
            t.set("a", 1);
            const home = t.indexOf("a");
            t.delete("a");
            a.eq(t.isTombstone(home), true, "the freed slot should be a tombstone —");
          },
        },
        {
          name: "keys behind a deleted slot stay reachable",
          run(x, a) {
            const t = new x.OpenAddressed(4);
            t.set("a", 1); t.set("b", 2); t.set("c", 3);
            t.delete("a");
            a.eq(t.get("b"), 2, "get('b') after deleting 'a' should be");
            a.eq(t.get("c"), 3, "get('c') after deleting 'a' should be");
          },
        },
        {
          name: "insert reuses a tombstone",
          run(x, a) {
            const t = new x.OpenAddressed(5);
            t.set("a", 1);
            t.delete("a");
            t.set("z", 9);
            a.eq(t.get("z"), 9, "get('z') should be");
            a.eq(t.occupied(), 1, "occupied slots should be");
          },
        },
        {
          name: "missing keys return null",
          run(x, a) {
            const t = new x.OpenAddressed();
            t.set("x", 1);
            a.eq(t.get("nope"), null, "missing get should be");
            a.eq(t.delete("nope"), false, "missing delete should be");
          },
        },
        {
          name: "probing wraps around the end of the table",
          run(x, a) {
            const t = new x.OpenAddressed(5);
            for (let i = 0; i < 5; i++) {
              const p = t.probe("k", i);
              a.ok(p >= 0 && p < 5, `probe("k", ${i}) = ${p} is outside the table`);
            }
          },
        },
      ],
    },

    quiz: [
      {
        q: "With <code>h(k) = k mod 5</code>, linear probing, inserting 50 then 70 — where does 70 land?",
        options: ["slot 0", "slot 1", "slot 2", "it is rejected"],
        answer: 1,
        why: "70 mod 5 = 0 is taken by 50, so it probes to (0 + 1) = slot 1.",
      },
      {
        q: "Why must deletion write a tombstone instead of emptying the slot?",
        options: [
          "To keep the count accurate",
          "An empty slot terminates a probe chain, hiding keys stored further along it",
          "Because memory cannot be freed",
          "To keep the load factor constant",
        ],
        answer: 1,
        why: "Search stops at the first genuinely empty slot. Blanking a slot mid-chain makes everything after it unreachable.",
      },
      {
        q: "What does quadratic probing improve on compared to linear probing?",
        options: [
          "It removes the need for a hash function",
          "It allows more than m keys",
          "It breaks up primary clustering by spreading probes out",
          "It makes deletion free",
        ],
        answer: 2,
        why: "Linear probing grows contiguous runs that merge; stepping by i² scatters the probe sequence instead.",
      },
    ],
  });
})();
