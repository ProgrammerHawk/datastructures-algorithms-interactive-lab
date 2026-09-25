/* Module 4 — Graphs: representations, BFS, DFS, topological sort, Dijkstra, Prim.
 * The demo graphs match the worked examples drawn in the notes. */
(function () {
  const DSA = (window.DSA = window.DSA || {});
  const C = DSA.COLORS;
  const MOD = "Graphs";

  const R = 22, SX = 108, SY = 96;
  const LABEL_FONT = 14, CHAR_W = 0.62;

  /* Long vertex names (the clothing DAG) need a pill instead of a circle. */
  function nodeHalfW(id) {
    return Math.max(R, (String(id).length * CHAR_W * LABEL_FONT) / 2 + 11);
  }

  /* Distance from a node's centre to its outline along (ux, uy).
   * The shape is a stadium: a segment of half-length hw-R swept by a disc of radius R. */
  function boundaryDist(hw, ux, uy) {
    const a = Math.max(0, hw - R);
    if (Math.abs(uy) > 1e-9) {
      const t = R / Math.abs(uy);
      if (t * Math.abs(ux) <= a) return t;
    }
    const b = a * Math.abs(ux);
    return b + Math.sqrt(Math.max(0, b * b - a * a + R * R));
  }

  /* ---- graph rendering ---------------------------------------- */
  function drawGraph(ctx, f, opt) {
    const scene = ctx.scene;
    scene.begin();
    const G = f.graph;
    const nodeAt = {};
    G.vertices.forEach((v) => (nodeAt[v.id] = v));

    G.edges.forEach((e) => {
      const a = nodeAt[e.u], b = nodeAt[e.v];
      const st = (opt.edgeStyle && opt.edgeStyle(e, f)) || {};
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const dA = boundaryDist(nodeHalfW(a.id), ux, uy);
      const dB = boundaryDist(nodeHalfW(b.id), ux, uy) + (G.directed ? 7 : 0);
      const x1 = a.x + ux * dA, y1 = a.y + uy * dA;
      const x2 = b.x - ux * dB, y2 = b.y - uy * dB;

      scene.put(`e-${e.u}-${e.v}`, "path", {
        class: "n-edge",
        d: `M ${x1} ${y1} L ${x2} ${y2}`,
        stroke: st.stroke || "#a8cbb8",
        "stroke-width": st.width || 2,
        "stroke-dasharray": st.dash || null,
        fill: "none",
        "marker-end": G.directed ? (st.hot ? "url(#arwHot)" : "url(#arw)") : null,
        opacity: st.opacity == null ? 1 : st.opacity,
      });

      if (e.w != null) {
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        const nx = -uy, ny = ux;
        scene.put(`ew-${e.u}-${e.v}`, "text", {
          class: "n-label", x: mx + nx * 13, y: my + ny * 13,
          fill: st.labelFill || (st.hot ? C.done : "#5f8570"), "font-size": 12,
        }, e.w);
      }
      if (st.tag) {
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        const nx = -uy, ny = ux;
        scene.put(`et-${e.u}-${e.v}`, "text", {
          class: "n-label", x: mx - nx * 14, y: my - ny * 14,
          fill: st.tagFill || C.purple, "font-size": 10.5,
        }, st.tag);
      }
    });

    G.vertices.forEach((v) => {
      const st = (opt.nodeStyle && opt.nodeStyle(v, f)) || {};
      const hw = nodeHalfW(v.id);
      const shared = {
        fill: st.fill || C.idle, stroke: st.stroke || C.idleLine,
        "stroke-width": st.bold ? 3.2 : 1.8,
      };
      if (hw > R + 0.5) {
        scene.put(`n-${v.id}`, "rect", Object.assign({
          class: "n-slot", x: v.x - hw, y: v.y - R,
          width: hw * 2, height: R * 2, rx: R,
        }, shared));
      } else {
        scene.put(`n-${v.id}`, "circle", Object.assign({
          class: "n-circle", cx: v.x, cy: v.y, r: R,
        }, shared));
      }
      scene.put(`t-${v.id}`, "text", {
        class: "n-label", x: v.x, y: v.y, fill: st.textFill || "#12291f", "font-size": LABEL_FONT,
      }, v.id);
      if (st.badge != null)
        scene.put(`b-${v.id}`, "text", {
          class: "n-label", x: v.x, y: v.y - R - 12,
          fill: st.badgeFill || "#0891b2", "font-size": 11.5,
        }, st.badge);
      if (st.sub != null)
        scene.put(`s-${v.id}`, "text", {
          class: "n-label", x: v.x, y: v.y + R + 13,
          fill: st.subFill || "#7d9a8b", "font-size": 10.5,
        }, st.sub);
    });

    scene.end();
    const lo = G.vertices.map((v) => v.x - nodeHalfW(v.id));
    const hi = G.vertices.map((v) => v.x + nodeHalfW(v.id));
    const ys = G.vertices.map((v) => v.y);
    DSA.fit(ctx.svg, Math.min(...lo), Math.min(...ys) - R - 16,
      Math.max(...hi), Math.max(...ys) + R + 16, 22);
  }

  const key = (u, v) => u + "->" + v;

  function buildAdj(G) {
    const adj = {};
    G.vertices.forEach((v) => (adj[v.id] = []));
    G.edges.forEach((e) => {
      adj[e.u].push({ to: e.v, w: e.w });
      if (!G.directed) adj[e.v].push({ to: e.u, w: e.w });
    });
    Object.keys(adj).forEach((k) => adj[k].sort((a, b) => (a.to < b.to ? -1 : 1)));
    return adj;
  }

  /* ---- the graphs from the notes ------------------------------- */
  // CLRS fig 22.3 — the BFS example (r s t u / v w x y)
  const BFS_GRAPH = {
    directed: false,
    vertices: [
      { id: "r", x: 0, y: 0 }, { id: "s", x: SX, y: 0 }, { id: "t", x: SX * 2, y: 0 }, { id: "u", x: SX * 3, y: 0 },
      { id: "v", x: 0, y: SY }, { id: "w", x: SX, y: SY }, { id: "x", x: SX * 2, y: SY }, { id: "y", x: SX * 3, y: SY },
    ],
    edges: [
      { u: "r", v: "s" }, { u: "r", v: "v" }, { u: "s", v: "w" },
      { u: "t", v: "u" }, { u: "t", v: "w" }, { u: "t", v: "x" },
      { u: "u", v: "x" }, { u: "u", v: "y" }, { u: "w", v: "x" }, { u: "x", v: "y" },
    ],
  };

  // CLRS fig 22.4 — the DFS timestamp example (u v w / x y z)
  const DFS_GRAPH = {
    directed: true,
    vertices: [
      { id: "u", x: 0, y: 0 }, { id: "v", x: SX, y: 0 }, { id: "w", x: SX * 2, y: 0 },
      { id: "x", x: 0, y: SY }, { id: "y", x: SX, y: SY }, { id: "z", x: SX * 2, y: SY },
    ],
    edges: [
      { u: "u", v: "v" }, { u: "u", v: "x" }, { u: "v", v: "y" },
      { u: "y", v: "x" }, { u: "x", v: "v" }, { u: "w", v: "y" }, { u: "w", v: "z" },
    ],
  };

  // CLRS clothing DAG — topological sort
  const TOPO_GRAPH = {
    directed: true,
    vertices: [
      { id: "undershorts", x: 0, y: 0 }, { id: "pants", x: 0, y: SY },
      { id: "belt", x: SX * 1.5, y: SY }, { id: "shirt", x: SX * 1.5, y: 0 },
      { id: "tie", x: SX * 3, y: 0 }, { id: "jacket", x: SX * 3, y: SY },
      { id: "socks", x: SX * 1.5, y: SY * 2 }, { id: "shoes", x: 0, y: SY * 2 },
      { id: "watch", x: SX * 3, y: SY * 2 },
    ],
    edges: [
      { u: "undershorts", v: "pants" }, { u: "undershorts", v: "shoes" },
      { u: "pants", v: "belt" }, { u: "pants", v: "shoes" },
      { u: "belt", v: "jacket" }, { u: "shirt", v: "belt" },
      { u: "shirt", v: "tie" }, { u: "tie", v: "jacket" }, { u: "socks", v: "shoes" },
    ],
  };

  // CLRS fig 24.6 — Dijkstra
  const DIJK_GRAPH = {
    directed: true,
    vertices: [
      { id: "s", x: 0, y: SY }, { id: "t", x: SX * 1.3, y: 0 }, { id: "x", x: SX * 2.6, y: 0 },
      { id: "y", x: SX * 1.3, y: SY * 2 }, { id: "z", x: SX * 2.6, y: SY * 2 },
    ],
    edges: [
      { u: "s", v: "t", w: 10 }, { u: "s", v: "y", w: 5 },
      { u: "t", v: "y", w: 2 }, { u: "t", v: "x", w: 1 },
      { u: "y", v: "t", w: 3 }, { u: "y", v: "x", w: 9 }, { u: "y", v: "z", w: 2 },
      { u: "x", v: "z", w: 4 }, { u: "z", v: "x", w: 6 }, { u: "z", v: "s", w: 7 },
    ],
  };

  // CLRS fig 23.1 — the MST example drawn in the notes
  const MST_GRAPH = {
    directed: false,
    vertices: [
      { id: "a", x: 0, y: SY }, { id: "b", x: SX, y: 0 }, { id: "c", x: SX * 2.4, y: 0 },
      { id: "d", x: SX * 3.7, y: 0 }, { id: "e", x: SX * 4.5, y: SY }, { id: "f", x: SX * 3.7, y: SY * 2 },
      { id: "g", x: SX * 2.4, y: SY * 2 }, { id: "h", x: SX, y: SY * 2 }, { id: "i", x: SX * 1.9, y: SY },
    ],
    edges: [
      { u: "a", v: "b", w: 4 }, { u: "a", v: "h", w: 8 }, { u: "b", v: "h", w: 11 },
      { u: "b", v: "c", w: 8 }, { u: "h", v: "i", w: 7 }, { u: "h", v: "g", w: 1 },
      { u: "i", v: "c", w: 2 }, { u: "i", v: "g", w: 6 }, { u: "g", v: "f", w: 2 },
      { u: "c", v: "d", w: 7 }, { u: "c", v: "f", w: 4 }, { u: "d", v: "f", w: 14 },
      { u: "d", v: "e", w: 9 }, { u: "e", v: "f", w: 10 },
    ],
  };

  /* ================================================================
   * 4.1 REPRESENTATIONS
   * ============================================================== */
  DSA.lesson({
    id: "graph-repr",
    module: MOD,
    title: "Representing a graph",
    blurb:
      "Adjacency list or adjacency matrix. The choice decides whether your algorithms cost O(V + E) or O(V²).",
    tags: ["adjacency list", "adjacency matrix", "sparse vs dense"],
    notes: `
      <h4>Adjacency list</h4>
      <p>An <b>array of lists</b>. Each array slot is a vertex, and its list holds every vertex
      adjacent to it — exactly as drawn in the notes.</p>
      <ul>
        <li>Space: <code>O(V + E)</code> — proportional to what actually exists.</li>
        <li>"List all neighbours of v": <code>O(degree(v))</code>, which is optimal.</li>
        <li>"Is u adjacent to v?": <code>O(degree(u))</code> — you must scan.</li>
      </ul>
      <h4>Adjacency matrix</h4>
      <p>A <code>V × V</code> grid where <code>A[i][j] = 1</code> when an edge exists.</p>
      <ul>
        <li>Space: <code>O(V²)</code> regardless of edge count.</li>
        <li>"Is u adjacent to v?": <code>O(1)</code> — a single lookup.</li>
        <li>"List all neighbours of v": <code>O(V)</code>, even if it has one neighbour.</li>
      </ul>
      <div class="callout">Undirected graphs give a <b>symmetric</b> matrix — <code>A[i][j] = A[j][i]</code>.
      For directed graphs the notes suggest using <code>1</code> and <code>−1</code> to encode direction.</div>
      <h4>Which to use</h4>
      <p><b>Sparse</b> graphs (<code>E ≈ V</code>) — road networks, social graphs — want lists. A matrix
      would be almost entirely zeros. <b>Dense</b> graphs (<code>E ≈ V²</code>) or algorithms that
      constantly ask "is there an edge here?" favour the matrix.</p>
      <div class="callout warn">This choice propagates. BFS and DFS are <code>O(V + E)</code> on an
      adjacency list but <code>O(V²)</code> on a matrix, because every neighbour scan costs a full row.</div>
      <h4>Vocabulary</h4>
      <ul>
        <li><b>Directed</b> — edges have direction; <b>undirected</b> — they do not.</li>
        <li><b>Degree</b> — number of incident edges. Directed graphs split this into in-degree and out-degree.</li>
        <li><b>Weighted</b> — each edge carries a cost.</li>
      </ul>`,
    complexity: [
      ["Operation", "List", "Matrix"],
      ["space", "O(V + E)", "O(V²)"],
      ["is u~v?", "O(deg u)", "O(1)"],
      ["neighbours of v", "O(deg v)", "O(V)"],
      ["add edge", "O(1)", "O(1)"],
      ["BFS / DFS", "O(V + E)", "O(V²)"],
    ],
    pseudo: [
      "// Adjacency list — array of lists",
      "1 -> 2 -> 3",
      "2 -> 1 -> 3 -> 4 -> 5",
      "3 -> 1 -> 2 -> 4",
      "4 -> 3 -> 2 -> 5",
      "5 -> 2 -> 4",
      "",
      "// Adjacency matrix — 1 = edge, 0 = none",
      "    1  2  3  4  5",
      "1 [ 0  1  1  0  0 ]",
      "2 [ 1  0  1  1  1 ]",
      "3 [ 1  1  0  1  0 ]",
      "4 [ 0  1  1  0  1 ]",
      "5 [ 0  1  0  1  0 ]",
    ],
    legend: [
      { color: C.idle, label: "vertex" },
      { color: C.visit, label: "selected vertex" },
      { color: C.done, label: "its neighbours" },
    ],

    mount(ctx) {
      DSA.ensureDefs(ctx.svg);
      // the 5-vertex graph drawn on page 1 of the notes
      const G = {
        directed: false,
        vertices: [
          { id: "1", x: 0, y: 0 }, { id: "2", x: SX * 1.4, y: 0 },
          { id: "5", x: SX * 2.5, y: SY * 0.55 },
          { id: "3", x: 0, y: SY * 1.2 }, { id: "4", x: SX * 1.4, y: SY * 1.2 },
        ],
        edges: [
          { u: "1", v: "2" }, { u: "1", v: "3" }, { u: "2", v: "3" },
          { u: "2", v: "4" }, { u: "2", v: "5" }, { u: "3", v: "4" }, { u: "4", v: "5" },
        ],
      };
      const order = ["1", "2", "3", "4", "5"];
      const adj = buildAdj(G);
      let selected = null;

      DSA.controls(ctx.controls, [
        { type: "text", label: "Highlight a vertex:" },
        ...order.map((v) => ({
          type: "button", label: v,
          onClick: () => {
            selected = v;
            ctx.load([{
              graph: G, sel: v,
              msg: `Vertex <b>${v}</b> has degree <b>${adj[v].length}</b>. Its adjacency list is <b>${adj[v].map((a) => a.to).join(" → ")}</b>, and row ${v} of the matrix has a 1 in each of those columns.`,
              line: order.indexOf(v) + 1,
            }]);
          },
        })),
        { type: "button", label: "Clear", onClick: () => { selected = null; ctx.load([{ graph: G, sel: null, msg: "Pick a vertex to see its list and matrix row.", line: null }]); } },
      ]);

      ctx.render = function (f) {
        const sel = f.sel;
        const nbrs = sel ? adj[sel].map((a) => a.to) : [];
        drawGraph(ctx, f, {
          nodeStyle: (v) => {
            if (v.id === sel) return { fill: "#d2eef8", stroke: C.visit, bold: true, badge: `deg ${adj[v.id].length}`, badgeFill: C.visit };
            if (nbrs.indexOf(v.id) >= 0) return { fill: "#cdf0df", stroke: C.done };
            return {};
          },
          edgeStyle: (e) => {
            const on = sel && (e.u === sel || e.v === sel);
            return on ? { stroke: C.done, width: 3.2, hot: true } : { opacity: sel ? 0.3 : 1 };
          },
        });

        // matrix + list side panel
        let html = '<div style="display:flex;gap:26px;flex-wrap:wrap">';
        html += '<div><div style="color:var(--dim);margin-bottom:5px">Adjacency list</div>';
        order.forEach((v) => {
          const hot = v === sel;
          html += `<div style="${hot ? "color:var(--accent-2);font-weight:700" : ""}">${v} → ${adj[v].map((a) => a.to).join(" → ") || "∅"}</div>`;
        });
        html += "</div>";
        html += '<div><div style="color:var(--dim);margin-bottom:5px">Adjacency matrix</div>';
        html += '<table style="border:0"><tr><th style="border:0"></th>' + order.map((c) => `<th style="border:0;text-align:center">${c}</th>`).join("") + "</tr>";
        order.forEach((r) => {
          const rowHot = r === sel;
          html += `<tr><th style="border:0;color:${rowHot ? "var(--accent-2)" : "var(--dim)"}">${r}</th>`;
          order.forEach((c) => {
            const has = adj[r].some((a) => a.to === c);
            const cellHot = rowHot && has;
            html += `<td style="border:0;text-align:center;color:${cellHot ? "var(--ok)" : has ? "#1f3a2c" : "#9ab3a6"};font-weight:${cellHot ? 700 : 400}">${has ? 1 : 0}</td>`;
          });
          html += "</tr>";
        });
        html += "</table></div></div>";
        ctx.trace.innerHTML = html;
      };

      ctx.load([{ graph: G, sel: null, msg: "The 5-vertex graph from the notes. Pick a vertex to compare both representations.", line: null }]);
    },

    code: {
      exports: ["Graph"],
      starter: `// Undirected graph stored as an adjacency list.
class Graph {
  HashMap<String, ArrayList<String>> adj = new HashMap<>();

  void addVertex(String v) {
    // create an empty neighbour list if v is new
  }

  void addEdge(String u, String v) {
    // undirected: record the edge in BOTH directions
  }

  ArrayList<String> neighbors(String v) {
    // return the neighbour list (an empty list if v is unknown)
  }

  boolean hasEdge(String u, String v) {
    // true / false
  }

  int degree(String v) {
    // number of incident edges
  }

  int[][] toMatrix(ArrayList<String> order) {
    // order lists the vertex names; return a 2D array of 0/1
  }
}`,
      solution: `class Graph {
  HashMap<String, ArrayList<String>> adj = new HashMap<>();

  void addVertex(String v) {
    if (!adj.containsKey(v)) adj.put(v, new ArrayList<>());
  }

  void addEdge(String u, String v) {
    addVertex(u);
    addVertex(v);
    if (!adj.get(u).contains(v)) adj.get(u).add(v);
    if (!adj.get(v).contains(u)) adj.get(v).add(u);
  }

  ArrayList<String> neighbors(String v) {
    if (!adj.containsKey(v)) return new ArrayList<>();
    return adj.get(v);
  }

  boolean hasEdge(String u, String v) {
    return neighbors(u).contains(v);
  }

  int degree(String v) {
    return neighbors(v).size();
  }

  int[][] toMatrix(ArrayList<String> order) {
    int n = order.size();
    int[][] m = new int[n][n];
    for (int i = 0; i < n; i++) {
      for (int j = 0; j < n; j++) {
        if (hasEdge(order.get(i), order.get(j))) m[i][j] = 1;
      }
    }
    return m;
  }
}`,
      tests: [
        {
          name: "addEdge records the edge in both directions",
          run(x, a) {
            const g = new x.Graph();
            g.addEdge("1", "2");
            a.eq(g.hasEdge("1", "2"), true, "hasEdge(1,2) should be");
            a.eq(g.hasEdge("2", "1"), true, "hasEdge(2,1) should be");
          },
        },
        {
          name: "degree counts incident edges",
          run(x, a) {
            const g = new x.Graph();
            g.addEdge("2", "1"); g.addEdge("2", "3"); g.addEdge("2", "4");
            a.eq(g.degree("2"), 3, "degree(2) should be");
            a.eq(g.degree("1"), 1, "degree(1) should be");
          },
        },
        {
          name: "unknown vertices are handled safely",
          run(x, a) {
            const g = new x.Graph();
            a.eq(g.neighbors("zz"), [], "neighbors of an unknown vertex should be");
            a.eq(g.hasEdge("a", "b"), false, "hasEdge on unknowns should be");
          },
        },
        {
          name: "the matrix matches the notes' example graph",
          run(x, a) {
            const g = new x.Graph();
            [["1", "2"], ["1", "3"], ["2", "3"], ["2", "4"], ["2", "5"], ["3", "4"], ["4", "5"]]
              .forEach(([u, v]) => g.addEdge(u, v));
            a.eq(g.toMatrix(["1", "2", "3", "4", "5"]), [
              [0, 1, 1, 0, 0],
              [1, 0, 1, 1, 1],
              [1, 1, 0, 1, 0],
              [0, 1, 1, 0, 1],
              [0, 1, 0, 1, 0],
            ], "matrix should be");
          },
        },
        {
          name: "an undirected matrix is symmetric",
          run(x, a) {
            const g = new x.Graph();
            g.addEdge("a", "b"); g.addEdge("b", "c");
            const m = g.toMatrix(["a", "b", "c"]);
            for (let i = 0; i < 3; i++)
              for (let j = 0; j < 3; j++)
                a.eq(m[i][j], m[j][i], `matrix should be symmetric at [${i}][${j}] —`);
          },
        },
        {
          name: "duplicate edges are not double-counted",
          run(x, a) {
            const g = new x.Graph();
            g.addEdge("a", "b"); g.addEdge("a", "b");
            a.eq(g.degree("a"), 1, "degree after a duplicate addEdge should be");
          },
        },
      ],
    },

    quiz: [
      {
        q: "You have 1,000,000 vertices and about 3,000,000 edges. Which representation?",
        options: [
          "Adjacency matrix — O(1) edge lookup",
          "Adjacency list — the matrix would need 10¹² cells, almost all zero",
          "Either, they use the same memory",
          "Neither works for graphs this size",
        ],
        answer: 1,
        why: "This is a sparse graph. The list uses O(V + E) ≈ 4 million entries; the matrix would need a trillion.",
      },
      {
        q: "Why is BFS O(V²) on an adjacency matrix but O(V + E) on a list?",
        options: [
          "The matrix version visits vertices twice",
          "Finding the neighbours of a vertex means scanning a whole row of V cells",
          "Matrices cannot store weights",
          "The queue behaves differently",
        ],
        answer: 1,
        why: "Each of the V dequeues triggers a full V-cell row scan, giving V² regardless of how few edges exist.",
      },
      {
        q: "What tells you an adjacency matrix belongs to an undirected graph?",
        options: [
          "It contains only zeros and ones",
          "It is symmetric across the main diagonal",
          "Its diagonal is all ones",
          "Every row sums to the same value",
        ],
        answer: 1,
        why: "An undirected edge u–v sets both A[u][v] and A[v][u], so the matrix mirrors across the diagonal.",
      },
    ],
  });

  /* ================================================================
   * 4.2 BFS
   * ============================================================== */
  DSA.lesson({
    id: "bfs",
    module: MOD,
    title: "Breadth-first search",
    blurb:
      "Explore every vertex at distance d before touching distance d + 1. That level order is what makes BFS find shortest paths.",
    tags: ["queue driven", "O(V + E)", "shortest path (unweighted)"],
    notes: `
      <h4>What BFS gives you</h4>
      <p>Straight from the notes:</p>
      <ol>
        <li>Works on <b>directed and undirected</b> graphs.</li>
        <li>Given a source vertex, finds <b>all vertices reachable</b> from it.</li>
        <li>Finds the <b>shortest path</b> from the source to any vertex (unweighted).</li>
        <li>Called <i>breadth</i>-first because it explores <b>all nodes at one level before moving
        to the next</b>.</li>
      </ol>
      <h4>The three colours</h4>
      <ul>
        <li><b>White</b> — undiscovered.</li>
        <li><b>Grey</b> — discovered, sitting in the queue; the frontier.</li>
        <li><b>Black</b> — finished, all its neighbours have been examined.</li>
      </ul>
      <h4>Per-vertex bookkeeping</h4>
      <ul>
        <li><code>v.d</code> — distance from the source in edges (starts at <code>∞</code>).</li>
        <li><code>v.π</code> — the predecessor, which reconstructs the actual path.</li>
      </ul>
      <div class="callout">Every vertex is enqueued <b>exactly once</b>, which is why the first time
      you reach a vertex is guaranteed to be along a shortest path. That is also why the colour check
      before enqueueing matters so much.</div>
      <h4>Cost</h4>
      <p>Each vertex is enqueued and dequeued once — <code>O(V)</code>. Each adjacency list is scanned
      once — <code>O(E)</code>. Total <code>O(V + E)</code>.</p>`,
    complexity: [
      ["Aspect", "Cost", "Why"],
      ["time", "O(V + E)", "each vertex + each edge once"],
      ["space", "O(V)", "queue, colours, d, π"],
      ["shortest path", "yes", "unweighted graphs only"],
      ["weighted graphs", "no", "use Dijkstra"],
    ],
    pseudo: [
      "BFS(G, s)",
      "  for all v in G",
      "      v.color = WHITE;  v.d = INF;  v.p = NIL",
      "  s.d = 0;  s.color = GRAY",
      "  Q.enqueue(s)",
      "  while Q is not empty",
      "      u = Q.dequeue()",
      "      for all v in adj(u)",
      "          if v.color == WHITE",
      "              v.color = GRAY",
      "              v.p = u",
      "              v.d = u.d + 1",
      "              Q.enqueue(v)",
      "      u.color = BLACK",
    ],
    legend: [
      { color: "#f1f7f3", label: "white — undiscovered" },
      { color: "#87a596", label: "grey — in the queue" },
      { color: "#cfeaf1", label: "black — finished" },
      { color: C.visit, label: "u — being processed" },
      { color: C.done, label: "just discovered" },
    ],

    mount(ctx) {
      DSA.ensureDefs(ctx.svg);
      const G = BFS_GRAPH;
      const adj = buildAdj(G);
      let source = "s";

      DSA.controls(ctx.controls, [
        {
          type: "select", name: "src", label: "source", value: "s",
          options: G.vertices.map((v) => ({ value: v.id, label: v.id })),
          onChange: (r) => { source = r.src.value; run(); },
        },
        { type: "button", label: "Run BFS", onClick: () => run(true) },
        { type: "button", label: "Reset", onClick: () => ctx.load([base()]) },
      ]);

      function base() {
        const color = {}, d = {}, p = {};
        G.vertices.forEach((v) => { color[v.id] = "W"; d[v.id] = Infinity; p[v.id] = null; });
        return { graph: G, color, d, p, queue: [], msg: `Press <b>Run BFS</b> to explore from <b>${source}</b>.`, line: null, opts: {} };
      }

      function run(autoplay) {
        const color = {}, d = {}, p = {};
        G.vertices.forEach((v) => { color[v.id] = "W"; d[v.id] = Infinity; p[v.id] = null; });
        const F = [];
        const snap = (msg, line, opts) => F.push({
          graph: G, color: Object.assign({}, color), d: Object.assign({}, d), p: Object.assign({}, p),
          queue: Q.slice(), msg, line, opts: opts || {},
        });

        const Q = [];
        snap(`Initialise: every vertex WHITE, <b>d = ∞</b>, <b>π = NIL</b>.`, 2, {});
        d[source] = 0; color[source] = "G"; Q.push(source);
        snap(`Source <b>${source}</b>: d = 0, colour GREY, enqueue it.`, 4, { hot: source });

        while (Q.length) {
          const u = Q.shift();
          snap(`Dequeue <b>${u}</b> (d = ${d[u]}). Examine its neighbours.`, 6, { active: u });
          adj[u].forEach((e) => {
            const v = e.to;
            if (color[v] === "W") {
              color[v] = "G"; p[v] = u; d[v] = d[u] + 1; Q.push(v);
              snap(`<b>${v}</b> is WHITE → discover it. d[${v}] = d[${u}] + 1 = <b>${d[v]}</b>, π[${v}] = ${u}. Enqueue.`,
                12, { active: u, found: v, edge: key(u, v) });
            } else {
              snap(`<b>${v}</b> is already ${color[v] === "G" ? "GREY" : "BLACK"} — skip, it has a shorter or equal distance.`,
                8, { active: u, skip: v, edge: key(u, v) });
            }
          });
          color[u] = "B";
          snap(`All neighbours of <b>${u}</b> examined → colour it BLACK.`, 13, { done: u });
        }

        const reach = Object.keys(d).filter((k) => d[k] < Infinity);
        snap(`Queue is empty. Reached <b>${reach.length}/${G.vertices.length}</b> vertices. Every <b>d</b> is a shortest-path distance from <b>${source}</b>.`, null, {});
        ctx.load(F, { autoplay: autoplay });
      }

      ctx.render = function (f) {
        drawGraph(ctx, f, {
          nodeStyle: (v) => {
            const o = f.opts, c = f.color[v.id];
            const st = {
              badge: f.d[v.id] === Infinity ? "∞" : "d=" + f.d[v.id],
              badgeFill: f.d[v.id] === Infinity ? "#9ab3a6" : C.visit,
              sub: f.p[v.id] ? "π=" + f.p[v.id] : null,
            };
            if (c === "W") { st.fill = "#f1f7f3"; st.stroke = "#c3ddcd"; }
            else if (c === "G") { st.fill = "#e3ece7"; st.stroke = "#87a596"; }
            else { st.fill = "#cfeaf1"; st.stroke = "#0e7490"; }
            if (o.skip === v.id) { st.stroke = C.warn; st.bold = true; }
            if (o.found === v.id) { st.fill = "#cdf0df"; st.stroke = C.done; st.bold = true; }
            if (o.active === v.id) { st.fill = "#d2eef8"; st.stroke = C.visit; st.bold = true; st.tag = "u"; }
            if (o.hot === v.id) { st.stroke = C.done; st.bold = true; }
            return st;
          },
          edgeStyle: (e) => {
            const o = f.opts;
            const isTree = f.p[e.v] === e.u || f.p[e.u] === e.v;
            if (o.edge === key(e.u, e.v) || o.edge === key(e.v, e.u))
              return { stroke: C.visit, width: 3.4, hot: true };
            if (isTree) return { stroke: C.done, width: 3 };
            return { opacity: 0.55 };
          },
        });

        const rows = f.graph.vertices.map((v) => [
          v.id,
          f.d[v.id] === Infinity ? "∞" : f.d[v.id],
          f.p[v.id] || "NIL",
          f.color[v.id] === "W" ? "white" : f.color[v.id] === "G" ? "grey" : "black",
        ]);
        ctx.trace.innerHTML = DSA.chips("queue (front → back):", f.queue, "empty");
        const t = document.createElement("div");
        DSA.traceTable(t, ["v", "d", "π", "colour"], rows);
        ctx.trace.appendChild(t);
      };

      ctx.load([base()]);
    },

    code: {
      exports: ["Bfs"],
      starter: `// adj maps a vertex to its neighbour list.
// dist  = edges from the source (unreachable vertices are left out)
// parent = predecessor of each vertex (null for the source)
// order  = vertices in the order they were dequeued
class BfsResult {
  HashMap<String, Integer> dist = new HashMap<>();
  HashMap<String, String> parent = new HashMap<>();
  ArrayList<String> order = new ArrayList<>();
}

class Bfs {
  static BfsResult bfs(HashMap<String, ArrayList<String>> adj, String source) {
    BfsResult res = new BfsResult();
    ArrayList<String> queue = new ArrayList<>();
    int head = 0;

    // seed the source, then loop while the queue has items.
    // only enqueue a neighbour the FIRST time you see it.

    return res;
  }
}`,
      solution: `class BfsResult {
  HashMap<String, Integer> dist = new HashMap<>();
  HashMap<String, String> parent = new HashMap<>();
  ArrayList<String> order = new ArrayList<>();
}

class Bfs {
  static BfsResult bfs(HashMap<String, ArrayList<String>> adj, String source) {
    BfsResult res = new BfsResult();
    ArrayList<String> queue = new ArrayList<>();
    int head = 0;

    res.dist.put(source, 0);
    res.parent.put(source, null);
    queue.add(source);

    while (head < queue.size()) {
      String u = queue.get(head);
      head = head + 1;
      res.order.add(u);

      ArrayList<String> nbrs = adj.get(u);
      if (nbrs == null) continue;
      for (String v : nbrs) {
        if (!res.dist.containsKey(v)) {
          res.dist.put(v, res.dist.get(u) + 1);
          res.parent.put(v, u);
          queue.add(v);
        }
      }
    }
    return res;
  }
}`,
      tests: [
        {
          name: "distances on a simple chain",
          run(x, a) {
            const adj = { a: ["b"], b: ["a", "c"], c: ["b", "d"], d: ["c"] };
            a.eq(x.Bfs.bfs(adj, "a").dist, { a: 0, b: 1, c: 2, d: 3 }, "dist should be");
          },
        },
        {
          name: "explores level by level",
          run(x, a) {
            const adj = { a: ["b", "c"], b: ["a", "d"], c: ["a", "d"], d: ["b", "c"] };
            a.eq(x.Bfs.bfs(adj, "a").order, ["a", "b", "c", "d"], "dequeue order should be");
          },
        },
        {
          name: "parent pointers rebuild a shortest path",
          run(x, a) {
            const adj = { a: ["b"], b: ["a", "c"], c: ["b"] };
            const parent = x.Bfs.bfs(adj, "a").parent;
            a.eq(parent.a, null, "parent of the source should be");
            a.eq(parent.c, "b", "parent of c should be");
          },
        },
        {
          name: "unreachable vertices get no distance",
          run(x, a) {
            const adj = { a: ["b"], b: ["a"], z: [] };
            const dist = x.Bfs.bfs(adj, "a").dist;
            a.eq("z" in dist, false, "z should not appear in dist —");
          },
        },
        {
          name: "matches the notes' graph: BFS from s",
          run(x, a) {
            const adj = {
              r: ["s", "v"], s: ["r", "w"], t: ["u", "w", "x"], u: ["t", "x", "y"],
              v: ["r"], w: ["s", "t", "x"], x: ["t", "u", "w", "y"], y: ["u", "x"],
            };
            a.eq(x.Bfs.bfs(adj, "s").dist,
              { s: 0, r: 1, w: 1, v: 2, t: 2, x: 2, u: 3, y: 3 },
              "distances from s should be");
          },
        },
        {
          name: "a cycle does not cause an infinite loop",
          run(x, a) {
            const adj = { a: ["b"], b: ["c"], c: ["a"] };
            a.eq(x.Bfs.bfs(adj, "a").order.length, 3, "visited count should be");
          },
        },
      ],
    },

    quiz: [
      {
        q: "In the notes' graph, BFS from <b>s</b> gives d[u] = ?",
        options: ["1", "2", "3", "unreachable"],
        answer: 2,
        why: "s → w (1) → t or x (2) → u (3). No shorter route exists.",
      },
      {
        q: "Why does BFS check the colour before enqueueing a neighbour?",
        options: [
          "To save memory",
          "So each vertex is enqueued once — the first discovery is already along a shortest path",
          "To keep the queue sorted",
          "To detect cycles",
        ],
        answer: 1,
        why: "Re-enqueueing would both loop forever on cycles and overwrite a correct shorter distance with a longer one.",
      },
      {
        q: "Why can't plain BFS find shortest paths in a weighted graph?",
        options: [
          "It cannot store weights",
          "It counts edges, so 3 cheap edges look worse than 1 expensive edge",
          "The queue overflows",
          "It only works on trees",
        ],
        answer: 1,
        why: "BFS optimises hop count, not total weight. Dijkstra's priority queue is what fixes that.",
      },
    ],
  });

  /* ================================================================
   * 4.3 DFS
   * ============================================================== */
  DSA.lesson({
    id: "dfs",
    module: MOD,
    title: "Depth-first search & edge classification",
    blurb:
      "Dive to the deepest point, then backtrack. Discovery/finish timestamps expose the whole structure of the graph.",
    tags: ["timestamps d/f", "tree / back / forward / cross", "cycle detection"],
    notes: `
      <h4>How it moves</h4>
      <p>From the notes: DFS <i>searches from a vertex to the leaf, backtracking to the previous, to
      all its leaves, and so on</i>. It grows a <b>forest</b> of trees — one tree if you start from a
      given source, possibly several when run over the whole graph.</p>
      <h4>Timestamps</h4>
      <p>Each vertex gets two:</p>
      <ul>
        <li><code>v.d</code> — <b>discovery</b> time, when it turns grey.</li>
        <li><code>v.f</code> — <b>finish</b> time, when all its descendants are done and it turns black.</li>
      </ul>
      <div class="callout"><b>Parenthesis theorem:</b> the intervals <code>[d, f]</code> either nest
      completely or are disjoint — they never partially overlap. If <code>[d_v, f_v]</code> sits inside
      <code>[d_u, f_u]</code>, then <code>v</code> is a descendant of <code>u</code>.</div>
      <h4>The four edge types</h4>
      <ul>
        <li><b>Tree edge</b> — leads to an undiscovered (white) vertex; part of the DFS forest.</li>
        <li><b>Back edge</b> — points to a <b>grey</b> ancestor. This is a <b>cycle</b>.</li>
        <li><b>Forward edge</b> — ancestor to descendant, but not a tree edge.</li>
        <li><b>Cross edge</b> — everything else: between subtrees or between different trees.</li>
      </ul>
      <div class="callout warn">A directed graph is <b>acyclic if and only if DFS finds no back edge</b>.
      That single fact powers cycle detection and topological sorting.</div>
      <h4>Cost</h4>
      <p><code>O(V + E)</code> — the same as BFS. Each vertex is visited once and each adjacency list
      is scanned once.</p>`,
    complexity: [
      ["Aspect", "Cost", "Note"],
      ["time", "O(V + E)", "same as BFS"],
      ["space", "O(V)", "recursion depth"],
      ["cycle detection", "O(V + E)", "look for a back edge"],
      ["topological sort", "O(V + E)", "order by finish time"],
    ],
    pseudo: [
      "DFS(G)",
      "  for all u in G:  u.color = WHITE;  u.p = NIL",
      "  time = 0",
      "  for all u in G",
      "      if u.color == WHITE",
      "          DFS-VISIT(G, u)",
      "",
      "DFS-VISIT(G, u)",
      "  time = time + 1",
      "  u.d = time;  u.color = GRAY",
      "  for all v in adj(u)",
      "      if v.color == WHITE      // tree edge",
      "          v.p = u",
      "          DFS-VISIT(G, v)",
      "      else if v.color == GRAY  // back edge -> CYCLE",
      "          record back edge",
      "  u.color = BLACK",
      "  time = time + 1",
      "  u.f = time",
    ],
    legend: [
      { color: "#f1f7f3", label: "white" },
      { color: "#87a596", label: "grey — on the stack" },
      { color: "#cfeaf1", label: "black — finished" },
      { color: C.done, label: "tree edge" },
      { color: C.bad, label: "back edge (cycle)" },
      { color: C.purple, label: "forward / cross" },
    ],

    mount(ctx) {
      DSA.ensureDefs(ctx.svg);
      const G = DFS_GRAPH;
      const adj = buildAdj(G);

      DSA.controls(ctx.controls, [
        { type: "button", label: "Run DFS", onClick: () => run(true) },
        { type: "button", label: "Reset", onClick: () => ctx.load([base()]) },
      ]);

      function base() {
        const color = {}, d = {}, fin = {}, p = {};
        G.vertices.forEach((v) => { color[v.id] = "W"; d[v.id] = null; fin[v.id] = null; p[v.id] = null; });
        return { graph: G, color, d, fin, p, cls: {}, stack: [], msg: "Press <b>Run DFS</b> to walk the graph and timestamp every vertex.", line: null, opts: {} };
      }

      function run(autoplay) {
        const color = {}, d = {}, fin = {}, p = {}, cls = {};
        G.vertices.forEach((v) => { color[v.id] = "W"; d[v.id] = null; fin[v.id] = null; p[v.id] = null; });
        const F = [];
        const stack = [];
        let time = 0;
        const snap = (msg, line, opts) => F.push({
          graph: G, color: Object.assign({}, color), d: Object.assign({}, d),
          fin: Object.assign({}, fin), p: Object.assign({}, p), cls: Object.assign({}, cls),
          stack: stack.slice(), msg, line, opts: opts || {},
        });

        snap("Every vertex starts WHITE with no timestamps.", 1, {});

        function visit(u) {
          time++; d[u] = time; color[u] = "G"; stack.push(u);
          snap(`Discover <b>${u}</b> at time <b>${time}</b> — colour GREY, push onto the stack.`, 9, { active: u });
          adj[u].forEach((e) => {
            const v = e.to;
            if (color[v] === "W") {
              cls[key(u, v)] = "tree";
              p[v] = u;
              snap(`<b>${u} → ${v}</b>: ${v} is WHITE, so this is a <b>TREE edge</b>. Recurse.`, 11, { active: u, edge: key(u, v) });
              visit(v);
              snap(`Back at <b>${u}</b> after finishing ${v}.`, 13, { active: u });
            } else if (color[v] === "G") {
              cls[key(u, v)] = "back";
              snap(`<b>${u} → ${v}</b>: ${v} is GREY (an ancestor still on the stack) → <b>BACK edge</b>. This proves a <b>cycle</b>.`,
                14, { active: u, edge: key(u, v), warn: true });
            } else {
              const type = d[u] < d[v] ? "forward" : "cross";
              cls[key(u, v)] = type;
              snap(`<b>${u} → ${v}</b>: ${v} is BLACK. d[${u}]=${d[u]} ${d[u] < d[v] ? "&lt;" : "&gt;"} d[${v}]=${d[v]} → <b>${type.toUpperCase()} edge</b>.`,
                15, { active: u, edge: key(u, v) });
            }
          });
          color[u] = "B"; time++; fin[u] = time; stack.pop();
          snap(`<b>${u}</b> has no unexplored neighbours left → BLACK, finish time <b>${time}</b>. Interval [${d[u]}, ${fin[u]}].`, 18, { done: u });
        }

        G.vertices.forEach((v) => {
          if (color[v.id] === "W") {
            snap(`<b>${v.id}</b> is still WHITE — start a new tree in the DFS forest.`, 4, { hot: v.id });
            visit(v.id);
          }
        });

        const backs = Object.keys(cls).filter((k) => cls[k] === "back");
        snap(`Done. ${backs.length ? `Found <b>${backs.length}</b> back edge(s) — the graph <b>has a cycle</b>.` : "No back edges — the graph is <b>acyclic</b>."} Every vertex carries its [d, f] interval.`, null, {});
        ctx.load(F, { autoplay: autoplay });
      }

      const EDGE_COLOR = { tree: C.done, back: C.bad, forward: C.purple, cross: C.purple };

      ctx.render = function (f) {
        drawGraph(ctx, f, {
          nodeStyle: (v) => {
            const o = f.opts, c = f.color[v.id];
            const st = {
              badge: f.d[v.id] ? `${f.d[v.id]}/${f.fin[v.id] || "…"}` : null,
              badgeFill: f.fin[v.id] ? C.done : C.visit,
            };
            if (c === "W") { st.fill = "#f1f7f3"; st.stroke = "#c3ddcd"; }
            else if (c === "G") { st.fill = "#e3ece7"; st.stroke = "#87a596"; }
            else { st.fill = "#cfeaf1"; st.stroke = "#0e7490"; }
            if (o.active === v.id) { st.fill = "#d2eef8"; st.stroke = C.visit; st.bold = true; st.tag = "u"; }
            if (o.done === v.id) { st.stroke = C.done; st.bold = true; }
            if (o.hot === v.id) { st.stroke = C.warn; st.bold = true; st.tag = "new root"; st.tagFill = C.warn; }
            return st;
          },
          edgeStyle: (e) => {
            const o = f.opts, k = key(e.u, e.v), t = f.cls[k];
            const st = {};
            if (t) { st.stroke = EDGE_COLOR[t]; st.width = t === "tree" ? 3.2 : 2.4; st.tag = t; st.tagFill = EDGE_COLOR[t]; if (t !== "tree") st.dash = "6 4"; }
            else { st.opacity = 0.45; }
            if (o.edge === k) { st.stroke = o.warn ? C.bad : C.visit; st.width = 4; st.hot = true; }
            return st;
          },
        });

        const rows = f.graph.vertices.map((v) => [
          v.id, f.d[v.id] || "—", f.fin[v.id] || "—", f.p[v.id] || "NIL",
        ]);
        ctx.trace.innerHTML = DSA.chips("recursion stack:", f.stack, "empty");
        const t = document.createElement("div");
        DSA.traceTable(t, ["v", "d", "f", "π"], rows);
        ctx.trace.appendChild(t);
        const counts = {};
        Object.values(f.cls).forEach((c) => (counts[c] = (counts[c] || 0) + 1));
        const summary = Object.keys(counts).map((c) => `${c}: ${counts[c]}`).join(" · ");
        if (summary) ctx.trace.appendChild(DSA.el("div", { class: "", text: summary, style: "color:var(--dim);margin-top:5px" }));
      };

      ctx.load([base()]);
    },

    code: {
      exports: ["Dfs"],
      starter: `// adj maps a vertex to its out-neighbours (a DIRECTED graph).
class DfsResult {
  HashMap<String, Integer> disc = new HashMap<>();
  HashMap<String, Integer> finish = new HashMap<>();
  ArrayList<String> order = new ArrayList<>();   // finish order
}

class Dfs {
  private HashMap<String, ArrayList<String>> adj;
  private HashMap<String, String> color = new HashMap<>();
  private DfsResult res = new DfsResult();
  private int time = 0;
  private boolean cycle = false;

  static DfsResult dfs(HashMap<String, ArrayList<String>> adj, ArrayList<String> vertices) {
    Dfs d = new Dfs();
    d.adj = adj;
    for (String v : vertices) d.color.put(v, "W");
    for (String v : vertices) {
      if (d.color.get(v).equals("W")) d.visit(v);
    }
    return d.res;
  }

  void visit(String u) {
    // stamp discovery, recurse into WHITE neighbours,
    // set cycle = true when you meet a GREY neighbour (a back edge),
    // then stamp finish and append u to res.order
  }

  // A directed graph has a cycle exactly when DFS finds a back edge.
  static boolean hasCycle(HashMap<String, ArrayList<String>> adj, ArrayList<String> vertices) {
    Dfs d = new Dfs();
    d.adj = adj;
    for (String v : vertices) d.color.put(v, "W");
    for (String v : vertices) {
      if (d.color.get(v).equals("W")) d.visit(v);
    }
    return d.cycle;
  }
}`,
      solution: `class DfsResult {
  HashMap<String, Integer> disc = new HashMap<>();
  HashMap<String, Integer> finish = new HashMap<>();
  ArrayList<String> order = new ArrayList<>();
}

class Dfs {
  private HashMap<String, ArrayList<String>> adj;
  private HashMap<String, String> color = new HashMap<>();
  private DfsResult res = new DfsResult();
  private int time = 0;
  private boolean cycle = false;

  static DfsResult dfs(HashMap<String, ArrayList<String>> adj, ArrayList<String> vertices) {
    Dfs d = new Dfs();
    d.adj = adj;
    for (String v : vertices) d.color.put(v, "W");
    for (String v : vertices) {
      if (d.color.get(v).equals("W")) d.visit(v);
    }
    return d.res;
  }

  void visit(String u) {
    color.put(u, "G");
    time = time + 1;
    res.disc.put(u, time);

    ArrayList<String> nbrs = adj.get(u);
    if (nbrs != null) {
      for (String v : nbrs) {
        String c = color.get(v);
        if (c == null) continue;
        if (c.equals("G")) cycle = true;
        if (c.equals("W")) visit(v);
      }
    }

    color.put(u, "B");
    time = time + 1;
    res.finish.put(u, time);
    res.order.add(u);
  }

  static boolean hasCycle(HashMap<String, ArrayList<String>> adj, ArrayList<String> vertices) {
    Dfs d = new Dfs();
    d.adj = adj;
    for (String v : vertices) d.color.put(v, "W");
    for (String v : vertices) {
      if (d.color.get(v).equals("W")) d.visit(v);
    }
    return d.cycle;
  }
}`,
      tests: [
        {
          name: "discovery timestamps increase along a chain",
          run(x, a) {
            const adj = { a: ["b"], b: ["c"], c: [] };
            a.eq(x.Dfs.dfs(adj, ["a", "b", "c"]).disc, { a: 1, b: 2, c: 3 }, "discovery times should be");
          },
        },
        {
          name: "children finish before their parent",
          run(x, a) {
            const adj = { a: ["b"], b: ["c"], c: [] };
            a.eq(x.Dfs.dfs(adj, ["a", "b", "c"]).finish, { c: 4, b: 5, a: 6 }, "finish times should be");
          },
        },
        {
          name: "matches the notes' graph — u is 1/8, w is 9/12, z is 10/11",
          run(x, a) {
            const adj = { u: ["v", "x"], v: ["y"], w: ["y", "z"], x: ["v"], y: ["x"], z: [] };
            const r = x.Dfs.dfs(adj, ["u", "v", "w", "x", "y", "z"]);
            a.eq([r.disc.u, r.finish.u], [1, 8], "u interval should be");
            a.eq([r.disc.w, r.finish.w], [9, 12], "w interval should be");
            a.eq([r.disc.z, r.finish.z], [10, 11], "z interval should be");
          },
        },
        {
          name: "a back edge is detected as a cycle",
          run(x, a) {
            const adj = { a: ["b"], b: ["c"], c: ["a"] };
            a.eq(x.Dfs.hasCycle(adj, ["a", "b", "c"]), true, "cycle detection should be");
          },
        },
        {
          name: "a DAG reports no cycle",
          run(x, a) {
            const adj = { a: ["b", "c"], b: ["d"], c: ["d"], d: [] };
            a.eq(x.Dfs.hasCycle(adj, ["a", "b", "c", "d"]), false, "DAG cycle detection should be");
          },
        },
        {
          name: "a cross edge is not mistaken for a cycle",
          run(x, a) {
            // b and c both point at d, but there is no way back — not a cycle
            const adj = { a: ["b", "c"], b: ["d"], c: ["d"], d: [] };
            a.eq(x.Dfs.hasCycle(adj, ["a", "b", "c", "d"]), false, "cross edge should not count as a cycle —");
          },
        },
      ],
    },

    quiz: [
      {
        q: "DFS follows edge <b>u → v</b> and finds <b>v is grey</b>. What kind of edge is it?",
        options: ["Tree edge", "Back edge — there is a cycle", "Forward edge", "Cross edge"],
        answer: 1,
        why: "Grey means v is still on the recursion stack, i.e. an ancestor of u — so u → v closes a loop.",
      },
      {
        q: "What does the parenthesis theorem say about two vertices' [d, f] intervals?",
        options: [
          "They always overlap partially",
          "They are either fully nested or completely disjoint",
          "They are always identical",
          "They are always disjoint",
        ],
        answer: 1,
        why: "Nesting means one vertex is a descendant of the other; disjoint means neither is. Partial overlap is impossible.",
      },
      {
        q: "In the notes' example, <b>z</b> has interval 10/11 and <b>w</b> has 9/12. What follows?",
        options: [
          "z and w are unrelated",
          "z is a descendant of w in the DFS forest",
          "w is a descendant of z",
          "There is a cycle between them",
        ],
        answer: 1,
        why: "[10, 11] nests inside [9, 12], so by the parenthesis theorem z sits below w.",
      },
    ],
  });

  /* ================================================================
   * 4.4 TOPOLOGICAL SORT
   * ============================================================== */
  DSA.lesson({
    id: "topo",
    module: MOD,
    title: "Topological sort",
    blurb:
      "Order a DAG so every edge points forward. It is just DFS — each finished vertex goes on the front of a list.",
    tags: ["DAG only", "O(V + E)", "finish-time order"],
    notes: `
      <h4>The recipe from the notes</h4>
      <span class="rule">Run DFS
As each vertex finishes, add it to the FRONT of a list</span>
      <p>That is the whole algorithm. The resulting list is a valid topological order.</p>
      <h4>Why the front?</h4>
      <p>A vertex finishes only after every vertex reachable from it has finished. So the <b>later</b>
      something finishes, the <b>earlier</b> it must appear. Pushing onto the front reverses finish
      order for free.</p>
      <div class="callout">Equivalent statement: sort vertices by <b>decreasing finish time</b>.</div>
      <h4>It requires a DAG</h4>
      <p>If the graph has a cycle there is no valid ordering — <code>a</code> before <code>b</code>
      before <code>a</code> is impossible. DFS detects this: any <b>back edge</b> means no topological
      sort exists.</p>
      <h4>The order is not unique</h4>
      <p>Independent vertices can appear in any relative order. Socks and a shirt have no dependency,
      so either may come first. Any output where every edge points forward is correct.</p>
      <h4>Where you meet it</h4>
      <ul>
        <li>Build systems resolving compile order.</li>
        <li>Package managers resolving dependencies.</li>
        <li>Course prerequisites.</li>
        <li>Spreadsheet formula recalculation.</li>
      </ul>`,
    complexity: [
      ["Aspect", "Cost", "Note"],
      ["time", "O(V + E)", "one DFS pass"],
      ["space", "O(V)", "list + recursion"],
      ["requires", "a DAG", "cycles have no order"],
      ["uniqueness", "not unique", "many valid orders"],
    ],
    pseudo: [
      "TOPOLOGICAL-SORT(G)",
      "  L = empty list",
      "  run DFS(G)",
      "  as each vertex u finishes:",
      "      insert u at the FRONT of L",
      "  return L",
      "",
      "// equivalently: sort by decreasing finish time",
      "// a back edge => cycle => no ordering exists",
    ],
    legend: [
      { color: "#f1f7f3", label: "white" },
      { color: "#87a596", label: "grey — on the stack" },
      { color: C.done, label: "finished → added to front" },
      { color: C.visit, label: "current vertex" },
    ],

    mount(ctx) {
      DSA.ensureDefs(ctx.svg);
      const G = TOPO_GRAPH;
      const adj = buildAdj(G);

      DSA.controls(ctx.controls, [
        { type: "button", label: "Run topological sort", onClick: () => run(true) },
        { type: "button", label: "Reset", onClick: () => ctx.load([base()]) },
      ]);

      function base() {
        const color = {}, fin = {};
        G.vertices.forEach((v) => { color[v.id] = "W"; fin[v.id] = null; });
        return { graph: G, color, fin, list: [], msg: "A dependency DAG: an edge <b>u → v</b> means u must come before v.", line: null, opts: {} };
      }

      function run(autoplay) {
        const color = {}, fin = {};
        G.vertices.forEach((v) => { color[v.id] = "W"; fin[v.id] = null; });
        let time = 0;
        const list = [];
        const F = [];
        const snap = (msg, line, opts) => F.push({
          graph: G, color: Object.assign({}, color), fin: Object.assign({}, fin),
          list: list.slice(), msg, line, opts: opts || {},
        });

        snap("Run DFS. Each time a vertex finishes, it goes to the <b>front</b> of the list.", 2, {});

        function visit(u) {
          color[u] = "G";
          snap(`Visit <b>${u}</b> — grey, exploring its dependents.`, 2, { active: u });
          adj[u].forEach((e) => {
            const v = e.to;
            if (color[v] === "W") {
              snap(`<b>${u} → ${v}</b>: ${v} not yet visited, recurse.`, 2, { active: u, edge: key(u, v) });
              visit(v);
            }
          });
          color[u] = "B"; fin[u] = ++time;
          list.unshift(u);
          snap(`<b>${u}</b> finishes (f = ${time}). Everything it depends on is already placed, so put <b>${u}</b> at the front.`,
            4, { done: u });
        }

        G.vertices.forEach((v) => { if (color[v.id] === "W") visit(v.id); });
        snap(`Topological order: <b>${list.join(" → ")}</b>. Every edge points forward in this list.`, 5, {});
        ctx.load(F, { autoplay: autoplay });
      }

      ctx.render = function (f) {
        const pos = {};
        f.list.forEach((v, i) => (pos[v] = i));
        drawGraph(ctx, f, {
          nodeStyle: (v) => {
            const o = f.opts, c = f.color[v.id];
            const st = { badge: pos[v.id] != null ? "#" + (pos[v.id] + 1) : null, badgeFill: C.done };
            if (c === "W") { st.fill = "#f1f7f3"; st.stroke = "#c3ddcd"; }
            else if (c === "G") { st.fill = "#e3ece7"; st.stroke = "#87a596"; }
            else { st.fill = "#cdf0df"; st.stroke = C.done; }
            if (o.active === v.id) { st.fill = "#d2eef8"; st.stroke = C.visit; st.bold = true; }
            if (o.done === v.id) { st.bold = true; st.tag = "finished"; st.tagFill = C.done; }
            return st;
          },
          edgeStyle: (e) => {
            const o = f.opts;
            if (o.edge === key(e.u, e.v)) return { stroke: C.visit, width: 3.6, hot: true };
            const ordered = pos[e.u] != null && pos[e.v] != null;
            return ordered ? { stroke: C.done, width: 2.4 } : { opacity: 0.5 };
          },
        });
        ctx.trace.innerHTML =
          DSA.chips("topological order:", f.list, "nothing placed yet") +
          `<div style="margin-top:4px;color:var(--dim)">${f.list.length}/${f.graph.vertices.length} placed</div>`;
      };

      ctx.load([base()]);
    },

    code: {
      exports: ["Topo"],
      starter: `// adj maps a vertex to the vertices that depend on it (a DAG).
// Run DFS and put each vertex on the FRONT of the result as it finishes.
class Topo {
  private HashMap<String, ArrayList<String>> adj;
  private HashMap<String, String> color = new HashMap<>();
  private ArrayList<String> result = new ArrayList<>();

  static ArrayList<String> topoSort(HashMap<String, ArrayList<String>> adj, ArrayList<String> vertices) {
    Topo t = new Topo();
    t.adj = adj;
    for (String v : vertices) t.color.put(v, "W");
    for (String v : vertices) {
      if (t.color.get(v).equals("W")) t.visit(v);
    }
    return t.result;
  }

  void visit(String u) {
    // mark grey, recurse into white neighbours,
    // then mark black and insert u at index 0 of result
  }
}`,
      solution: `class Topo {
  private HashMap<String, ArrayList<String>> adj;
  private HashMap<String, String> color = new HashMap<>();
  private ArrayList<String> result = new ArrayList<>();

  static ArrayList<String> topoSort(HashMap<String, ArrayList<String>> adj, ArrayList<String> vertices) {
    Topo t = new Topo();
    t.adj = adj;
    for (String v : vertices) t.color.put(v, "W");
    for (String v : vertices) {
      if (t.color.get(v).equals("W")) t.visit(v);
    }
    return t.result;
  }

  void visit(String u) {
    color.put(u, "G");
    ArrayList<String> nbrs = adj.get(u);
    if (nbrs != null) {
      for (String v : nbrs) {
        String c = color.get(v);
        if (c != null && c.equals("W")) visit(v);
      }
    }
    color.put(u, "B");
    result.add(0, u);
  }
}`,
      tests: [
        {
          name: "a simple chain comes out in order",
          run(x, a) {
            const adj = { a: ["b"], b: ["c"], c: [] };
            a.eq(x.Topo.topoSort(adj, ["a", "b", "c"]), ["a", "b", "c"], "order should be");
          },
        },
        {
          name: "every vertex appears exactly once",
          run(x, a) {
            const adj = { a: ["b", "c"], b: ["d"], c: ["d"], d: [] };
            const out = x.Topo.topoSort(adj, ["a", "b", "c", "d"]);
            a.eq(out.length, 4, "length should be");
            a.eq(out.slice().sort(), ["a", "b", "c", "d"], "sorted contents should be");
          },
        },
        {
          name: "every edge points forward in the result",
          run(x, a) {
            const adj = {
              undershorts: ["pants", "shoes"], pants: ["belt", "shoes"], belt: ["jacket"],
              shirt: ["belt", "tie"], tie: ["jacket"], jacket: [], socks: ["shoes"], shoes: [], watch: [],
            };
            const vs = Object.keys(adj);
            const out = x.Topo.topoSort(adj, vs);
            const at = {};
            out.forEach((v, i) => (at[v] = i));
            for (const u of vs)
              for (const v of adj[u])
                a.ok(at[u] < at[v], `${u} must come before ${v}, but got positions ${at[u]} and ${at[v]}`);
          },
        },
        {
          name: "dependencies are respected in a diamond",
          run(x, a) {
            const adj = { a: ["b", "c"], b: ["d"], c: ["d"], d: [] };
            const out = x.Topo.topoSort(adj, ["a", "b", "c", "d"]);
            a.eq(out[0], "a", "first vertex should be");
            a.eq(out[3], "d", "last vertex should be");
          },
        },
        {
          name: "isolated vertices are still included",
          run(x, a) {
            const adj = { a: ["b"], b: [], lonely: [] };
            const out = x.Topo.topoSort(adj, ["a", "b", "lonely"]);
            a.ok(out.indexOf("lonely") >= 0, "the isolated vertex should appear in the output");
            a.eq(out.length, 3, "length should be");
          },
        },
      ],
    },

    quiz: [
      {
        q: "Why is a finished vertex added to the <b>front</b> of the list?",
        options: [
          "It is faster than pushing",
          "A vertex finishes only after everything it points to, so late finishers belong earliest",
          "To keep the list sorted alphabetically",
          "To detect cycles",
        ],
        answer: 1,
        why: "Finish order is the reverse of dependency order, so unshifting reverses it back.",
      },
      {
        q: "What happens if you try to topologically sort a graph containing a cycle?",
        options: [
          "You get a valid order anyway",
          "No valid order exists — DFS reveals it as a back edge",
          "The algorithm runs forever",
          "Only the cycle is returned",
        ],
        answer: 1,
        why: "A cycle demands a vertex come before itself. DFS surfaces this as a back edge to a grey vertex.",
      },
      {
        q: "Two different valid topological orders for the same DAG means…",
        options: [
          "One of them is wrong",
          "The graph has a cycle",
          "Some vertices have no dependency between them, so their relative order is free",
          "The DFS was buggy",
        ],
        answer: 2,
        why: "Topological order only constrains connected pairs. Independent vertices may appear in any relative order.",
      },
    ],
  });

  /* ================================================================
   * 4.5 DIJKSTRA
   * ============================================================== */
  DSA.lesson({
    id: "dijkstra",
    module: MOD,
    title: "Dijkstra's shortest path",
    blurb:
      "Single-source shortest paths on a weighted graph with non-negative edges. Always expand the closest unfinished vertex.",
    tags: ["greedy + priority queue", "O(E log V)", "no negative weights"],
    notes: `
      <h4>The problem</h4>
      <p>From the notes: <i>single source shortest path for a weighted directed graph with positive
      edge weights.</i></p>
      <h4>The greedy rule</h4>
      <p>Keep a tentative distance <code>v.d</code> for every vertex — <code>0</code> for the source,
      <code>∞</code> for everything else. Then repeat: <b>extract the unfinished vertex with the
      smallest d</b>, add it to the finished set <code>S</code>, and <b>relax</b> its outgoing edges.</p>
      <h4>Relaxation</h4>
      <span class="rule">if w(u,v) + u.d < v.d
    v.d = w(u,v) + u.d
    v.p = u</span>
      <p>"Is going through <code>u</code> cheaper than the best route I currently know to
      <code>v</code>?" If so, record the improvement.</p>
      <div class="callout">When a vertex is extracted its distance is <b>final</b>. Any other route
      would have to leave through a vertex already known to be further away, and with non-negative
      weights that can never come back cheaper.</div>
      <h4>Why non-negative weights matter</h4>
      <div class="callout warn">A negative edge breaks the argument above — a longer-looking path could
      later drop below the finalised value. Use <b>Bellman-Ford</b> (<code>O(VE)</code>) when negative
      weights exist.</div>
      <h4>Cost</h4>
      <p>With a binary-heap priority queue: <code>O((V + E) log V)</code>. The notes decompose it as
      <code>V log V</code> for the extractions plus <code>E log V</code> for the decrease-key updates.</p>`,
    complexity: [
      ["Aspect", "Cost", "Note"],
      ["binary heap", "O((V+E) log V)", "usual choice"],
      ["Fibonacci heap", "O(E + V log V)", "theoretical best"],
      ["negative edges", "unsupported", "use Bellman-Ford"],
      ["BFS equivalence", "all w = 1", "same result"],
    ],
    pseudo: [
      "DIJKSTRA(G, w, s)",
      "  for all v in G:  v.d = INF;  v.p = NIL",
      "  s.d = 0",
      "  Q = all vertices        // priority queue keyed by d",
      "  S = empty set",
      "  while Q is not empty",
      "      u = EXTRACT-MIN(Q)",
      "      S = S union {u}",
      "      for all v in adj(u)",
      "          if w(u,v) + u.d < v.d      // relax",
      "              v.d = w(u,v) + u.d",
      "              v.p = u",
    ],
    legend: [
      { color: "#f1f7f3", label: "d = ∞" },
      { color: "#e3ece7", label: "in the queue" },
      { color: C.visit, label: "u — extracted min" },
      { color: C.done, label: "finalised (in S)" },
      { color: C.warn, label: "relaxed — improved" },
    ],

    mount(ctx) {
      DSA.ensureDefs(ctx.svg);
      const G = DIJK_GRAPH;
      const adj = buildAdj(G);
      let source = "s";

      DSA.controls(ctx.controls, [
        {
          type: "select", name: "src", label: "source", value: "s",
          options: G.vertices.map((v) => ({ value: v.id, label: v.id })),
          onChange: (r) => { source = r.src.value; ctx.load([base()]); },
        },
        { type: "button", label: "Run Dijkstra", onClick: () => run(true) },
        { type: "button", label: "Reset", onClick: () => ctx.load([base()]) },
      ]);

      function base() {
        const d = {}, p = {};
        G.vertices.forEach((v) => { d[v.id] = Infinity; p[v.id] = null; });
        return { graph: G, d, p, S: [], Q: G.vertices.map((v) => v.id), msg: `Press <b>Run Dijkstra</b> to find shortest paths from <b>${source}</b>.`, line: null, opts: {} };
      }

      function run(autoplay) {
        const d = {}, p = {};
        G.vertices.forEach((v) => { d[v.id] = Infinity; p[v.id] = null; });
        d[source] = 0;
        const Q = G.vertices.map((v) => v.id);
        const S = [];
        const F = [];
        const snap = (msg, line, opts) => F.push({
          graph: G, d: Object.assign({}, d), p: Object.assign({}, p),
          S: S.slice(), Q: Q.slice(), msg, line, opts: opts || {},
        });

        snap(`Initialise: <b>d[${source}] = 0</b>, every other d = ∞. All vertices enter the priority queue.`, 2, {});

        while (Q.length) {
          let best = null;
          Q.forEach((v) => { if (best === null || d[v] < d[best]) best = v; });
          if (d[best] === Infinity) {
            snap(`Every remaining vertex still has d = ∞ — they are unreachable from <b>${source}</b>.`, 6, {});
            break;
          }
          Q.splice(Q.indexOf(best), 1);
          S.push(best);
          snap(`EXTRACT-MIN picks <b>${best}</b> with d = <b>${d[best]}</b>. This distance is now <b>final</b>.`, 7, { active: best });

          adj[best].forEach((e) => {
            const v = e.to;
            if (S.indexOf(v) >= 0) return;
            const cand = d[best] + e.w;
            if (cand < d[v]) {
              const old = d[v];
              d[v] = cand; p[v] = best;
              snap(`Relax <b>${best} → ${v}</b>: ${d[best]} + ${e.w} = <b>${cand}</b> beats ${old === Infinity ? "∞" : old}. Update d[${v}] and π[${v}] = ${best}.`,
                10, { active: best, relaxed: v, edge: key(best, v) });
            } else {
              snap(`Check <b>${best} → ${v}</b>: ${d[best]} + ${e.w} = ${cand} is not better than ${d[v]}. Leave it.`,
                9, { active: best, skip: v, edge: key(best, v) });
            }
          });
        }

        const summary = G.vertices.map((v) => `${v.id}=${d[v.id] === Infinity ? "∞" : d[v.id]}`).join(", ");
        snap(`Finished. Shortest distances from <b>${source}</b>: <b>${summary}</b>.`, null, {});
        ctx.load(F, { autoplay: autoplay });
      }

      ctx.render = function (f) {
        drawGraph(ctx, f, {
          nodeStyle: (v) => {
            const o = f.opts;
            const done = f.S.indexOf(v.id) >= 0;
            const st = {
              badge: f.d[v.id] === Infinity ? "∞" : f.d[v.id],
              badgeFill: f.d[v.id] === Infinity ? "#9ab3a6" : done ? C.done : C.visit,
              sub: f.p[v.id] ? "π=" + f.p[v.id] : null,
            };
            if (f.d[v.id] === Infinity) { st.fill = "#f1f7f3"; st.stroke = "#c3ddcd"; }
            else if (done) { st.fill = "#cdf0df"; st.stroke = C.done; }
            else { st.fill = "#e3ece7"; st.stroke = "#87a596"; }
            if (o.relaxed === v.id) { st.fill = "#fcefd4"; st.stroke = C.warn; st.bold = true; }
            if (o.skip === v.id) { st.stroke = C.warn; }
            if (o.active === v.id) { st.fill = "#d2eef8"; st.stroke = C.visit; st.bold = true; st.tag = "u"; }
            return st;
          },
          edgeStyle: (e) => {
            const o = f.opts;
            if (o.edge === key(e.u, e.v)) return { stroke: o.relaxed ? C.warn : C.visit, width: 3.8, hot: true };
            if (f.p[e.v] === e.u) return { stroke: C.done, width: 3 };
            return { opacity: 0.5 };
          },
        });
        const rows = f.graph.vertices.map((v) => [
          v.id,
          f.d[v.id] === Infinity ? "∞" : f.d[v.id],
          f.p[v.id] || "NIL",
          f.S.indexOf(v.id) >= 0 ? "final" : "—",
        ]);
        ctx.trace.innerHTML = DSA.chips("priority queue:", f.Q.map((v) => `${v}:${f.d[v] === Infinity ? "∞" : f.d[v]}`), "empty") +
          DSA.chips("S (finalised):", f.S, "empty");
        const t = document.createElement("div");
        DSA.traceTable(t, ["v", "d", "π", "status"], rows);
        ctx.trace.appendChild(t);
      };

      ctx.load([base()]);
    },

    code: {
      exports: ["Dijkstra", "Edge"],
      starter: `// Weighted directed graph with NON-NEGATIVE weights.
// Unreachable vertices keep Integer.MAX_VALUE.
class Edge {
  String to;
  int w;
  Edge(String to, int w) {
    this.to = to;
    this.w = w;
  }
}

class DijkstraResult {
  HashMap<String, Integer> dist = new HashMap<>();
  HashMap<String, String> parent = new HashMap<>();
}

class Dijkstra {
  static DijkstraResult dijkstra(HashMap<String, ArrayList<Edge>> adj,
                                 ArrayList<String> vertices, String source) {
    DijkstraResult res = new DijkstraResult();
    HashSet<String> visited = new HashSet<>();

    for (String v : vertices) {
      res.dist.put(v, Integer.MAX_VALUE);
      res.parent.put(v, null);
    }
    res.dist.put(source, 0);

    while (visited.size() < vertices.size()) {
      // 1. pick the unvisited vertex with the smallest dist
      // 2. stop if it is still Integer.MAX_VALUE (the rest are unreachable)
      // 3. mark it visited, then relax each outgoing edge
    }
    return res;
  }
}`,
      solution: `class Edge {
  String to;
  int w;
  Edge(String to, int w) {
    this.to = to;
    this.w = w;
  }
}

class DijkstraResult {
  HashMap<String, Integer> dist = new HashMap<>();
  HashMap<String, String> parent = new HashMap<>();
}

class Dijkstra {
  static DijkstraResult dijkstra(HashMap<String, ArrayList<Edge>> adj,
                                 ArrayList<String> vertices, String source) {
    DijkstraResult res = new DijkstraResult();
    HashSet<String> visited = new HashSet<>();

    for (String v : vertices) {
      res.dist.put(v, Integer.MAX_VALUE);
      res.parent.put(v, null);
    }
    res.dist.put(source, 0);

    while (visited.size() < vertices.size()) {
      String u = null;
      for (String v : vertices) {
        if (!visited.contains(v)) {
          if (u == null || res.dist.get(v) < res.dist.get(u)) u = v;
        }
      }
      if (u == null || res.dist.get(u) == Integer.MAX_VALUE) break;
      visited.add(u);

      ArrayList<Edge> edges = adj.get(u);
      if (edges == null) continue;
      for (Edge e : edges) {
        int cand = res.dist.get(u) + e.w;
        if (cand < res.dist.get(e.to)) {
          res.dist.put(e.to, cand);
          res.parent.put(e.to, u);
        }
      }
    }
    return res;
  }
}`,
      tests: [
        {
          name: "a straight chain accumulates weights",
          run(x, a) {
            const E = (to, w) => new x.Edge(to, w);
            const adj = { a: [E("b", 3)], b: [E("c", 4)], c: [] };
            a.eq(x.Dijkstra.dijkstra(adj, ["a", "b", "c"], "a").dist, { a: 0, b: 3, c: 7 }, "dist should be");
          },
        },
        {
          name: "prefers a cheap detour over a costly direct edge",
          run(x, a) {
            const E = (to, w) => new x.Edge(to, w);
            const adj = { a: [E("b", 10), E("c", 2)], b: [], c: [E("b", 3)] };
            const r = x.Dijkstra.dijkstra(adj, ["a", "b", "c"], "a");
            a.eq(r.dist.b, 5, "dist to b should be");
            a.eq(r.parent.b, "c", "parent of b should be");
          },
        },
        {
          name: "matches the notes' graph — distances from s",
          run(x, a) {
            const E = (to, w) => new x.Edge(to, w);
            const adj = {
              s: [E("t", 10), E("y", 5)],
              t: [E("y", 2), E("x", 1)],
              y: [E("t", 3), E("x", 9), E("z", 2)],
              x: [E("z", 4)],
              z: [E("x", 6), E("s", 7)],
            };
            a.eq(x.Dijkstra.dijkstra(adj, ["s", "t", "x", "y", "z"], "s").dist,
              { s: 0, t: 8, x: 9, y: 5, z: 7 }, "distances should be");
          },
        },
        {
          name: "unreachable vertices stay at Integer.MAX_VALUE",
          run(x, a) {
            const E = (to, w) => new x.Edge(to, w);
            const adj = { a: [E("b", 1)], b: [], island: [] };
            a.eq(x.Dijkstra.dijkstra(adj, ["a", "b", "island"], "a").dist.island,
              2147483647, "island distance should be");
          },
        },
        {
          name: "parent pointers reconstruct the path",
          run(x, a) {
            const E = (to, w) => new x.Edge(to, w);
            const adj = { a: [E("b", 1)], b: [E("c", 1)], c: [E("d", 1)], d: [] };
            const parent = x.Dijkstra.dijkstra(adj, ["a", "b", "c", "d"], "a").parent;
            const path = [];
            let cur = "d";
            while (cur) { path.unshift(cur); cur = parent[cur]; }
            a.eq(path, ["a", "b", "c", "d"], "reconstructed path should be");
          },
        },
        {
          name: "with all weights 1 it agrees with BFS",
          run(x, a) {
            const E = (to, w) => new x.Edge(to, w);
            const adj = { a: [E("b", 1), E("c", 1)], b: [E("d", 1)], c: [E("d", 1)], d: [] };
            a.eq(x.Dijkstra.dijkstra(adj, ["a", "b", "c", "d"], "a").dist,
              { a: 0, b: 1, c: 1, d: 2 }, "unit-weight distances should be");
          },
        },
      ],
    },

    quiz: [
      {
        q: "In the notes' graph, what is the shortest distance from <b>s</b> to <b>t</b>?",
        options: ["10 — the direct edge", "8 — via y", "5", "3"],
        answer: 1,
        why: "s → y costs 5, then y → t costs 3, totalling 8 — cheaper than the direct 10-weight edge.",
      },
      {
        q: "Why does a vertex's distance become final the moment it is extracted?",
        options: [
          "Because the queue is sorted",
          "Because with non-negative weights, any alternative route must pass through a vertex already known to be further away",
          "Because it has no more neighbours",
          "It does not — it can change later",
        ],
        answer: 1,
        why: "Reaching it another way means leaving through some unfinished vertex whose distance is already ≥ this one, and non-negative edges can only add to that.",
      },
      {
        q: "What breaks if the graph has a negative edge weight?",
        options: [
          "Nothing, Dijkstra handles it",
          "The finality argument fails — a later, cheaper path can appear after a vertex is finalised",
          "The priority queue overflows",
          "The graph becomes disconnected",
        ],
        answer: 1,
        why: "A negative edge can reduce a path below an already-finalised distance, so the greedy choice is no longer safe. Bellman-Ford handles this.",
      },
    ],
  });

  /* ================================================================
   * 4.6 PRIM'S MST
   * ============================================================== */
  DSA.lesson({
    id: "prim",
    module: MOD,
    title: "Minimum spanning tree — Prim's",
    blurb:
      "Connect every vertex for the least total weight. Grow one tree, always taking the cheapest edge leaving it.",
    tags: ["greedy", "O(E log V)", "cut property"],
    notes: `
      <h4>What an MST is</h4>
      <p>From the notes: <i>an acyclic set of vertices such that vertices are connected and the sum of
      weights of the edges is minimized.</i> For <code>V</code> vertices it always has exactly
      <code>V − 1</code> edges.</p>
      <h4>Prim's idea</h4>
      <p>Keep one growing tree. At every step add the <b>cheapest edge that connects the tree to a
      vertex outside it</b>. Repeat <code>V − 1</code> times.</p>
      <p>Each outside vertex stores <code>v.key</code> — the weight of the cheapest known edge
      connecting it to the tree — and <code>v.π</code>, the tree endpoint of that edge. A priority
      queue serves the minimum key.</p>
      <h4>Why greedy is safe — the cut property</h4>
      <div class="callout">Split the vertices into "in the tree" and "not in the tree". The
      <b>lightest edge crossing that cut</b> is always in some MST. Prim's takes exactly that edge
      every time, so it never has to backtrack.</div>
      <h4>Prim vs Kruskal</h4>
      <ul>
        <li><b>Prim's</b> — grows a single connected tree; a priority queue of vertices. Good on dense graphs.</li>
        <li><b>Kruskal's</b> — sorts all edges and adds any that does not create a cycle, using union-find.
        It grows a forest that merges. Good on sparse graphs.</li>
      </ul>
      <h4>Cost</h4>
      <p>The notes give <code>O(V log V + E log V)</code> — <code>V</code> extract-min operations plus
      <code>E</code> decrease-key operations, each <code>log V</code> on a binary heap.</p>`,
    complexity: [
      ["Aspect", "Cost", "Note"],
      ["binary heap", "O(E log V)", "notes: V lg V + E lg V"],
      ["edges in MST", "V − 1", "always"],
      ["works on", "undirected", "connected, weighted"],
      ["negative weights", "fine", "unlike Dijkstra"],
    ],
    pseudo: [
      "MST-PRIM(G, w, r)",
      "  for all v in G:  v.key = INF;  v.p = NIL",
      "  r.key = 0",
      "  Q = all vertices        // priority queue keyed by key",
      "  while Q is not empty",
      "      u = EXTRACT-MIN(Q)",
      "      for all v in adj(u)",
      "          if v in Q and w(u,v) < v.key",
      "              v.key = w(u,v)",
      "              v.p = u",
      "",
      "// total: O(V lg V + E lg V)",
    ],
    legend: [
      { color: "#f1f7f3", label: "key = ∞" },
      { color: "#e3ece7", label: "reachable, still outside" },
      { color: C.visit, label: "u — just added" },
      { color: C.done, label: "in the MST" },
      { color: C.warn, label: "key improved" },
    ],

    mount(ctx) {
      DSA.ensureDefs(ctx.svg);
      const G = MST_GRAPH;
      const adj = buildAdj(G);
      let rootV = "a";

      DSA.controls(ctx.controls, [
        {
          type: "select", name: "root", label: "start", value: "a",
          options: G.vertices.map((v) => ({ value: v.id, label: v.id })),
          onChange: (r) => { rootV = r.root.value; ctx.load([base()]); },
        },
        { type: "button", label: "Run Prim's", onClick: () => run(true) },
        { type: "button", label: "Reset", onClick: () => ctx.load([base()]) },
      ]);

      function base() {
        const k = {}, p = {};
        G.vertices.forEach((v) => { k[v.id] = Infinity; p[v.id] = null; });
        return { graph: G, k, p, inMST: [], Q: G.vertices.map((v) => v.id), total: 0, msg: `Press <b>Run Prim's</b> to grow the MST from <b>${rootV}</b>.`, line: null, opts: {} };
      }

      function run(autoplay) {
        const k = {}, p = {};
        G.vertices.forEach((v) => { k[v.id] = Infinity; p[v.id] = null; });
        k[rootV] = 0;
        const Q = G.vertices.map((v) => v.id);
        const inMST = [];
        let total = 0;
        const F = [];
        const snap = (msg, line, opts) => F.push({
          graph: G, k: Object.assign({}, k), p: Object.assign({}, p),
          inMST: inMST.slice(), Q: Q.slice(), total, msg, line, opts: opts || {},
        });

        snap(`Initialise: every key = ∞ except the start <b>${rootV}</b>, whose key is 0.`, 1, {});

        while (Q.length) {
          let best = null;
          Q.forEach((v) => { if (best === null || k[v] < k[best]) best = v; });
          if (k[best] === Infinity) { snap("Remaining vertices are unreachable — the graph is disconnected.", 5, {}); break; }
          Q.splice(Q.indexOf(best), 1);
          inMST.push(best);
          if (p[best]) total += k[best];
          snap(
            p[best]
              ? `EXTRACT-MIN picks <b>${best}</b> (key ${k[best]}). Add edge <b>${p[best]}–${best}</b> of weight <b>${k[best]}</b>. Running total: <b>${total}</b>.`
              : `Start at <b>${best}</b> — the first vertex of the tree.`,
            5, { active: best, added: p[best] ? key(p[best], best) : null });

          adj[best].forEach((e) => {
            const v = e.to;
            if (Q.indexOf(v) < 0) return;
            if (e.w < k[v]) {
              const old = k[v];
              k[v] = e.w; p[v] = best;
              snap(`<b>${v}</b> is still outside and edge ${best}–${v} costs <b>${e.w}</b> &lt; ${old === Infinity ? "∞" : old} — improve its key and set π[${v}] = ${best}.`,
                8, { active: best, relaxed: v, edge: key(best, v) });
            } else {
              snap(`Edge ${best}–${v} costs ${e.w}, which is not better than ${v}'s current key ${k[v]}. Skip.`,
                7, { active: best, skip: v, edge: key(best, v) });
            }
          });
        }

        snap(`MST complete: <b>${inMST.length - 1}</b> edges, total weight <b>${total}</b>.`, null, { finished: true });
        ctx.load(F, { autoplay: autoplay });
      }

      ctx.render = function (f) {
        const inTree = (e) =>
          (f.p[e.v] === e.u && f.inMST.indexOf(e.v) >= 0) ||
          (f.p[e.u] === e.v && f.inMST.indexOf(e.u) >= 0);

        drawGraph(ctx, f, {
          nodeStyle: (v) => {
            const o = f.opts;
            const done = f.inMST.indexOf(v.id) >= 0;
            const st = {
              badge: f.k[v.id] === Infinity ? "∞" : "key " + f.k[v.id],
              badgeFill: f.k[v.id] === Infinity ? "#9ab3a6" : done ? C.done : C.warn,
              sub: f.p[v.id] ? "π=" + f.p[v.id] : null,
            };
            if (f.k[v.id] === Infinity) { st.fill = "#f1f7f3"; st.stroke = "#c3ddcd"; }
            else if (done) { st.fill = "#cdf0df"; st.stroke = C.done; }
            else { st.fill = "#e3ece7"; st.stroke = "#87a596"; }
            if (o.relaxed === v.id) { st.fill = "#fcefd4"; st.stroke = C.warn; st.bold = true; }
            if (o.active === v.id) { st.fill = "#d2eef8"; st.stroke = C.visit; st.bold = true; st.tag = "u"; }
            return st;
          },
          edgeStyle: (e) => {
            const o = f.opts, k1 = key(e.u, e.v), k2 = key(e.v, e.u);
            if (o.added === k1 || o.added === k2) return { stroke: C.done, width: 4.5, hot: true, labelFill: C.done };
            if (o.edge === k1 || o.edge === k2) return { stroke: o.relaxed ? C.warn : C.visit, width: 3.4, hot: true };
            if (inTree(e)) return { stroke: C.done, width: 3.4, labelFill: C.done };
            return { opacity: 0.42 };
          },
        });

        const rows = f.graph.vertices.map((v) => [
          v.id,
          f.k[v.id] === Infinity ? "∞" : f.k[v.id],
          f.p[v.id] || "NIL",
          f.inMST.indexOf(v.id) >= 0 ? "in MST" : "—",
        ]);
        ctx.trace.innerHTML =
          DSA.chips("queue:", f.Q.map((v) => `${v}:${f.k[v] === Infinity ? "∞" : f.k[v]}`), "empty") +
          `<div style="margin:4px 0;color:var(--dim)">MST weight so far: <b style="color:var(--ok)">${f.total}</b> · ${Math.max(0, f.inMST.length - 1)} of ${f.graph.vertices.length - 1} edges</div>`;
        const t = document.createElement("div");
        DSA.traceTable(t, ["v", "key", "π", "status"], rows);
        ctx.trace.appendChild(t);
      };

      ctx.load([base()]);
    },

    code: {
      exports: ["Prim", "Edge"],
      starter: `// Connected, undirected, weighted graph.
// total is the MST weight; parent[v] is the tree edge that reached v.
class Edge {
  String to;
  int w;
  Edge(String to, int w) {
    this.to = to;
    this.w = w;
  }
}

class PrimResult {
  HashMap<String, Integer> key = new HashMap<>();
  HashMap<String, String> parent = new HashMap<>();
  int total = 0;
}

class Prim {
  static PrimResult prim(HashMap<String, ArrayList<Edge>> adj,
                         ArrayList<String> vertices, String root) {
    PrimResult res = new PrimResult();
    HashSet<String> inMST = new HashSet<>();

    for (String v : vertices) {
      res.key.put(v, Integer.MAX_VALUE);
      res.parent.put(v, null);
    }
    res.key.put(root, 0);

    while (inMST.size() < vertices.size()) {
      // 1. pick the vertex outside the tree with the smallest key
      // 2. add it, and add its key to total (skip the root, whose key is 0)
      // 3. for each neighbour still outside the tree,
      //    improve its key if this edge is cheaper
    }
    return res;
  }
}`,
      solution: `class Edge {
  String to;
  int w;
  Edge(String to, int w) {
    this.to = to;
    this.w = w;
  }
}

class PrimResult {
  HashMap<String, Integer> key = new HashMap<>();
  HashMap<String, String> parent = new HashMap<>();
  int total = 0;
}

class Prim {
  static PrimResult prim(HashMap<String, ArrayList<Edge>> adj,
                         ArrayList<String> vertices, String root) {
    PrimResult res = new PrimResult();
    HashSet<String> inMST = new HashSet<>();

    for (String v : vertices) {
      res.key.put(v, Integer.MAX_VALUE);
      res.parent.put(v, null);
    }
    res.key.put(root, 0);

    while (inMST.size() < vertices.size()) {
      String u = null;
      for (String v : vertices) {
        if (!inMST.contains(v)) {
          if (u == null || res.key.get(v) < res.key.get(u)) u = v;
        }
      }
      if (u == null || res.key.get(u) == Integer.MAX_VALUE) break;
      inMST.add(u);
      if (res.parent.get(u) != null) res.total = res.total + res.key.get(u);

      ArrayList<Edge> edges = adj.get(u);
      if (edges == null) continue;
      for (Edge e : edges) {
        if (!inMST.contains(e.to) && e.w < res.key.get(e.to)) {
          res.key.put(e.to, e.w);
          res.parent.put(e.to, u);
        }
      }
    }
    return res;
  }
}`,
      tests: [
        {
          name: "a triangle drops its heaviest edge",
          run(x, a) {
            const E = (to, w) => new x.Edge(to, w);
            const adj = {
              a: [E("b", 1), E("c", 3)],
              b: [E("a", 1), E("c", 2)],
              c: [E("a", 3), E("b", 2)],
            };
            a.eq(x.Prim.prim(adj, ["a", "b", "c"], "a").total, 3, "MST weight should be");
          },
        },
        {
          name: "the MST has exactly V - 1 edges",
          run(x, a) {
            const E = (to, w) => new x.Edge(to, w);
            const adj = {
              a: [E("b", 1), E("c", 3)],
              b: [E("a", 1), E("c", 2), E("d", 5)],
              c: [E("a", 3), E("b", 2), E("d", 4)],
              d: [E("b", 5), E("c", 4)],
            };
            const parent = x.Prim.prim(adj, ["a", "b", "c", "d"], "a").parent;
            const edges = Object.keys(parent).filter((v) => parent[v] !== null);
            a.eq(edges.length, 3, "edge count should be");
          },
        },
        {
          name: "matches the notes' graph — total weight 37",
          run(x, a) {
            const pairs = [
              ["a", "b", 4], ["a", "h", 8], ["b", "h", 11], ["b", "c", 8],
              ["h", "i", 7], ["h", "g", 1], ["i", "c", 2], ["i", "g", 6],
              ["g", "f", 2], ["c", "d", 7], ["c", "f", 4], ["d", "f", 14],
              ["d", "e", 9], ["e", "f", 10],
            ];
            const vs = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
            const adj = {};
            vs.forEach((v) => (adj[v] = []));
            pairs.forEach(([u, v, w]) => {
              adj[u].push(new x.Edge(v, w));
              adj[v].push(new x.Edge(u, w));
            });
            a.eq(x.Prim.prim(adj, vs, "a").total, 37, "MST weight should be");
          },
        },
        {
          name: "the starting vertex does not change the total",
          run(x, a) {
            const pairs = [["a", "b", 4], ["b", "c", 8], ["a", "c", 3], ["c", "d", 2]];
            const vs = ["a", "b", "c", "d"];
            const build = () => {
              const adj = {};
              vs.forEach((v) => (adj[v] = []));
              pairs.forEach(([u, v, w]) => {
                adj[u].push(new x.Edge(v, w));
                adj[v].push(new x.Edge(u, w));
              });
              return adj;
            };
            const fromA = x.Prim.prim(build(), vs, "a").total;
            const fromD = x.Prim.prim(build(), vs, "d").total;
            a.eq(fromA, fromD, `starting at a gave ${fromA} and starting at d gave ${fromD}; they should match —`);
          },
        },
        {
          name: "the root has no parent",
          run(x, a) {
            const E = (to, w) => new x.Edge(to, w);
            const adj = { a: [E("b", 1)], b: [E("a", 1)] };
            const parent = x.Prim.prim(adj, ["a", "b"], "a").parent;
            a.eq(parent.a, null, "parent of the root should be");
            a.eq(parent.b, "a", "parent of b should be");
          },
        },
        {
          name: "a heavy shortcut edge is rejected",
          run(x, a) {
            const pairs = [["a", "b", 1], ["b", "c", 1], ["a", "c", 100]];
            const vs = ["a", "b", "c"];
            const adj = {};
            vs.forEach((v) => (adj[v] = []));
            pairs.forEach(([u, v, w]) => {
              adj[u].push(new x.Edge(v, w));
              adj[v].push(new x.Edge(u, w));
            });
            a.eq(x.Prim.prim(adj, vs, "a").total, 2, "MST weight should be");
          },
        },
      ],
    },

    quiz: [
      {
        q: "How many edges does an MST of a connected graph with 9 vertices have?",
        options: ["8", "9", "10", "it depends on the weights"],
        answer: 0,
        why: "A spanning tree on V vertices always has exactly V − 1 edges — enough to connect everything, few enough to stay acyclic.",
      },
      {
        q: "What justifies Prim's greedy choice?",
        options: [
          "The edges are pre-sorted",
          "The cut property — the lightest edge crossing any cut belongs to some MST",
          "There is only one possible MST",
          "It backtracks when it makes a mistake",
        ],
        answer: 1,
        why: "The tree/non-tree split is a cut, so the lightest crossing edge is always a safe addition.",
      },
      {
        q: "Unlike Dijkstra, Prim's works fine with negative edge weights. Why?",
        options: [
          "It sorts the edges first",
          "It compares single edge weights against a key, not accumulated path totals",
          "It uses a queue instead of a priority queue",
          "It does not — it fails too",
        ],
        answer: 1,
        why: "Prim's key holds one edge's weight. Dijkstra accumulates path costs, which is what negative edges break.",
      },
    ],
  });
})();
