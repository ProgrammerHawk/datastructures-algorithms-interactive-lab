/* Module 3 — Binary search trees, AVL, Red-Black.
 * Rotation naming and the height/balance rules follow the portfolio notes. */
(function () {
  const DSA = (window.DSA = window.DSA || {});
  const C = DSA.COLORS;
  const MOD = "Trees";

  const R = 20, XG = 54, YG = 76;

  /* ---- shared tree helpers ---- */
  const H = (n) => (n ? n.h : -1);          // notes: H(null) = -1, H(leaf) = 0
  const upd = (n) => { n.h = Math.max(H(n.left), H(n.right)) + 1; };
  const bal = (n) => (n ? H(n.left) - H(n.right) : 0);

  /** Assign x by in-order rank and y by depth, then flatten for rendering. */
  function layout(root) {
    const nodes = [], edges = [];
    let i = 0;
    (function walk(n, d) {
      if (!n) return;
      walk(n.left, d + 1);
      n._x = i++;
      n._y = d;
      walk(n.right, d + 1);
    })(root, 0);
    (function collect(n) {
      if (!n) return;
      nodes.push({
        id: n.id, key: n.key, x: n._x * XG, y: n._y * YG,
        color: n.color || null, h: n.h, bf: bal(n),
      });
      if (n.left) { edges.push({ id: n.id + ">" + n.left.id, x1: n._x * XG, y1: n._y * YG, x2: n.left._x * XG, y2: n.left._y * YG, red: n.left.color === "R" }); collect(n.left); }
      if (n.right) { edges.push({ id: n.id + ">" + n.right.id, x1: n._x * XG, y1: n._y * YG, x2: n.right._x * XG, y2: n.right._y * YG, red: n.right.color === "R" }); collect(n.right); }
    })(root);
    return { nodes, edges };
  }

  function inorder(n, out) { if (!n) return out; inorder(n.left, out); out.push(n.key); inorder(n.right, out); return out; }
  function preorder(n, out) { if (!n) return out; out.push(n.key); preorder(n.left, out); preorder(n.right, out); return out; }
  function postorder(n, out) { if (!n) return out; postorder(n.left, out); postorder(n.right, out); out.push(n.key); return out; }

  /** Render a laid-out tree. Node ids are stable so movement animates. */
  function drawTree(ctx, f, styleFor) {
    const scene = ctx.scene;
    scene.begin();
    const { nodes, edges } = f.tree;

    edges.forEach((e) => {
      scene.put(`e-${e.id}`, "path", {
        class: "n-edge",
        d: `M ${e.x1} ${e.y1} L ${e.x2} ${e.y2}`,
        stroke: e.red ? "#e11d48" : "#a8cbb8",
        "stroke-width": e.red ? 3.4 : 1.8,
        fill: "none",
      });
    });

    nodes.forEach((n) => {
      const st = styleFor(n, f) || {};
      scene.put(`n-${n.id}`, "circle", {
        class: "n-circle", cx: n.x, cy: n.y, r: R,
        fill: st.fill || C.idle, stroke: st.stroke || C.idleLine,
        "stroke-width": st.bold ? 3 : 1.8,
      });
      scene.put(`k-${n.id}`, "text", {
        class: "n-label", x: n.x, y: n.y, fill: st.textFill || "#12291f", "font-size": 14,
      }, n.key);
      if (st.badge != null)
        scene.put(`bd-${n.id}`, "text", {
          class: "n-label", x: n.x, y: n.y + R + 11,
          fill: st.badgeFill || "#7d9a8b", "font-size": 10.5,
        }, st.badge);
      if (st.tag)
        scene.put(`tg-${n.id}`, "text", {
          class: "n-label", x: n.x, y: n.y - R - 13,
          fill: st.tagFill || C.visit, "font-size": 11,
        }, st.tag);
    });

    scene.end();
    const pts = nodes.length ? nodes.map((n) => ({ x: n.x, y: n.y })) : [{ x: 0, y: 0 }];
    const minX = Math.min(...pts.map((p) => p.x)), maxX = Math.max(...pts.map((p) => p.x));
    const minY = Math.min(...pts.map((p) => p.y)), maxY = Math.max(...pts.map((p) => p.y));
    DSA.fit(ctx.svg, minX - R, minY - R - 18, maxX + R, maxY + R + 22, 20);
  }

  /* ================================================================
   * 3.1 BINARY SEARCH TREE
   * ============================================================== */
  DSA.lesson({
    id: "bst",
    module: MOD,
    title: "Binary search tree",
    blurb:
      "Everything left of a node is smaller, everything right is larger. That single invariant gives you sorted order for free.",
    tags: ["BST property", "in-order = sorted", "O(h) operations"],
    notes: `
      <h4>The invariant</h4>
      <p>For every node, all keys in the left subtree are <b>smaller</b> and all keys in the right
      subtree are <b>larger</b>. A BST is, as the notes say, a <i>sorted binary tree</i>.</p>
      <h4>Search</h4>
      <p>Compare, then discard half the remaining tree. Cost is <code>O(h)</code> where <code>h</code>
      is the height — not the node count.</p>
      <div class="callout warn">Height is the whole story. A balanced tree has
      <code>h ≈ log₂ n</code>, but insert already-sorted keys and the tree degenerates into a linked
      list with <code>h = n − 1</code>. The notes flag this directly: <i>for unbalanced binary search
      trees worst case insertion / deletion / search time is O(N)</i>.</div>
      <h4>Deletion — three cases</h4>
      <ol>
        <li><b>Leaf</b> — just remove it.</li>
        <li><b>One child</b> — splice the child into the removed node's place.</li>
        <li><b>Two children</b> — find the <b>in-order successor</b> (the smallest key larger than
        this node: go right once, then left as far as possible), copy its key up, then delete the
        successor from the right subtree.</li>
      </ol>
      <h4>Traversals</h4>
      <ul>
        <li><b>In-order</b> (L, node, R) — visits keys in <b>sorted order</b>.</li>
        <li><b>Pre-order</b> (node, L, R) — useful for copying a tree.</li>
        <li><b>Post-order</b> (L, R, node) — children before parent; used to free a tree, and to
        compute heights bottom-up.</li>
      </ul>`,
    complexity: [
      ["Operation", "Balanced", "Degenerate"],
      ["search", "O(log n)", "O(n)"],
      ["insert", "O(log n)", "O(n)"],
      ["delete", "O(log n)", "O(n)"],
      ["in-order walk", "O(n)", "O(n)"],
    ],
    pseudo: [
      "SEARCH(x, k)",
      "  while x != NIL and k != x.key",
      "      if k < x.key",
      "          x = x.left",
      "      else",
      "          x = x.right",
      "  return x",
      "",
      "DELETE(T, z)",
      "  if z has no children       -> remove z",
      "  else if z has one child    -> splice child into z",
      "  else",
      "      y = MINIMUM(z.right)   // in-order successor",
      "      z.key = y.key",
      "      remove y",
    ],
    legend: [
      { color: C.idle, label: "node" },
      { color: C.visit, label: "on the search path" },
      { color: C.done, label: "found / inserted" },
      { color: C.bad, label: "being deleted" },
      { color: C.warn, label: "in-order successor" },
    ],

    mount(ctx) {
      let uid = 1, root = null;
      const mkNode = (k) => ({ id: uid++, key: k, left: null, right: null, h: 0 });

      function rawInsert(k) {
        const z = mkNode(k);
        if (!root) { root = z; return z; }
        let x = root, y = null;
        while (x) { y = x; if (k === x.key) return null; x = k < x.key ? x.left : x.right; }
        if (k < y.key) y.left = z; else y.right = z;
        return z;
      }
      function reheight(n) { if (!n) return -1; n.h = Math.max(reheight(n.left), reheight(n.right)) + 1; return n.h; }

      function seed(keys) { root = null; uid = 1; keys.forEach(rawInsert); reheight(root); }
      seed([50, 30, 70, 20, 40, 60, 80, 35]);

      const refs = DSA.controls(ctx.controls, [
        { type: "input", name: "key", label: "key", inputType: "number", value: 45 },
        { type: "button", label: "Insert", onClick: () => doInsert() },
        { type: "button", label: "Search", variant: "alt", onClick: () => doSearch() },
        { type: "button", label: "Delete", variant: "danger", onClick: () => doDelete() },
        { type: "button", label: "In-order", onClick: () => doWalk("in") },
        { type: "button", label: "Pre-order", onClick: () => doWalk("pre") },
        { type: "button", label: "Post-order", onClick: () => doWalk("post") },
        { type: "button", label: "Degenerate", onClick: () => { seed([10, 20, 30, 40, 50, 60]); ctx.load([snap("Inserting sorted keys produces a linked list — height n−1, every operation O(n).", null, {})]); } },
        { type: "button", label: "Reset", onClick: () => { seed([50, 30, 70, 20, 40, 60, 80, 35]); ctx.load([snap("Tree reset.", null, {})]); } },
      ]);

      function snap(msg, line, opts) {
        reheight(root);
        return { tree: layout(root), msg, line, opts: opts || {}, order: inorder(root, []) };
      }

      function doSearch() {
        const k = DSA.readInt(refs.key, 0);
        const F = [snap(`Search for <b>${k}</b>, starting at the root.`, 1, {})];
        let x = root;
        while (x) {
          if (k === x.key) { F.push(snap(`<b>${k}</b> found.`, 6, { hot: x.id, kind: "done" })); ctx.load(F); return; }
          const goLeft = k < x.key;
          F.push(snap(`<b>${k}</b> ${goLeft ? "&lt;" : "&gt;"} <b>${x.key}</b> → go ${goLeft ? "left" : "right"}.`,
            goLeft ? 3 : 5, { hot: x.id, kind: "visit" }));
          x = goLeft ? x.left : x.right;
        }
        F.push(snap(`Reached NIL — <b>${k}</b> is not in the tree.`, 6, {}));
        ctx.load(F);
      }

      function doInsert() {
        const k = DSA.readInt(refs.key, 0);
        const F = [snap(`Insert <b>${k}</b> — walk down as if searching.`, 1, {})];
        let x = root;
        while (x) {
          if (k === x.key) { F.push(snap(`<b>${k}</b> is already present — BSTs hold distinct keys here.`, null, { hot: x.id, kind: "done" })); ctx.load(F); return; }
          const goLeft = k < x.key;
          F.push(snap(`<b>${k}</b> ${goLeft ? "&lt;" : "&gt;"} <b>${x.key}</b> → go ${goLeft ? "left" : "right"}.`,
            goLeft ? 3 : 5, { hot: x.id, kind: "visit" }));
          const nxt = goLeft ? x.left : x.right;
          if (!nxt) break;
          x = nxt;
        }
        const z = rawInsert(k);
        F.push(snap(`Slot is empty — attach <b>${k}</b> as a new leaf.`, null, { hot: z.id, kind: "done" }));
        ctx.load(F);
      }

      function doDelete() {
        const k = DSA.readInt(refs.key, 0);
        // locate node + parent
        let x = root, p = null;
        while (x && x.key !== k) { p = x; x = k < x.key ? x.left : x.right; }
        if (!x) { ctx.load([snap(`<b>${k}</b> is not in the tree.`, null, {})]); return; }

        const F = [snap(`Delete <b>${k}</b> — located the node.`, 8, { hot: x.id, kind: "remove" })];

        const replace = (parent, node, child) => {
          if (!parent) root = child;
          else if (parent.left === node) parent.left = child;
          else parent.right = child;
        };

        if (!x.left && !x.right) {
          F.push(snap(`<b>${k}</b> is a leaf — case 1, simply remove it.`, 9, { hot: x.id, kind: "remove" }));
          replace(p, x, null);
          F.push(snap(`Removed. No other links needed repairing.`, 9, {}));
        } else if (!x.left || !x.right) {
          const child = x.left || x.right;
          F.push(snap(`<b>${k}</b> has one child (<b>${child.key}</b>) — case 2, splice the child up.`, 10,
            { hot: x.id, kind: "remove", warm: child.id }));
          replace(p, x, child);
          F.push(snap(`<b>${child.key}</b> took its parent's place.`, 10, { hot: child.id, kind: "done" }));
        } else {
          F.push(snap(`<b>${k}</b> has two children — case 3. Find the in-order successor.`, 12, { hot: x.id, kind: "remove" }));
          let sp = x, s = x.right;
          F.push(snap(`Go right once to <b>${s.key}</b>…`, 12, { hot: x.id, kind: "remove", warm: s.id }));
          while (s.left) { sp = s; s = s.left; F.push(snap(`…then left to <b>${s.key}</b>.`, 12, { hot: x.id, kind: "remove", warm: s.id })); }
          F.push(snap(`Successor is <b>${s.key}</b> — the smallest key greater than ${k}. Copy it up.`, 13,
            { hot: x.id, kind: "remove", warm: s.id }));
          x.key = s.key;
          replace(sp, s, s.right);
          F.push(snap(`<b>${s.key}</b> now sits where ${k} was, and the duplicate leaf is gone. BST order is preserved.`, 14,
            { hot: x.id, kind: "done" }));
        }
        ctx.load(F);
      }

      function doWalk(kind) {
        const order = kind === "in" ? inorder(root, []) : kind === "pre" ? preorder(root, []) : postorder(root, []);
        const idOf = {};
        (function map(n) { if (!n) return; idOf[n.key] = n.id; map(n.left); map(n.right); })(root);
        const name = kind === "in" ? "In-order (L, node, R)" : kind === "pre" ? "Pre-order (node, L, R)" : "Post-order (L, R, node)";
        const F = [snap(`${name} traversal.`, null, {})];
        order.forEach((k, i) => {
          F.push(snap(`Visit <b>${k}</b> — sequence so far: <b>${order.slice(0, i + 1).join(", ")}</b>`, null,
            { hot: idOf[k], kind: "visit", visited: order.slice(0, i + 1) }));
        });
        F.push(snap(
          kind === "in"
            ? `Result: <b>${order.join(", ")}</b> — in-order always emits sorted keys.`
            : `Result: <b>${order.join(", ")}</b>`,
          null, { visited: order }));
        ctx.load(F);
      }

      ctx.render = function (f) {
        drawTree(ctx, f, (n) => {
          const o = f.opts;
          if (o.hot === n.id) {
            if (o.kind === "visit") return { fill: "#d2eef8", stroke: C.visit, bold: true, tag: "x" };
            if (o.kind === "done") return { fill: "#cdf0df", stroke: C.done, bold: true };
            if (o.kind === "remove") return { fill: "#fde2e8", stroke: C.bad, bold: true, tag: "delete" };
          }
          if (o.warm === n.id) return { fill: "#fcefd4", stroke: C.warn, bold: true, tag: "successor" };
          if (o.visited && o.visited.indexOf(n.key) >= 0) return { fill: "#e2edf9", stroke: C.active };
          return {};
        });
        const height = f.tree.nodes.length ? Math.max(...f.tree.nodes.map((n) => n.y)) / YG : -1;
        ctx.trace.innerHTML =
          DSA.chips("in-order:", f.order, "empty tree") +
          `<div style="margin-top:4px;color:var(--dim)">${f.tree.nodes.length} node(s) · height ${height}</div>`;
      };

      ctx.load([snap("A balanced BST. Every left subtree is smaller, every right subtree larger.", null, {})]);
    },

    code: {
      exports: ["BST"],
      starter: `// Binary search tree.
class BstNode {
  int key;
  BstNode left;
  BstNode right;
  BstNode(int key) {
    this.key = key;
  }
}

class BST {
  BstNode root = null;

  void insert(int key) {
    // walk down, attach as a leaf; ignore duplicates
  }

  boolean contains(int key) {
    // iterative search
  }

  Integer min() {
    // leftmost key, or null when empty
  }

  ArrayList<Integer> inorder() {
    ArrayList<Integer> out = new ArrayList<>();
    walk(root, out);
    return out;
  }

  private void walk(BstNode n, ArrayList<Integer> out) {
    if (n == null) return;
    walk(n.left, out);
    out.add(n.key);
    walk(n.right, out);
  }

  // edges on the longest root-to-leaf path; empty tree = -1
  int height() {
    return heightOf(root);
  }

  private int heightOf(BstNode n) {
    if (n == null) return -1;
    return Math.max(heightOf(n.left), heightOf(n.right)) + 1;
  }
}`,
      solution: `class BstNode {
  int key;
  BstNode left;
  BstNode right;
  BstNode(int key) {
    this.key = key;
  }
}

class BST {
  BstNode root = null;

  void insert(int key) {
    BstNode z = new BstNode(key);
    if (root == null) { root = z; return; }
    BstNode x = root;
    BstNode y = null;
    while (x != null) {
      y = x;
      if (key == x.key) return;
      if (key < x.key) x = x.left;
      else x = x.right;
    }
    if (key < y.key) y.left = z;
    else y.right = z;
  }

  boolean contains(int key) {
    BstNode x = root;
    while (x != null) {
      if (key == x.key) return true;
      if (key < x.key) x = x.left;
      else x = x.right;
    }
    return false;
  }

  Integer min() {
    BstNode x = root;
    if (x == null) return null;
    while (x.left != null) x = x.left;
    return x.key;
  }

  ArrayList<Integer> inorder() {
    ArrayList<Integer> out = new ArrayList<>();
    walk(root, out);
    return out;
  }

  private void walk(BstNode n, ArrayList<Integer> out) {
    if (n == null) return;
    walk(n.left, out);
    out.add(n.key);
    walk(n.right, out);
  }

  int height() {
    return heightOf(root);
  }

  private int heightOf(BstNode n) {
    if (n == null) return -1;
    return Math.max(heightOf(n.left), heightOf(n.right)) + 1;
  }
}`,
      tests: [
        {
          name: "in-order traversal returns sorted keys",
          run(x, a) {
            const t = new x.BST();
            [50, 30, 70, 20, 40].forEach((k) => t.insert(k));
            a.eq(t.inorder(), [20, 30, 40, 50, 70], "sorted order should be");
          },
        },
        {
          name: "contains finds present keys and rejects absent ones",
          run(x, a) {
            const t = new x.BST();
            [8, 3, 10, 1].forEach((k) => t.insert(k));
            a.eq(t.contains(3), true, "contains(3) should be");
            a.eq(t.contains(99), false, "contains(99) should be");
          },
        },
        {
          name: "min returns the leftmost key",
          run(x, a) {
            const t = new x.BST();
            [15, 9, 20, 4].forEach((k) => t.insert(k));
            a.eq(t.min(), 4, "min() should be");
          },
        },
        {
          name: "duplicates are ignored",
          run(x, a) {
            const t = new x.BST();
            [5, 5, 5].forEach((k) => t.insert(k));
            a.eq(t.inorder(), [5], "tree should be");
          },
        },
        {
          name: "sorted insertion degenerates into a chain",
          run(x, a) {
            const t = new x.BST();
            [1, 2, 3, 4, 5].forEach((k) => t.insert(k));
            a.eq(t.height(), 4, "height of a 5-node chain should be");
          },
        },
        {
          name: "empty tree reports height -1",
          run(x, a) {
            const t = new x.BST();
            a.eq(t.height(), -1, "empty height should be");
            a.eq(t.inorder(), [], "empty traversal should be");
          },
        },
      ],
    },

    quiz: [
      {
        q: "Which traversal outputs the keys in sorted order?",
        options: ["Pre-order", "In-order", "Post-order", "Level-order"],
        answer: 1,
        why: "In-order visits the left subtree, then the node, then the right subtree — exactly ascending order under the BST property.",
      },
      {
        q: "Deleting a node with two children replaces it with…",
        options: [
          "its left child",
          "the largest key in the whole tree",
          "its in-order successor — the smallest key in the right subtree",
          "the root",
        ],
        answer: 2,
        why: "The successor is the only key that can sit there without violating the ordering on either side.",
      },
      {
        q: "You insert 1, 2, 3, 4, 5 into an empty BST. What is the height?",
        options: ["0", "2", "4", "log₂ 5 ≈ 2.3"],
        answer: 2,
        why: "Each key is larger than the last, so it forms a right-leaning chain of 5 nodes — 4 edges tall.",
      },
    ],
  });

  /* ================================================================
   * 3.2 AVL TREE
   * ============================================================== */
  DSA.lesson({
    id: "avl",
    module: MOD,
    title: "AVL tree — self-balancing",
    blurb:
      "Track a balance factor at every node and rotate the moment it exceeds ±1. Height stays O(log n), always.",
    tags: ["balance = hL − hR", "LL / LR / RR / RL", "guaranteed O(log n)"],
    notes: `
      <h4>Balance factor</h4>
      <span class="rule">balance = Height(left subtree) − Height(right subtree)</span>
      <p>Heights are computed recursively from the leaves upward. From the notes:</p>
      <ul>
        <li><code>H(no nodes) = −1</code></li>
        <li><code>H(single node) = 0</code></li>
        <li><code>H(node) = max(H(left), H(right)) + 1</code></li>
      </ul>
      <div class="callout">If <code>balance</code> is <b>0 or ±1</b> the node is balanced.
      <b>Positive</b> means left-heavy (left-leaning), <b>negative</b> means right-heavy.</div>
      <h4>The four rotation cases</h4>
      <p>The mnemonic from the notes — the rotation is named after how the tree leans:</p>
      <ul>
        <li><b>LL</b> — left-leaning, straight line → a single <b>right</b> rotation.</li>
        <li><b>LR</b> — left-leaning, zig-zag → left rotation, then right rotation.</li>
        <li><b>RR</b> — right-leaning, straight line → a single <b>left</b> rotation.</li>
        <li><b>RL</b> — right-leaning, zig-zag → right rotation, then left rotation.</li>
      </ul>
      <span class="rule">balance &gt;  1 and line     -> LL  (single right)
balance &gt;  1 and zig-zag  -> LR  (left, then right)
balance &lt; -1 and line     -> RR  (single left)
balance &lt; -1 and zig-zag  -> RL  (right, then left)</span>
      <h4>Height bounds</h4>
      <p>For <code>n</code> nodes the notes give:</p>
      <span class="rule">minimum height = ceil(log2(n + 1))
maximum height = floor(1.44 * log2(n + 2) − 0.328)</span>
      <h4>The cost</h4>
      <p>AVL trees stay tightly balanced, so lookups are fast. The trade, as the notes put it, is that
      they <i>require many rotations</i> to maintain that balance on every insert and delete.</p>`,
    complexity: [
      ["Operation", "Time", "Rotations"],
      ["search", "O(log n)", "—"],
      ["insert", "O(log n)", "≤ 2"],
      ["delete", "O(log n)", "O(log n)"],
      ["height bound", "≈1.44 log₂n", "—"],
    ],
    pseudo: [
      "INSERT(node, k)",
      "  standard BST insert",
      "  node.h = max(H(left), H(right)) + 1",
      "  b = H(left) - H(right)",
      "",
      "  if b > 1 and k < node.left.key      // LL, line",
      "      return RIGHT-ROTATE(node)",
      "  if b > 1 and k > node.left.key      // LR, zig-zag",
      "      node.left = LEFT-ROTATE(node.left)",
      "      return RIGHT-ROTATE(node)",
      "  if b < -1 and k > node.right.key    // RR, line",
      "      return LEFT-ROTATE(node)",
      "  if b < -1 and k < node.right.key    // RL, zig-zag",
      "      node.right = RIGHT-ROTATE(node.right)",
      "      return LEFT-ROTATE(node)",
      "  return node",
    ],
    legend: [
      { color: C.idle, label: "balanced" },
      { color: C.bad, label: "|balance| > 1" },
      { color: C.warn, label: "rotation pivot" },
      { color: C.done, label: "newly inserted" },
      { color: C.visit, label: "path walked" },
    ],

    mount(ctx) {
      let uid = 1, root = null;
      const node = (k) => ({ id: uid++, key: k, left: null, right: null, h: 0 });

      function rotR(y) { const x = y.left; y.left = x.right; x.right = y; upd(y); upd(x); return x; }
      function rotL(x) { const y = x.right; x.right = y.left; y.left = x; upd(x); upd(y); return y; }

      function snap(msg, line, opts) {
        return { tree: layout(root), msg, line, opts: opts || {} };
      }

      /* Insert, collecting a frame for every rotation on the way back up. */
      function avlInsert(n, k, F, path) {
        if (!n) { const z = node(k); return { n: z, made: z }; }
        path.push(n.id);
        let made = null;
        if (k < n.key) { const r = avlInsert(n.left, k, F, path); n.left = r.n; made = r.made; }
        else if (k > n.key) { const r = avlInsert(n.right, k, F, path); n.right = r.n; made = r.made; }
        else return { n, made: null };

        upd(n);
        const b = bal(n);
        if (b > 1 && k < n.left.key) {
          F.push({ pivot: n.id, kind: "LL", msg: `Node <b>${n.key}</b> has balance <b>${b}</b> — left-leaning, straight line. <b>LL → single right rotation</b>.`, line: 5 });
          return { n: rotR(n), made };
        }
        if (b > 1 && k > n.left.key) {
          F.push({ pivot: n.id, kind: "LR", msg: `Node <b>${n.key}</b> has balance <b>${b}</b> — left-leaning zig-zag. <b>LR → left rotate the child, then right rotate here</b>.`, line: 7 });
          n.left = rotL(n.left);
          return { n: rotR(n), made };
        }
        if (b < -1 && k > n.right.key) {
          F.push({ pivot: n.id, kind: "RR", msg: `Node <b>${n.key}</b> has balance <b>${b}</b> — right-leaning, straight line. <b>RR → single left rotation</b>.`, line: 11 });
          return { n: rotL(n), made };
        }
        if (b < -1 && k < n.right.key) {
          F.push({ pivot: n.id, kind: "RL", msg: `Node <b>${n.key}</b> has balance <b>${b}</b> — right-leaning zig-zag. <b>RL → right rotate the child, then left rotate here</b>.`, line: 13 });
          n.right = rotR(n.right);
          return { n: rotL(n), made };
        }
        return { n, made };
      }

      function seed(keys) { root = null; uid = 1; keys.forEach((k) => { const F = []; root = avlInsert(root, k, F, []).n; }); }
      seed([30, 20, 40, 10, 25]);

      const refs = DSA.controls(ctx.controls, [
        { type: "input", name: "key", label: "key", inputType: "number", value: 5 },
        { type: "button", label: "Insert", onClick: () => doInsert() },
        { type: "button", label: "Demo LL", onClick: () => demo([30, 20, 10], "LL — three descending keys force a single right rotation.") },
        { type: "button", label: "Demo RR", onClick: () => demo([10, 20, 30], "RR — three ascending keys force a single left rotation.") },
        { type: "button", label: "Demo LR", onClick: () => demo([30, 10, 20], "LR — zig-zag left, needs a double rotation.") },
        { type: "button", label: "Demo RL", onClick: () => demo([10, 30, 20], "RL — zig-zag right, needs a double rotation.") },
        { type: "button", label: "Random", onClick: () => { seed(shuffle()); ctx.load([snap("Random keys — the tree self-balanced during every insert.", null, {})]); } },
        { type: "button", label: "Reset", onClick: () => { seed([30, 20, 40, 10, 25]); ctx.load([snap("Tree reset.", null, {})]); } },
      ]);

      function shuffle() {
        const a = [];
        while (a.length < 8) { const v = DSA.randInt(5, 95); if (a.indexOf(v) < 0) a.push(v); }
        return a;
      }

      function demo(keys, note) {
        root = null; uid = 1;
        const F = [];
        keys.forEach((k, i) => {
          const rot = [];
          const path = [];
          const res = avlInsert(root, k, rot, path);
          root = res.n;
          F.push(snap(`Insert <b>${k}</b>.`, 1, { hot: res.made ? res.made.id : null, kind: "done" }));
          rot.forEach((r) => F.push(snap(r.msg, r.line, { pivot: r.pivot, showBalance: true })));
          if (rot.length) F.push(snap(`After the ${rot[0].kind} rotation every balance factor is back within ±1.`, null, { showBalance: true }));
        });
        F.push(snap(note, null, { showBalance: true }));
        ctx.load(F);
      }

      function doInsert() {
        const k = DSA.readInt(refs.key, 0);
        const rot = [], path = [];
        const before = layout(root);
        const F = [{ tree: before, msg: `Insert <b>${k}</b> — walk down like a normal BST.`, line: 1, opts: { showBalance: true } }];
        const res = avlInsert(root, k, rot, path);
        root = res.n;
        if (!res.made) { ctx.load([snap(`<b>${k}</b> is already in the tree.`, null, {})]); return; }
        F.push(snap(`<b>${k}</b> attached as a leaf. Now update heights on the way back up.`, 2,
          { hot: res.made.id, kind: "done", showBalance: true }));
        if (!rot.length) {
          F.push(snap(`Every balance factor is still within ±1 — no rotation needed.`, 3, { showBalance: true }));
        } else {
          rot.forEach((r) => F.push(snap(r.msg, r.line, { pivot: r.pivot, showBalance: true })));
          F.push(snap(`Rebalanced with a <b>${rot[0].kind}</b> rotation. Height is back to O(log n).`, null, { showBalance: true }));
        }
        ctx.load(F);
      }

      ctx.render = function (f) {
        drawTree(ctx, f, (n) => {
          const o = f.opts;
          const st = {};
          if (o.showBalance !== false) {
            st.badge = `bf ${n.bf > 0 ? "+" : ""}${n.bf}`;
            st.badgeFill = Math.abs(n.bf) > 1 ? C.bad : "#7d9a8b";
          }
          if (o.pivot === n.id) { st.fill = "#fcefd4"; st.stroke = C.warn; st.bold = true; st.tag = "pivot"; st.tagFill = C.warn; }
          else if (o.hot === n.id && o.kind === "done") { st.fill = "#cdf0df"; st.stroke = C.done; st.bold = true; }
          else if (Math.abs(n.bf) > 1) { st.fill = "#fde2e8"; st.stroke = C.bad; st.bold = true; }
          return st;
        });
        const n = f.tree.nodes.length;
        const height = n ? Math.max(...f.tree.nodes.map((x) => x.y)) / YG : -1;
        const minH = n ? Math.ceil(Math.log2(n + 1)) : 0;
        const maxH = n ? Math.floor(1.44 * Math.log2(n + 2) - 0.328) : 0;
        ctx.trace.innerHTML =
          `<div style="color:var(--dim)">${n} node(s) · actual height <b style="color:var(--accent-2)">${height}</b> · AVL bounds: min ${minH}, max ${maxH}</div>`;
      };

      ctx.load([snap("A small AVL tree. Each node shows its balance factor.", null, { showBalance: true })]);
    },

    code: {
      exports: ["AVL", "AvlNode"],
      starter: `// Follow the notes: H(null) = -1, H(leaf) = 0.
class AvlNode {
  int key;
  AvlNode left;
  AvlNode right;
  int h;
  AvlNode(int key) {
    this.key = key;
    this.h = 0;
  }
}

class AVL {
  static int height(AvlNode node) {
    // return -1 for null, otherwise node.h
  }

  static AvlNode update(AvlNode node) {
    node.h = Math.max(height(node.left), height(node.right)) + 1;
    return node;
  }

  static int balanceFactor(AvlNode node) {
    // Height(left) - Height(right); 0 for null
  }

  // LL case: rotate the left-leaning line to the right.
  //      y            x
  //     / \\          / \\
  //    x   C   ->    A   y
  //   / \\              / \\
  //  A   B            B   C
  static AvlNode rotateRight(AvlNode y) {
    // return the new subtree root, and fix heights
  }

  // RR case: rotate the right-leaning line to the left.
  static AvlNode rotateLeft(AvlNode x) {
    // return the new subtree root, and fix heights
  }
}`,
      solution: `class AvlNode {
  int key;
  AvlNode left;
  AvlNode right;
  int h;
  AvlNode(int key) {
    this.key = key;
    this.h = 0;
  }
}

class AVL {
  static int height(AvlNode node) {
    if (node == null) return -1;
    return node.h;
  }

  static AvlNode update(AvlNode node) {
    node.h = Math.max(height(node.left), height(node.right)) + 1;
    return node;
  }

  static int balanceFactor(AvlNode node) {
    if (node == null) return 0;
    return height(node.left) - height(node.right);
  }

  static AvlNode rotateRight(AvlNode y) {
    AvlNode x = y.left;
    y.left = x.right;
    x.right = y;
    update(y);
    update(x);
    return x;
  }

  static AvlNode rotateLeft(AvlNode x) {
    AvlNode y = x.right;
    x.right = y.left;
    y.left = x;
    update(x);
    update(y);
    return y;
  }
}`,
      tests: [
        {
          name: "height follows the notes: null is -1, a leaf is 0",
          run(x, a) {
            a.eq(x.AVL.height(null), -1, "height(null) should be");
            a.eq(x.AVL.height(new x.AvlNode(1)), 0, "height(leaf) should be");
          },
        },
        {
          name: "balanceFactor is positive when left-heavy",
          run(x, a) {
            const leaf = new x.AvlNode(1);
            const n = new x.AvlNode(2);
            n.left = leaf; n.h = 1;
            a.eq(x.AVL.balanceFactor(n), 1, "left-heavy balance should be");
            const n2 = new x.AvlNode(2);
            n2.right = new x.AvlNode(1); n2.h = 1;
            a.eq(x.AVL.balanceFactor(n2), -1, "right-heavy balance should be");
          },
        },
        {
          name: "rotateRight promotes the left child",
          run(x, a) {
            const A = new x.AvlNode(1);
            const xn = new x.AvlNode(2); xn.left = A; xn.h = 1;
            const y = new x.AvlNode(3); y.left = xn; y.h = 2;
            const r = x.AVL.rotateRight(y);
            a.eq(r.key, 2, "new root key should be");
            a.eq(r.left.key, 1, "new root left should be");
            a.eq(r.right.key, 3, "new root right should be");
          },
        },
        {
          name: "rotateLeft promotes the right child",
          run(x, a) {
            const C = new x.AvlNode(3);
            const y = new x.AvlNode(2); y.right = C; y.h = 1;
            const xn = new x.AvlNode(1); xn.right = y; xn.h = 2;
            const r = x.AVL.rotateLeft(xn);
            a.eq(r.key, 2, "new root key should be");
            a.eq(r.left.key, 1, "new root left should be");
            a.eq(r.right.key, 3, "new root right should be");
          },
        },
        {
          name: "rotation repairs heights and rebalances",
          run(x, a) {
            const A = new x.AvlNode(1);
            const xn = new x.AvlNode(2); xn.left = A; xn.h = 1;
            const y = new x.AvlNode(3); y.left = xn; y.h = 2;
            a.eq(x.AVL.balanceFactor(y), 2, "before rotating, balance should be");
            const r = x.AVL.rotateRight(y);
            a.eq(r.h, 1, "new root height should be");
            a.eq(x.AVL.balanceFactor(r), 0, "after rotating, balance should be");
          },
        },
        {
          name: "rotation preserves in-order (BST) order",
          run(x, a) {
            const xn = new x.AvlNode(2);
            xn.left = new x.AvlNode(1); xn.right = new x.AvlNode(3); xn.h = 1;
            const y = new x.AvlNode(4);
            y.left = xn; y.right = new x.AvlNode(5); y.h = 2;
            const walk = (n, o) => { if (!n) return o; walk(n.left, o); o.push(n.key); walk(n.right, o); return o; };
            a.eq(walk(x.AVL.rotateRight(y), []), [1, 2, 3, 4, 5], "in-order after rotation should be");
          },
        },
      ],
    },

    quiz: [
      {
        q: "A node has balance factor <b>+2</b> and the new key went into the left child's <i>left</i> subtree. Which rotation?",
        options: [
          "RR — single left rotation",
          "LL — single right rotation",
          "LR — left then right",
          "RL — right then left",
        ],
        answer: 1,
        why: "Left-leaning in a straight line is the LL case, fixed by one right rotation — the rotation is named after the lean.",
      },
      {
        q: "What is <code>Height</code> of a node with no children, per the notes?",
        options: ["-1", "0", "1", "undefined"],
        answer: 1,
        why: "H(null) = -1 and H(single node) = 0, since height counts edges below the node.",
      },
      {
        q: "Why does AVL insert need at most two rotations, while delete may need O(log n)?",
        options: [
          "Deletion is implemented recursively",
          "Insertion restores the subtree's original height, so rebalancing stops; deletion can shorten a subtree and propagate upward",
          "Deletion has to re-sort the tree",
          "Insertion never unbalances the tree",
        ],
        answer: 1,
        why: "One rotation after insert returns the subtree to its pre-insert height, so ancestors are unaffected. A delete can reduce height and cascade all the way to the root.",
      },
    ],
  });

  /* ================================================================
   * 3.3 RED-BLACK TREE
   * ============================================================== */
  DSA.lesson({
    id: "rbt",
    module: MOD,
    title: "Red-Black tree",
    blurb:
      "Looser balance than AVL, enforced by colour rules. Often a recolouring is enough — no rotation at all.",
    tags: ["5 colour rules", "black height", "≤ 2·log₂(n+1)"],
    notes: `
      <h4>The five rules</h4>
      <ol>
        <li>A node is either <b>red</b> or <b>black</b>.</li>
        <li>The <b>root and leaves are black</b> (leaves are the NIL sentinels).</li>
        <li>A <b>red node always has black children</b> — no two reds in a row.</li>
        <li>Every path from a node to its NIL descendants contains the <b>same number of black nodes</b>.</li>
        <li>New nodes are always inserted <b>red</b>.</li>
      </ol>
      <h4>Black height</h4>
      <p>The number of black nodes from a node down to any NIL, excluding the node itself. Rule 4
      forces this to be identical along every path, and that is what bounds the height:</p>
      <span class="rule">maximum height of a red-black tree = 2 · log2(n + 1)</span>
      <p>Because the shortest possible path is all black and the longest alternates red and black,
      <b>the longest path is at most twice the shortest</b>.</p>
      <h4>Fixing a violation after insert</h4>
      <p>Inserting red can only ever break rule 3. The repair depends on the new node's
      <b>uncle</b> (the notes call it the aunt):</p>
      <ul>
        <li><b>Uncle is RED</b> → just <b>recolour</b>: parent and uncle become black, grandparent
        becomes red. Then repeat the check from the grandparent.</li>
        <li><b>Uncle is BLACK</b> → <b>rotate</b>. If the new node is an "inner" child, first rotate
        the parent to straighten the line, then recolour parent/grandparent and rotate the grandparent.</li>
      </ul>
      <div class="callout">The root may get coloured red during a fixup — always force it back to
      black at the end. As the notes say: <i>the root can never be red</i>.</div>
      <h4>Why choose it over AVL?</h4>
      <p>Fewer rotations — <i>sometimes require only re-coloring of nodes</i> — which makes inserts and
      deletes cheaper. AVL is more rigidly balanced, so it wins on lookup-heavy workloads. Storage
      overhead is just one bit per node, so memory stays <code>O(n)</code>.</p>`,
    complexity: [
      ["Operation", "Time", "Rotations"],
      ["search", "O(log n)", "—"],
      ["insert", "O(log n)", "≤ 2"],
      ["delete", "O(log n)", "≤ 3"],
      ["colour bit", "O(n)", "1 bit/node"],
    ],
    pseudo: [
      "RB-INSERT-FIXUP(T, z)",
      "  while z.parent.color == RED",
      "      if z.parent == z.parent.parent.left",
      "          y = z.parent.parent.right          // uncle",
      "          if y.color == RED                  // case 1: recolour",
      "              z.parent.color = BLACK",
      "              y.color = BLACK",
      "              z.parent.parent.color = RED",
      "              z = z.parent.parent",
      "          else",
      "              if z == z.parent.right         // case 2: straighten",
      "                  z = z.parent",
      "                  LEFT-ROTATE(T, z)",
      "              z.parent.color = BLACK         // case 3: rotate",
      "              z.parent.parent.color = RED",
      "              RIGHT-ROTATE(T, z.parent.parent)",
      "      else  (mirror image)",
      "  T.root.color = BLACK",
    ],
    legend: [
      { color: "#fecdd3", label: "red node" },
      { color: "#334155", label: "black node" },
      { color: C.warn, label: "uncle" },
      { color: C.visit, label: "z (current)" },
      { color: C.done, label: "just inserted" },
    ],

    mount(ctx) {
      let uid = 1;
      const T = { root: null };
      const node = (k) => ({ id: uid++, key: k, color: "R", left: null, right: null, parent: null, h: 0 });

      function leftRotate(t, x) {
        const y = x.right;
        x.right = y.left;
        if (y.left) y.left.parent = x;
        y.parent = x.parent;
        if (!x.parent) t.root = y;
        else if (x === x.parent.left) x.parent.left = y;
        else x.parent.right = y;
        y.left = x;
        x.parent = y;
      }
      function rightRotate(t, x) {
        const y = x.left;
        x.left = y.right;
        if (y.right) y.right.parent = x;
        y.parent = x.parent;
        if (!x.parent) t.root = y;
        else if (x === x.parent.right) x.parent.right = y;
        else x.parent.left = y;
        y.right = x;
        x.parent = y;
      }
      const isRed = (n) => !!n && n.color === "R";

      function snap(msg, line, opts) {
        return { tree: layout(T.root), msg, line, opts: opts || {} };
      }

      function rbInsert(k, F) {
        let y = null, x = T.root;
        while (x) { y = x; if (k === x.key) return null; x = k < x.key ? x.left : x.right; }
        const z = node(k);
        z.parent = y;
        if (!y) T.root = z;
        else if (k < y.key) y.left = z; else y.right = z;

        if (F) F.push(snap(`Insert <b>${k}</b> as a <b>RED</b> leaf — new nodes are always red.`, null,
          { hot: z.id, kind: "new" }));

        // fixup
        let cur = z;
        while (isRed(cur.parent)) {
          const p = cur.parent, gp = p.parent;
          if (!gp) break;
          const left = p === gp.left;
          const uncle = left ? gp.right : gp.left;
          if (F) F.push(snap(
            `<b>${cur.key}</b> and its parent <b>${p.key}</b> are both red — rule 3 broken. Look at the uncle: ${uncle ? `<b>${uncle.key}</b> (${uncle.color === "R" ? "RED" : "BLACK"})` : "<b>NIL</b> (black)"}.`,
            uncle && isRed(uncle) ? 4 : 9, { hot: cur.id, uncle: uncle ? uncle.id : null, gp: gp.id }));

          if (isRed(uncle)) {
            p.color = "B"; uncle.color = "B"; gp.color = "R";
            if (F) F.push(snap(
              `Uncle is red → <b>recolour only</b>. Parent and uncle go black, grandparent goes red. No rotation needed.`,
              5, { hot: gp.id, kind: "recolor", gp: gp.id }));
            cur = gp;
          } else {
            if (left && cur === p.right) {
              cur = p;
              leftRotate(T, cur);
              if (F) F.push(snap(`Uncle is black and <b>${cur.key}</b> is an inner child — left-rotate to straighten the zig-zag into a line.`, 12, { hot: cur.id, kind: "rotate" }));
            } else if (!left && cur === p.left) {
              cur = p;
              rightRotate(T, cur);
              if (F) F.push(snap(`Uncle is black and <b>${cur.key}</b> is an inner child — right-rotate to straighten the zig-zag into a line.`, 12, { hot: cur.id, kind: "rotate" }));
            }
            cur.parent.color = "B";
            cur.parent.parent.color = "R";
            const g2 = cur.parent.parent;
            if (left) rightRotate(T, g2); else leftRotate(T, g2);
            if (F) F.push(snap(`Recolour parent black and grandparent red, then <b>${left ? "right" : "left"}-rotate the grandparent</b>. Rule 3 is restored.`,
              14, { hot: cur.id, kind: "rotate", gp: g2.id }));
          }
        }
        if (T.root.color !== "B") {
          T.root.color = "B";
          if (F) F.push(snap(`Finally force the root black — <b>the root can never be red</b>.`, 17, { hot: T.root.id, kind: "recolor" }));
        }
        return z;
      }

      function seed(keys) { T.root = null; uid = 1; keys.forEach((k) => rbInsert(k, null)); }
      seed([3, 1, 5, 7, 6]);

      const refs = DSA.controls(ctx.controls, [
        { type: "input", name: "key", label: "key", inputType: "number", value: 8 },
        { type: "button", label: "Insert", onClick: () => doInsert() },
        {
          type: "button", label: "Notes example", onClick: () => {
            T.root = null; uid = 1;
            const F = [];
            [3, 1, 5, 7, 6, 8, 9, 10].forEach((k) => rbInsert(k, F));
            F.push(snap("The full sequence 3, 1, 5, 7, 6, 8, 9, 10 from the notes — recolourings and rotations interleaved.", null, {}));
            ctx.load(F);
          },
        },
        { type: "button", label: "Recolour case", onClick: () => { T.root = null; uid = 1; const F = []; [10, 5, 15, 3].forEach((k) => rbInsert(k, F)); F.push(snap("Inserting 3 gave a red uncle (15), so a pure recolouring fixed it — no rotation.", null, {})); ctx.load(F); } },
        { type: "button", label: "Rotate case", onClick: () => { T.root = null; uid = 1; const F = []; [10, 5, 3].forEach((k) => rbInsert(k, F)); F.push(snap("Uncle was NIL (black), so this needed a rotation, not just a recolour.", null, {})); ctx.load(F); } },
        { type: "button", label: "Reset", onClick: () => { seed([3, 1, 5, 7, 6]); ctx.load([snap("Tree reset.", null, {})]); } },
      ]);

      function doInsert() {
        const k = DSA.readInt(refs.key, 0);
        const F = [];
        const z = rbInsert(k, F);
        if (!z) { ctx.load([snap(`<b>${k}</b> is already in the tree.`, null, {})]); return; }
        F.push(snap(`Insert complete. All five red-black rules hold again.`, null, {}));
        ctx.load(F);
      }

      /* black height from the root, excluding the root itself */
      function blackHeight(n) {
        let bh = 0;
        let cur = n;
        while (cur) { if (cur.color === "B" && cur !== n) bh++; cur = cur.left; }
        return bh + 1; // + the NIL leaf
      }

      ctx.render = function (f) {
        drawTree(ctx, f, (n) => {
          const o = f.opts;
          const red = n.color === "R";
          const st = {
            fill: red ? "#fecdd3" : "#334155",
            stroke: red ? "#e11d48" : "#1e293b",
            textFill: red ? "#9f1239" : "#ffffff",
          };
          if (o.uncle === n.id) { st.stroke = C.warn; st.bold = true; st.tag = "uncle"; st.tagFill = C.warn; }
          if (o.gp === n.id && o.hot !== n.id) { st.tag = st.tag || "grandparent"; st.tagFill = "#6b8a7a"; }
          if (o.hot === n.id) {
            st.bold = true;
            st.tag = o.kind === "new" ? "z (new)" : "z";
            st.tagFill = o.kind === "recolor" ? C.done : C.visit;
            st.stroke = o.kind === "recolor" ? C.done : C.visit;
          }
          return st;
        });
        const n = f.tree.nodes.length;
        const reds = f.tree.nodes.filter((x) => x.color === "R").length;
        const height = n ? Math.max(...f.tree.nodes.map((x) => x.y)) / YG : -1;
        const bound = n ? (2 * Math.log2(n + 1)).toFixed(1) : "0";
        ctx.trace.innerHTML =
          `<div style="color:var(--dim)">${n} node(s) · ${reds} red / ${n - reds} black · black height ${blackHeight(T.root)} · height ${height} ≤ 2·log₂(n+1) = ${bound}</div>`;
      };

      ctx.load([snap("A valid red-black tree. Red edges mark links to red nodes.", null, {})]);
    },

    code: {
      exports: ["RedBlack", "RbNode"],
      starter: `// Verify the red-black rules on a tree.
// A null child counts as a black NIL leaf.
class RbNode {
  int key;
  String color;   // "R" or "B"
  RbNode left;
  RbNode right;
  RbNode(int key, String color) {
    this.key = key;
    this.color = color;
  }
}

class RedBlack {
  // Number of black nodes from node down to a NIL leaf, counting the NIL.
  // Return -1 if the two sides disagree (rule 4 is broken).
  static int blackHeight(RbNode node) {
    if (node == null) return 1;
    // recurse on both sides, compare, then add 1 if this node is black
  }

  static boolean isValidRedBlack(RbNode root) {
    // rule 2: the root must be black
    // rule 3: a red node cannot have a red child
    // rule 4: every path has the same black count
  }
}`,
      solution: `class RbNode {
  int key;
  String color;
  RbNode left;
  RbNode right;
  RbNode(int key, String color) {
    this.key = key;
    this.color = color;
  }
}

class RedBlack {
  static int blackHeight(RbNode node) {
    if (node == null) return 1;
    int l = blackHeight(node.left);
    int r = blackHeight(node.right);
    if (l == -1 || r == -1 || l != r) return -1;
    if (node.color.equals("B")) return l + 1;
    return l;
  }

  static boolean isValidRedBlack(RbNode root) {
    if (root == null) return true;
    if (!root.color.equals("B")) return false;
    if (!noRedRed(root)) return false;
    return blackHeight(root) != -1;
  }

  static boolean noRedRed(RbNode n) {
    if (n == null) return true;
    if (n.color.equals("R")) {
      if (n.left != null && n.left.color.equals("R")) return false;
      if (n.right != null && n.right.color.equals("R")) return false;
    }
    return noRedRed(n.left) && noRedRed(n.right);
  }
}`,
      tests: [
        {
          name: "an empty tree and a lone black root are valid",
          run(x, a) {
            a.eq(x.RedBlack.isValidRedBlack(null), true, "empty tree should be");
            a.eq(x.RedBlack.isValidRedBlack(new x.RbNode(1, "B")), true, "single black root should be");
          },
        },
        {
          name: "rule 2: a red root is rejected",
          run(x, a) {
            a.eq(x.RedBlack.isValidRedBlack(new x.RbNode(1, "R")), false, "red root should be");
          },
        },
        {
          name: "rule 3: a red node with a red child is rejected",
          run(x, a) {
            const bad = new x.RbNode(10, "B");
            const mid = new x.RbNode(5, "R");
            mid.left = new x.RbNode(1, "R");
            bad.left = mid;
            a.eq(x.RedBlack.isValidRedBlack(bad), false, "red-with-red-child should be");
          },
        },
        {
          name: "blackHeight counts the NIL leaf",
          run(x, a) {
            a.eq(x.RedBlack.blackHeight(null), 1, "blackHeight(null) should be");
            a.eq(x.RedBlack.blackHeight(new x.RbNode(1, "B")), 2, "blackHeight(black leaf) should be");
          },
        },
        {
          name: "rule 4: unequal black counts are rejected",
          run(x, a) {
            const bad = new x.RbNode(10, "B");
            bad.left = new x.RbNode(5, "B");
            a.eq(x.RedBlack.blackHeight(bad), -1, "mismatched black height should be");
            a.eq(x.RedBlack.isValidRedBlack(bad), false, "the tree should be");
          },
        },
        {
          name: "a correct red-black tree passes every rule",
          run(x, a) {
            const good = new x.RbNode(10, "B");
            good.left = new x.RbNode(5, "R");
            good.right = new x.RbNode(15, "R");
            a.eq(x.RedBlack.isValidRedBlack(good), true, "valid tree should be");
            a.eq(x.RedBlack.blackHeight(good), 2, "black height should be");
          },
        },
      ],
    },

    quiz: [
      {
        q: "You insert a red node and its parent is also red. The <b>uncle is red</b>. What happens?",
        options: [
          "A single left rotation",
          "A double rotation",
          "Recolour parent and uncle black, grandparent red — no rotation",
          "The insert is rejected",
        ],
        answer: 2,
        why: "A red uncle means the whole colour conflict can be pushed up by recolouring; the grandparent then becomes the node to re-check.",
      },
      {
        q: "Why can a red-black path never be more than twice the shortest path?",
        options: [
          "Because the tree is always perfectly balanced",
          "Because every path has the same black count, and reds can never be adjacent",
          "Because rotations happen on every insert",
          "Because the root is black",
        ],
        answer: 1,
        why: "The shortest path is all black; the longest alternates red and black, so it can at most double that black count.",
      },
      {
        q: "What is the main practical advantage of red-black trees over AVL trees?",
        options: [
          "Faster lookups",
          "Less memory per node",
          "Fewer rotations on insert and delete — often only recolouring",
          "They allow duplicate keys",
        ],
        answer: 2,
        why: "AVL is more strictly balanced so it searches slightly faster, but red-black trees mutate far less on writes.",
      },
    ],
  });
})();
