/* Module 1 — Stacks, Queues, Linked Lists.
 * Pseudocode mirrors the handwritten portfolio notes. */
(function () {
  const DSA = (window.DSA = window.DSA || {});
  const C = DSA.COLORS;
  const MOD = "Linear structures";

  const BOX_W = 62, BOX_H = 42, GAP = 16;

  /* Draw a horizontal row of value boxes with optional arrows between them. */
  function drawRow(scene, cells, opts) {
    opts = opts || {};
    const y = opts.y || 0;
    const pts = [];
    cells.forEach((c, i) => {
      const x = i * (BOX_W + (opts.gap == null ? GAP : opts.gap));
      const fill = c.fill || C.idle;
      const stroke = c.stroke || C.idleLine;
      scene.put(`box-${c.key}`, "rect", {
        class: "n-box", x, y, width: BOX_W, height: BOX_H, rx: 9,
        fill, stroke, "stroke-width": c.bold ? 2.5 : 1.5,
        opacity: c.ghost ? 0.35 : 1,
      });
      scene.put(`lbl-${c.key}`, "text", {
        class: "n-label", x: x + BOX_W / 2, y: y + BOX_H / 2,
        fill: c.textFill || "#12291f", "font-size": 15,
      }, c.value);
      if (c.tag)
        scene.put(`tag-${c.key}`, "text", {
          class: "n-label", x: x + BOX_W / 2, y: y - 15,
          fill: c.tagFill || C.active, "font-size": 11,
        }, c.tag);
      if (c.index != null)
        scene.put(`ix-${c.key}`, "text", {
          class: "n-label", x: x + BOX_W / 2, y: y + BOX_H + 15,
          fill: "#7d9a8b", "font-size": 11,
        }, c.index);
      pts.push({ x, y: y - 30 }, { x: x + BOX_W, y: y + BOX_H + 26 });
    });
    return pts;
  }

  /* Reusable arrowhead marker. */
  const ensureDefs = DSA.ensureDefs;

  /* ================================================================
   * 1.1 STACK
   * ============================================================== */
  DSA.lesson({
    id: "stack",
    module: MOD,
    title: "Stack — LIFO",
    blurb:
      "A stack only ever touches one end. The last item pushed is the first one popped, which makes every core operation constant time.",
    tags: ["LIFO", "push / pop O(1)", "array or linked backing"],
    notes: `
      <h4>The idea</h4>
      <p>A stack is a <b>Last In, First Out</b> collection. Everything happens at the <code>top</code>:
      you <code>push</code> onto the top and <code>pop</code> from the top. There is no way to reach
      into the middle without removing what sits above.</p>
      <h4>The three operations</h4>
      <ul>
        <li><code>push(x)</code> — put <code>x</code> on the top, top moves up.</li>
        <li><code>pop()</code> — remove and return the top item.</li>
        <li><code>peek()</code> — read the top without removing it.</li>
      </ul>
      <div class="callout">Because we only ever touch one end, no element ever has to shift.
      That is why all three are <code>O(1)</code>.</div>
      <h4>Underflow &amp; overflow</h4>
      <p>Popping an empty stack is <b>underflow</b>. Pushing onto a full fixed-size stack is
      <b>overflow</b>. A linked-list backed stack can never overflow while memory lasts.</p>
      <h4>Where it shows up</h4>
      <ul>
        <li>The call stack — every function invocation pushes a frame.</li>
        <li>Undo history in an editor.</li>
        <li>Matching brackets and parsing expressions.</li>
        <li>The explicit stack that replaces recursion in iterative DFS.</li>
      </ul>`,
    complexity: [
      ["Operation", "Time", "Space"],
      ["push", "O(1)", "O(1)"],
      ["pop", "O(1)", "O(1)"],
      ["peek", "O(1)", "O(1)"],
      ["search", "O(n)", "O(1)"],
    ],
    pseudo: [
      "PUSH(S, x)",
      "  if S.top == S.capacity",
      "      error \"overflow\"",
      "  S.top = S.top + 1",
      "  S[S.top] = x",
      "",
      "POP(S)",
      "  if S.top == 0",
      "      error \"underflow\"",
      "  S.top = S.top - 1",
      "  return S[S.top + 1]",
    ],
    legend: [
      { color: C.idle, label: "stored" },
      { color: C.active, label: "top of stack" },
      { color: C.done, label: "just pushed" },
      { color: C.bad, label: "being popped" },
    ],

    mount(ctx) {
      ensureDefs(ctx.svg);
      const CAP = 7;
      let items = [{ key: "s1", value: 12 }, { key: "s2", value: 7 }, { key: "s3", value: 40 }];
      let uid = 4;

      const refs = DSA.controls(ctx.controls, [
        { type: "input", name: "val", label: "value", inputType: "number", value: 25 },
        { type: "button", label: "Push", onClick: () => doPush() },
        { type: "button", label: "Pop", variant: "danger", onClick: () => doPop() },
        { type: "button", label: "Peek", variant: "alt", onClick: () => doPeek() },
        { type: "button", label: "Clear", onClick: () => { items = []; ctx.load(snapshot("Stack cleared.", null)); } },
      ]);

      function frame(state, msg, line, opts) {
        return { state: DSA.clone(state), msg, line, opts: opts || {} };
      }

      function snapshot(msg, line) {
        return [frame(items, msg, line)];
      }

      function doPush() {
        const v = DSA.readInt(refs.val, 0);
        const F = [];
        F.push(frame(items, `Push <b>${v}</b> — first check for overflow.`, 1));
        if (items.length >= CAP) {
          F.push(frame(items, `Stack is full (${CAP}/${CAP}). <b>Overflow</b> — push rejected.`, 2, { error: true }));
          ctx.load(F); return;
        }
        const node = { key: "s" + uid++, value: v };
        const after = items.concat([node]);
        F.push(frame(after, `Increment top, then write <b>${v}</b> into the new slot.`, 4,
          { hotKey: node.key, hotFill: "#cdf0df", hotStroke: C.done, hotTag: "new top" }));
        F.push(frame(after, `Done. <b>${v}</b> is the top; size is ${after.length}.`, 4));
        items = after;
        ctx.load(F);
      }

      function doPop() {
        const F = [];
        F.push(frame(items, "Pop — first check for underflow.", 7));
        if (!items.length) {
          F.push(frame(items, "Stack is empty. <b>Underflow</b> — nothing to pop.", 8, { error: true }));
          ctx.load(F); return;
        }
        const top = items[items.length - 1];
        F.push(frame(items, `Top holds <b>${top.value}</b>. Mark it for removal.`, 9,
          { hotKey: top.key, hotFill: "#fde2e8", hotStroke: C.bad, hotTag: "removing" }));
        const after = items.slice(0, -1);
        F.push(frame(after, `Returned <b>${top.value}</b>. Size is now ${after.length}.`, 10));
        items = after;
        ctx.load(F);
      }

      function doPeek() {
        if (!items.length) { ctx.load(snapshot("Stack is empty — nothing to peek.", null)); return; }
        const top = items[items.length - 1];
        ctx.load([
          frame(items, `Peek reads the top without removing it: <b>${top.value}</b>.`, null,
            { hotKey: top.key, hotFill: "#d2eef8", hotStroke: C.visit, hotTag: "peek" }),
        ]);
      }

      // Drawn vertically: index 0 sits at the bottom and the stack grows upward.
      const SW = 108, SH = 38, SGAP = 8;
      const slotY = (i) => (CAP - 1 - i) * (SH + SGAP);

      ctx.render = function (f) {
        const scene = ctx.scene;
        scene.begin();
        const state = f.state, o = f.opts;
        const topIndex = state.length - 1;

        for (let i = 0; i < CAP; i++) {
          const y = slotY(i);
          const it = state[i];

          if (it) {
            const isTop = i === topIndex;
            const hot = o.hotKey === it.key;
            let fill = C.idle, stroke = C.idleLine, bold = false;
            if (isTop) { fill = "#dae9f7"; stroke = C.active; bold = true; }
            if (hot) { fill = o.hotFill; stroke = o.hotStroke; bold = true; }

            scene.put(`box-${it.key}`, "rect", {
              class: "n-box", x: 0, y, width: SW, height: SH, rx: 9,
              fill, stroke, "stroke-width": bold ? 2.6 : 1.5,
            });
            scene.put(`val-${it.key}`, "text", {
              class: "n-label", x: SW / 2, y: y + SH / 2, fill: "#12291f", "font-size": 15,
            }, it.value);

            const tag = hot ? o.hotTag : isTop ? "top" : null;
            if (tag)
              scene.put(`tag-${it.key}`, "text", {
                class: "n-label", x: SW + 14, y: y + SH / 2,
                fill: hot ? o.hotStroke : C.active, "font-size": 12, "text-anchor": "start",
              }, "◀ " + tag);
          } else {
            scene.put(`empty-${i}`, "rect", {
              class: "n-box", x: 0, y, width: SW, height: SH, rx: 9,
              fill: "none", stroke: "#cfe6d8", "stroke-width": 1.5, "stroke-dasharray": "5 5",
            });
          }

          scene.put(`ix-${i}`, "text", {
            class: "n-label", x: -12, y: y + SH / 2,
            fill: it ? "#7d9a8b" : "#b3ccbe", "font-size": 11.5, "text-anchor": "end",
          }, i);
        }

        const headY = slotY(CAP - 1) - 20;
        scene.put("grow", "text", {
          class: "n-label", x: SW / 2, y: headY, fill: "#7d9a8b", "font-size": 11.5,
        }, "push ▼   pop ▲");

        const baseY = slotY(0) + SH + 11;
        scene.put("baseline", "path", {
          class: "n-edge", d: `M -6 ${baseY} L ${SW + 6} ${baseY}`,
          stroke: "#a8cbb8", "stroke-width": 3, fill: "none",
        });
        scene.put("baseLbl", "text", {
          class: "n-label", x: SW / 2, y: baseY + 15, fill: "#7d9a8b", "font-size": 11.5,
        }, "bottom of stack");

        scene.end();
        DSA.fit(ctx.svg, -48, headY - 12, SW + 100, baseY + 24, 14);
        ctx.trace.innerHTML =
          DSA.chips("stack (bottom → top):", state.map((s) => s.value)) +
          `<div style="margin-top:4px;color:var(--dim)">size ${state.length} / capacity ${CAP}</div>`;
      };

      ctx.load(snapshot("A stack with three items. Push or pop to see the top move.", null));
    },

    code: {
      exports: ["Stack"],
      starter: `// Implement a stack backed by an ArrayList.
// pop() and peek() return null when the stack is empty.
class Stack {
  private ArrayList<Integer> items = new ArrayList<>();

  void push(int v) {
    // add v to the top
  }

  Integer pop() {
    // remove and return the top, or null if empty
  }

  Integer peek() {
    // return the top without removing it
  }

  int size() {
    return items.size();
  }

  boolean isEmpty() {
    return items.size() == 0;
  }
}`,
      solution: `class Stack {
  private ArrayList<Integer> items = new ArrayList<>();

  void push(int v) {
    items.add(v);
  }

  Integer pop() {
    if (items.isEmpty()) return null;
    return items.remove(items.size() - 1);
  }

  Integer peek() {
    if (items.isEmpty()) return null;
    return items.get(items.size() - 1);
  }

  int size() {
    return items.size();
  }

  boolean isEmpty() {
    return items.size() == 0;
  }
}`,
      tests: [
        {
          name: "push adds items and reports the right size",
          run(x, a) {
            const s = new x.Stack();
            s.push(1); s.push(2); s.push(3);
            a.eq(s.size(), 3, "size() should be");
          },
        },
        {
          name: "pop returns items in LIFO order",
          run(x, a) {
            const s = new x.Stack();
            [1, 2, 3].forEach((v) => s.push(v));
            a.eq([s.pop(), s.pop(), s.pop()], [3, 2, 1], "pop order should be");
          },
        },
        {
          name: "peek reads the top without removing it",
          run(x, a) {
            const s = new x.Stack();
            s.push(10); s.push(20);
            a.eq(s.peek(), 20, "peek() should be");
            a.eq(s.size(), 2, "size after peek should be");
          },
        },
        {
          name: "popping an empty stack yields null",
          run(x, a) {
            const s = new x.Stack();
            a.eq(s.pop(), null, "empty pop() should be");
            a.eq(s.isEmpty(), true, "isEmpty() should be");
          },
        },
      ],
    },

    quiz: [
      {
        q: "You push 4, 8, 15 then pop once. What is on top?",
        options: ["4", "8", "15", "the stack is empty"],
        answer: 1,
        why: "15 was on top and got popped, which exposes 8 underneath.",
      },
      {
        q: "Why is <code>push</code> O(1) rather than O(n)?",
        options: [
          "Because stacks are always small",
          "Because nothing else has to move — only the top index changes",
          "Because arrays are sorted",
          "Because push copies the whole stack",
        ],
        answer: 1,
        why: "All work happens at one end, so no element is ever shifted.",
      },
      {
        q: "Which problem is a stack the natural fit for?",
        options: [
          "Serving print jobs in arrival order",
          "Finding the shortest path in a graph",
          "Checking that brackets in an expression are balanced",
          "Keeping items sorted as they arrive",
        ],
        answer: 2,
        why: "Each opening bracket is pushed, and each closing bracket must match the most recent one — exactly LIFO.",
      },
    ],
  });

  /* ================================================================
   * 1.2 QUEUE
   * ============================================================== */
  DSA.lesson({
    id: "queue",
    module: MOD,
    title: "Queue — FIFO",
    blurb:
      "A queue is open at both ends: items join the back and leave from the front, preserving arrival order.",
    tags: ["FIFO", "enqueue / dequeue O(1)", "drives BFS"],
    notes: `
      <h4>The idea</h4>
      <p>A queue is <b>First In, First Out</b>. New items are <code>enqueued</code> at the
      <code>tail</code>; items leave from the <code>head</code>. Order of arrival is order of service.</p>
      <h4>The circular trick</h4>
      <p>If you back a queue with a fixed array and just move the head forward, the front of the array
      leaks away and can never be reused. The fix is a <b>circular buffer</b>: head and tail wrap around
      using <code>(i + 1) mod capacity</code>, so freed slots come back into play.</p>
      <div class="callout">In JavaScript, <code>Array.shift()</code> is <code>O(n)</code> because
      every remaining element slides down. A real O(1) queue keeps a head pointer or uses a linked list.</div>
      <h4>Why it matters for graphs</h4>
      <p>Breadth-first search is exactly a queue in action. Because the queue preserves arrival order,
      BFS drains every vertex at distance <code>d</code> before it reaches any vertex at distance
      <code>d + 1</code> — that is what makes it find shortest paths in an unweighted graph.</p>`,
    complexity: [
      ["Operation", "Time", "Note"],
      ["enqueue", "O(1)", "append at tail"],
      ["dequeue", "O(1)", "with head pointer"],
      ["front", "O(1)", "read only"],
      ["naive shift()", "O(n)", "shifts every element"],
    ],
    pseudo: [
      "ENQUEUE(Q, x)",
      "  Q[Q.tail] = x",
      "  Q.tail = (Q.tail + 1) mod Q.capacity",
      "",
      "DEQUEUE(Q)",
      "  x = Q[Q.head]",
      "  Q.head = (Q.head + 1) mod Q.capacity",
      "  return x",
    ],
    legend: [
      { color: C.idle, label: "waiting" },
      { color: C.active, label: "head (next out)" },
      { color: C.purple, label: "tail (last in)" },
      { color: C.done, label: "just enqueued" },
      { color: C.bad, label: "leaving" },
    ],

    mount(ctx) {
      ensureDefs(ctx.svg);
      let items = [{ key: "q1", value: 3 }, { key: "q2", value: 9 }, { key: "q3", value: 14 }];
      let uid = 4;

      const refs = DSA.controls(ctx.controls, [
        { type: "input", name: "val", label: "value", inputType: "number", value: 21 },
        { type: "button", label: "Enqueue", onClick: () => doEnq() },
        { type: "button", label: "Dequeue", variant: "danger", onClick: () => doDeq() },
        { type: "button", label: "Front", variant: "alt", onClick: () => doFront() },
        { type: "button", label: "Clear", onClick: () => { items = []; ctx.load([mk(items, "Queue cleared.", null, {})]); } },
      ]);

      const mk = (state, msg, line, opts) => ({ state: DSA.clone(state), msg, line, opts: opts || {} });

      function doEnq() {
        const v = DSA.readInt(refs.val, 0);
        const node = { key: "q" + uid++, value: v };
        const after = items.concat([node]);
        ctx.load([
          mk(items, `Enqueue <b>${v}</b> — write it at the tail position.`, 1),
          mk(after, `Advance tail. <b>${v}</b> now waits at the back.`, 2,
            { hotKey: node.key, hotFill: "#cdf0df", hotStroke: C.done, hotTag: "new tail" }),
          mk(after, `Queue length is ${after.length}. Head is unchanged.`, 2),
        ]);
        items = after;
      }

      function doDeq() {
        if (!items.length) {
          ctx.load([mk(items, "Queue is empty — nothing to dequeue.", 5, { error: true })]);
          return;
        }
        const head = items[0];
        const after = items.slice(1);
        ctx.load([
          mk(items, `Dequeue reads the head: <b>${head.value}</b>.`, 5,
            { hotKey: head.key, hotFill: "#fde2e8", hotStroke: C.bad, hotTag: "leaving" }),
          mk(after, `Advance head. Returned <b>${head.value}</b>; ${after.length} left.`, 6),
        ]);
        items = after;
      }

      function doFront() {
        if (!items.length) { ctx.load([mk(items, "Queue is empty.", null, {})]); return; }
        ctx.load([mk(items, `Front of the queue is <b>${items[0].value}</b> — read, not removed.`, null,
          { hotKey: items[0].key, hotFill: "#d2eef8", hotStroke: C.visit, hotTag: "front" })]);
      }

      ctx.render = function (f) {
        const scene = ctx.scene;
        scene.begin();
        const state = f.state;
        const cs = state.map((it, i) => {
          const isHead = i === 0, isTail = i === state.length - 1;
          const hot = f.opts.hotKey === it.key;
          let stroke = C.idleLine, fill = C.idle, tag = null;
          if (isHead) { stroke = C.active; fill = "#dae9f7"; tag = "head"; }
          if (isTail && state.length > 1) { stroke = C.purple; fill = "#ece2fb"; tag = "tail"; }
          if (isHead && isTail) { tag = "head + tail"; }
          if (hot) { stroke = f.opts.hotStroke; fill = f.opts.hotFill; tag = f.opts.hotTag; }
          return { key: it.key, value: it.value, index: i, tag, fill, stroke, bold: hot || isHead || isTail };
        });
        drawRow(scene, cs, { y: 0 });

        const total = Math.max(state.length, 1);
        const rowW = total * (BOX_W + GAP) - GAP;
        // direction cues
        scene.put("inLabel", "text", { class: "n-label", x: rowW + 52, y: BOX_H / 2, fill: C.purple, "font-size": 12 }, "← in");
        scene.put("outLabel", "text", { class: "n-label", x: -44, y: BOX_H / 2, fill: C.active, "font-size": 12 }, "out →");
        scene.end();
        DSA.fit(ctx.svg, -84, -40, rowW + 92, BOX_H + 34, 16);
        ctx.trace.innerHTML =
          DSA.chips("queue (head → tail):", state.map((s) => s.value)) +
          `<div style="margin-top:4px;color:var(--dim)">length ${state.length}</div>`;
      };

      ctx.load([mk(items, "A queue with three waiting items. Items exit left, enter right.", null, {})]);
    },

    code: {
      exports: ["Queue"],
      starter: `// A queue with O(1) dequeue.
// Never shift the whole list — keep a head index and move it forward.
class Queue {
  private ArrayList<Integer> items = new ArrayList<>();
  private int head = 0;

  void enqueue(int v) {
    // append at the tail
  }

  Integer dequeue() {
    // return the item at head and advance head, or null if empty
  }

  Integer front() {
    // read the head item without removing it
  }

  int size() {
    return items.size() - head;
  }

  boolean isEmpty() {
    return size() == 0;
  }
}`,
      solution: `class Queue {
  private ArrayList<Integer> items = new ArrayList<>();
  private int head = 0;

  void enqueue(int v) {
    items.add(v);
  }

  Integer dequeue() {
    if (size() == 0) return null;
    Integer v = items.get(head);
    head = head + 1;
    return v;
  }

  Integer front() {
    if (size() == 0) return null;
    return items.get(head);
  }

  int size() {
    return items.size() - head;
  }

  boolean isEmpty() {
    return size() == 0;
  }
}`,
      tests: [
        {
          name: "dequeue returns items in FIFO order",
          run(x, a) {
            const q = new x.Queue();
            [1, 2, 3].forEach((v) => q.enqueue(v));
            a.eq([q.dequeue(), q.dequeue(), q.dequeue()], [1, 2, 3], "order should be");
          },
        },
        {
          name: "size tracks pending items correctly",
          run(x, a) {
            const q = new x.Queue();
            q.enqueue(1); q.enqueue(2);
            q.dequeue();
            a.eq(q.size(), 1, "size() should be");
          },
        },
        {
          name: "front reads without consuming",
          run(x, a) {
            const q = new x.Queue();
            q.enqueue(7); q.enqueue(8);
            a.eq(q.front(), 7, "front() should be");
            a.eq(q.size(), 2, "size() should be");
          },
        },
        {
          name: "empty queue behaves safely",
          run(x, a) {
            const q = new x.Queue();
            a.eq(q.dequeue(), null, "empty dequeue() should be");
            a.eq(q.isEmpty(), true, "isEmpty() should be");
          },
        },
        {
          name: "interleaved enqueue and dequeue stay in order",
          run(x, a) {
            const q = new x.Queue();
            q.enqueue(1); q.enqueue(2);
            a.eq(q.dequeue(), 1, "first out should be");
            q.enqueue(3);
            a.eq([q.dequeue(), q.dequeue()], [2, 3], "remaining order should be");
          },
        },
      ],
    },

    quiz: [
      {
        q: "Enqueue 5, 6, 7 then dequeue twice. What comes out second?",
        options: ["5", "6", "7", "nothing"],
        answer: 1,
        why: "5 leaves first, then 6 — arrival order is preserved.",
      },
      {
        q: "Why does a fixed-size queue wrap head and tail around modulo capacity?",
        options: [
          "To keep the queue sorted",
          "To reuse slots freed at the front instead of leaking them",
          "To make enqueue O(log n)",
          "To allow duplicate values",
        ],
        answer: 1,
        why: "Without wrapping, the space in front of head is stranded and the queue falsely reports full.",
      },
      {
        q: "Which traversal depends on a queue?",
        options: ["Depth-first search", "Breadth-first search", "Binary search", "Quicksort"],
        answer: 1,
        why: "BFS drains one level at a time, and the queue is what preserves that level order.",
      },
    ],
  });

  /* ================================================================
   * 1.3 SINGLY LINKED LIST
   * ============================================================== */
  DSA.lesson({
    id: "sll",
    module: MOD,
    title: "Singly linked list",
    blurb:
      "Nodes scattered in memory, chained by next pointers. Splicing is O(1) — but only once you have found the node.",
    tags: ["insert head O(1)", "search O(n)", "pointer rewiring"],
    notes: `
      <h4>Structure</h4>
      <p>Each node stores a value and a single pointer <code>next</code>. The list knows only its
      <code>head</code>; the last node points at <code>NIL</code>. There is no index arithmetic —
      the only way to reach position <i>k</i> is to walk <i>k</i> links.</p>
      <h4>Insert at head</h4>
      <span class="rule">x.next = L.head
L.head = x</span>
      <p>Two assignments, no shifting, so this is <code>O(1)</code>. <b>Order matters</b>: if you set
      <code>L.head = x</code> first, you lose the pointer to the old front and orphan the whole list.</p>
      <h4>Delete</h4>
      <p>To unlink a node you must know its <b>predecessor</b>, because the predecessor is what holds
      the pointer you need to redirect:</p>
      <span class="rule">prev.next = x.next</span>
      <p>Finding that predecessor costs <code>O(n)</code> in a singly linked list — which is exactly
      the problem a doubly linked list solves.</p>
      <div class="callout warn">Array vs list: arrays give O(1) random access but O(n) insertion in
      the middle. Linked lists flip that trade — O(n) access, O(1) splice once positioned.</div>`,
    complexity: [
      ["Operation", "Time", "Note"],
      ["insert head", "O(1)", "two pointer writes"],
      ["search", "O(n)", "must walk the chain"],
      ["delete (given prev)", "O(1)", "one pointer write"],
      ["delete (by value)", "O(n)", "search dominates"],
      ["access index k", "O(n)", "no random access"],
    ],
    pseudo: [
      "LIST-SEARCH(L, k)",
      "  x = L.head",
      "  while x != NIL and x.key != k",
      "      x = x.next",
      "  return x",
      "",
      "LIST-INSERT-HEAD(L, x)",
      "  x.next = L.head",
      "  L.head = x",
      "",
      "LIST-DELETE(L, prev, x)",
      "  if prev == NIL",
      "      L.head = x.next",
      "  else",
      "      prev.next = x.next",
    ],
    legend: [
      { color: C.idle, label: "node" },
      { color: C.visit, label: "cursor x" },
      { color: C.done, label: "found / inserted" },
      { color: C.bad, label: "being removed" },
      { color: C.warn, label: "pointer rewired" },
    ],

    mount(ctx) {
      ensureDefs(ctx.svg);
      let nodes = [{ key: "n1", value: 4 }, { key: "n2", value: 11 }, { key: "n3", value: 8 }];
      let uid = 4;

      const refs = DSA.controls(ctx.controls, [
        { type: "input", name: "val", label: "value", inputType: "number", value: 6 },
        { type: "button", label: "Insert head", onClick: () => doInsert() },
        { type: "button", label: "Search", variant: "alt", onClick: () => doSearch() },
        { type: "button", label: "Delete", variant: "danger", onClick: () => doDelete() },
        { type: "button", label: "Reset", onClick: () => {
            nodes = [{ key: "n1", value: 4 }, { key: "n2", value: 11 }, { key: "n3", value: 8 }];
            uid = 4; ctx.load([mk(nodes, "List reset.", null, {})]);
          } },
      ]);

      const mk = (state, msg, line, opts) => ({ state: DSA.clone(state), msg, line, opts: opts || {} });

      function doInsert() {
        const v = DSA.readInt(refs.val, 0);
        const node = { key: "n" + uid++, value: v };
        const after = [node].concat(nodes);
        ctx.load([
          mk(nodes, `Insert <b>${v}</b> at the head. First: <b>x.next = L.head</b>.`, 7),
          mk(after, `<b>${v}</b> now points at the old front. The list is still reachable.`, 7,
            { hotKey: node.key, kind: "new", rewire: node.key }),
          mk(after, `Now <b>L.head = x</b>. Insertion done in O(1).`, 8, { hotKey: node.key, kind: "done" }),
        ]);
        nodes = after;
      }

      function doSearch() {
        const target = DSA.readInt(refs.val, 0);
        const F = [mk(nodes, `Search for <b>${target}</b>. Start the cursor at <b>L.head</b>.`, 1)];
        let found = false;
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          if (n.value === target) {
            F.push(mk(nodes, `<b>${n.value} == ${target}</b> — found at position ${i}.`, 4,
              { hotKey: n.key, kind: "done" }));
            found = true;
            break;
          }
          F.push(mk(nodes, `Compare <b>${n.value}</b> with <b>${target}</b> — no match, follow next.`, 2,
            { hotKey: n.key, kind: "visit" }));
        }
        if (!found)
          F.push(mk(nodes, `Reached <b>NIL</b> without a match. Search returns NIL after ${nodes.length} steps.`, 4,
            { atNil: true }));
        ctx.load(F);
      }

      function doDelete() {
        const target = DSA.readInt(refs.val, 0);
        const idx = nodes.findIndex((n) => n.value === target);
        if (idx < 0) {
          ctx.load([mk(nodes, `No node holds <b>${target}</b> — nothing to delete.`, null, { error: true })]);
          return;
        }
        const F = [];
        for (let i = 0; i < idx; i++)
          F.push(mk(nodes, `Walking to find the predecessor — at <b>${nodes[i].value}</b>.`, 2,
            { hotKey: nodes[i].key, kind: "visit" }));
        const victim = nodes[idx];
        F.push(mk(nodes, `Found <b>${target}</b>. Its predecessor is ${idx === 0 ? "<b>NIL</b> (it is the head)" : `<b>${nodes[idx - 1].value}</b>`}.`,
          idx === 0 ? 11 : 13, { hotKey: victim.key, kind: "remove", prevKey: idx > 0 ? nodes[idx - 1].key : null }));
        const after = nodes.filter((_, i) => i !== idx);
        F.push(mk(after, idx === 0
          ? `<b>L.head = x.next</b> — the head moved on.`
          : `<b>prev.next = x.next</b> — the chain now skips over ${target}.`,
          idx === 0 ? 12 : 14, { rewire: idx > 0 ? nodes[idx - 1].key : null }));
        nodes = after;
        ctx.load(F);
      }

      ctx.render = function (f) {
        const scene = ctx.scene;
        scene.begin();
        const state = f.state, o = f.opts;
        const step = BOX_W + 54;

        state.forEach((n, i) => {
          const x = i * step;
          let fill = C.idle, stroke = C.idleLine, tag = i === 0 ? "head" : null, tagFill = C.active;
          if (o.prevKey === n.key) { stroke = C.warn; fill = "#fcefd4"; tag = "prev"; tagFill = C.warn; }
          if (o.hotKey === n.key) {
            if (o.kind === "visit") { stroke = C.visit; fill = "#d2eef8"; tag = "x"; tagFill = C.visit; }
            else if (o.kind === "done" || o.kind === "new") { stroke = C.done; fill = "#cdf0df"; tag = i === 0 ? "head · x" : "x"; tagFill = C.done; }
            else if (o.kind === "remove") { stroke = C.bad; fill = "#fde2e8"; tag = "x (remove)"; tagFill = C.bad; }
          }
          scene.put(`b-${n.key}`, "rect", {
            class: "n-box", x, y: 0, width: BOX_W, height: BOX_H, rx: 9,
            fill, stroke, "stroke-width": o.hotKey === n.key || o.prevKey === n.key ? 2.5 : 1.5,
          });
          scene.put(`v-${n.key}`, "text",
            { class: "n-label", x: x + BOX_W / 2, y: BOX_H / 2, fill: "#12291f", "font-size": 15 }, n.value);
          if (tag)
            scene.put(`t-${n.key}`, "text",
              { class: "n-label", x: x + BOX_W / 2, y: -16, fill: tagFill, "font-size": 11 }, tag);

          const hotArrow = o.rewire === n.key;
          scene.put(`a-${n.key}`, "path", {
            class: "n-edge",
            d: `M ${x + BOX_W + 4} ${BOX_H / 2} L ${x + step - 6} ${BOX_H / 2}`,
            stroke: hotArrow ? C.warn : "#7fae95",
            "stroke-width": hotArrow ? 3 : 2,
            fill: "none",
            "marker-end": hotArrow ? "url(#arwHot)" : "url(#arw)",
          });
        });

        const nilX = state.length * step;
        scene.put("nil", "text", {
          class: "n-label", x: nilX + 16, y: BOX_H / 2,
          fill: o.atNil ? C.visit : "#7d9a8b", "font-size": 13, "text-anchor": "start",
        }, "NIL");
        scene.end();
        DSA.fit(ctx.svg, -20, -44, nilX + 62, BOX_H + 20, 18);

        ctx.trace.innerHTML =
          DSA.chips("list:", state.map((n) => n.value), "empty list") +
          `<div style="margin-top:4px;color:var(--dim)">${state.length} node(s) — head is on the left</div>`;
      };

      ctx.load([mk(nodes, "A three-node chain. Every node knows only the one after it.", null, {})]);
    },

    code: {
      exports: ["LinkedList", "Node"],
      starter: `// Singly linked list.
class Node {
  int value;
  Node next;
  Node(int value) {
    this.value = value;
    this.next = null;
  }
}

class LinkedList {
  Node head = null;
  int length = 0;

  void insertHead(int value) {
    // point the new node at the old head, THEN move head
  }

  Node search(int value) {
    // return the node holding value, or null
  }

  boolean remove(int value) {
    // unlink the first node holding value; return true if removed
  }

  ArrayList<Integer> toArray() {
    ArrayList<Integer> out = new ArrayList<>();
    Node cur = head;
    while (cur != null) {
      out.add(cur.value);
      cur = cur.next;
    }
    return out;
  }
}`,
      solution: `class Node {
  int value;
  Node next;
  Node(int value) {
    this.value = value;
    this.next = null;
  }
}

class LinkedList {
  Node head = null;
  int length = 0;

  void insertHead(int value) {
    Node x = new Node(value);
    x.next = head;
    head = x;
    length = length + 1;
  }

  Node search(int value) {
    Node cur = head;
    while (cur != null && cur.value != value) cur = cur.next;
    return cur;
  }

  boolean remove(int value) {
    Node cur = head;
    Node prev = null;
    while (cur != null && cur.value != value) {
      prev = cur;
      cur = cur.next;
    }
    if (cur == null) return false;
    if (prev == null) head = cur.next;
    else prev.next = cur.next;
    length = length - 1;
    return true;
  }

  ArrayList<Integer> toArray() {
    ArrayList<Integer> out = new ArrayList<>();
    Node cur = head;
    while (cur != null) {
      out.add(cur.value);
      cur = cur.next;
    }
    return out;
  }
}`,
      tests: [
        {
          name: "insertHead puts the newest value in front",
          run(x, a) {
            const l = new x.LinkedList();
            l.insertHead(1); l.insertHead(2); l.insertHead(3);
            a.eq(l.toArray(), [3, 2, 1], "list should be");
          },
        },
        {
          name: "insertHead keeps length in sync",
          run(x, a) {
            const l = new x.LinkedList();
            l.insertHead(4); l.insertHead(5);
            a.eq(l.length, 2, "length should be");
          },
        },
        {
          name: "search finds an existing node and misses correctly",
          run(x, a) {
            const l = new x.LinkedList();
            [1, 2, 3].forEach((v) => l.insertHead(v));
            const n = l.search(2);
            a.ok(n && n.value === 2, "search(2) should return the node holding 2");
            a.eq(l.search(99), null, "search(99) should be");
          },
        },
        {
          name: "remove unlinks a middle node",
          run(x, a) {
            const l = new x.LinkedList();
            [1, 2, 3].forEach((v) => l.insertHead(v)); // 3,2,1
            a.eq(l.remove(2), true, "remove(2) should be");
            a.eq(l.toArray(), [3, 1], "list should be");
          },
        },
        {
          name: "remove handles the head and a missing value",
          run(x, a) {
            const l = new x.LinkedList();
            [1, 2].forEach((v) => l.insertHead(v)); // 2,1
            a.eq(l.remove(2), true, "removing the head should be");
            a.eq(l.toArray(), [1], "list should be");
            a.eq(l.remove(42), false, "removing a missing value should be");
          },
        },
      ],
    },

    quiz: [
      {
        q: "In <code>insertHead</code>, why must <code>x.next = L.head</code> come before <code>L.head = x</code>?",
        options: [
          "It reads better that way",
          "Otherwise the pointer to the old front is lost and the rest of the list is orphaned",
          "Otherwise the length is wrong",
          "The order makes no difference",
        ],
        answer: 1,
        why: "Overwriting head first destroys the only reference to the existing chain.",
      },
      {
        q: "Deleting a known node from a singly linked list is O(n). Why?",
        options: [
          "Because freeing memory is slow",
          "Because you must walk the list to find its predecessor",
          "Because every node must be copied",
          "Because the list must be re-sorted",
        ],
        answer: 1,
        why: "The predecessor holds the pointer you need to redirect, and a singly linked node cannot look backwards.",
      },
      {
        q: "Which operation is a linked list clearly worse at than an array?",
        options: [
          "Inserting at the front",
          "Reading the element at index 5000",
          "Growing without reallocating",
          "Splicing out a node you already hold",
        ],
        answer: 1,
        why: "Arrays index in O(1); a list must follow 5000 next pointers.",
      },
    ],
  });

  /* ================================================================
   * 1.4 DOUBLY LINKED LIST — pseudocode straight from the notes
   * ============================================================== */
  DSA.lesson({
    id: "dll",
    module: MOD,
    title: "Doubly linked list",
    blurb:
      "Adding a prev pointer makes deletion truly O(1) — the node itself now knows both neighbours.",
    tags: ["prev + next", "delete O(1)", "guards for NIL"],
    notes: `
      <h4>Why add <code>prev</code>?</h4>
      <p>In a singly linked list the expensive part of deletion is finding the predecessor. A doubly
      linked node stores it directly, so given <code>x</code> you can splice it out immediately.</p>
      <h4>Delete — from the notes</h4>
      <span class="rule">DELETE(L, x)
  if x.prev != NIL
      x.prev.next = x.next
  else
      L.head = x.next
  if x.next != NIL
      x.next.prev = x.prev</span>
      <p>Read it as two independent repairs. The first fixes the <b>forward</b> link coming into
      <code>x</code>; the second fixes the <b>backward</b> link coming out of it. Each has a NIL guard
      because <code>x</code> may sit at either end.</p>
      <h4>Insert at head — from the notes</h4>
      <span class="rule">INSERT(L, x)
  x.next = L.head
  if L.head != NIL
      L.head.prev = x
  x.prev = NIL
  L.head = x</span>
      <div class="callout">Four writes, all constant time. The <code>if L.head</code> guard covers
      inserting into an empty list, where there is no old head to point back at <code>x</code>.</div>
      <h4>Sentinels</h4>
      <p>Production implementations often add a dummy <b>sentinel</b> node so <code>prev</code> and
      <code>next</code> are never NIL. All four branches above then collapse into straight-line code.</p>`,
    complexity: [
      ["Operation", "Time", "Note"],
      ["insert head", "O(1)", "4 pointer writes"],
      ["delete given x", "O(1)", "no search needed"],
      ["search", "O(n)", "still a walk"],
      ["traverse backwards", "O(n)", "impossible when singly linked"],
      ["memory per node", "+1 pointer", "the cost of the trade"],
    ],
    pseudo: [
      "DELETE(L, x)",
      "  if x.prev != NIL",
      "      x.prev.next = x.next",
      "  else",
      "      L.head = x.next",
      "  if x.next != NIL",
      "      x.next.prev = x.prev",
      "",
      "INSERT(L, x)",
      "  x.next = L.head",
      "  if L.head != NIL",
      "      L.head.prev = x",
      "  x.prev = NIL",
      "  L.head = x",
    ],
    legend: [
      { color: C.idle, label: "node" },
      { color: C.bad, label: "x (target)" },
      { color: C.warn, label: "neighbour being repaired" },
      { color: C.done, label: "inserted" },
    ],

    mount(ctx) {
      ensureDefs(ctx.svg);
      let nodes = [{ key: "d1", value: 5 }, { key: "d2", value: 9 }, { key: "d3", value: 13 }, { key: "d4", value: 2 }];
      let uid = 5;

      const refs = DSA.controls(ctx.controls, [
        { type: "input", name: "val", label: "value", inputType: "number", value: 7 },
        { type: "button", label: "Insert head", onClick: () => doInsert() },
        { type: "button", label: "Delete", variant: "danger", onClick: () => doDelete() },
        { type: "button", label: "Reset", onClick: () => {
            nodes = [{ key: "d1", value: 5 }, { key: "d2", value: 9 }, { key: "d3", value: 13 }, { key: "d4", value: 2 }];
            uid = 5; ctx.load([mk(nodes, "List reset.", null, {})]);
          } },
      ]);

      const mk = (state, msg, line, opts) => ({ state: DSA.clone(state), msg, line, opts: opts || {} });

      function doInsert() {
        const v = DSA.readInt(refs.val, 0);
        const node = { key: "d" + uid++, value: v };
        const after = [node].concat(nodes);
        const F = [
          mk(nodes, `INSERT <b>${v}</b>. Line 1: <b>x.next = L.head</b>.`, 9),
          mk(after, `<b>${v}</b> now points forward at the old head.`, 9,
            { hotKey: node.key, kind: "new", fwd: node.key }),
        ];
        if (nodes.length)
          F.push(mk(after, `L.head is not NIL, so <b>L.head.prev = x</b> — the old head points back.`, 11,
            { hotKey: node.key, kind: "new", neighbour: nodes[0].key, back: nodes[0].key }));
        else
          F.push(mk(after, `L.head was NIL, so the guard skips the back-pointer fix.`, 10, { hotKey: node.key, kind: "new" }));
        F.push(mk(after, `<b>x.prev = NIL</b> and <b>L.head = x</b>. Insert complete in O(1).`, 13,
          { hotKey: node.key, kind: "done" }));
        nodes = after;
        ctx.load(F);
      }

      function doDelete() {
        const target = DSA.readInt(refs.val, 0);
        const idx = nodes.findIndex((n) => n.value === target);
        if (idx < 0) {
          ctx.load([mk(nodes, `No node holds <b>${target}</b>.`, null, { error: true })]);
          return;
        }
        const x = nodes[idx];
        const prev = idx > 0 ? nodes[idx - 1] : null;
        const next = idx < nodes.length - 1 ? nodes[idx + 1] : null;
        const F = [
          mk(nodes, `DELETE <b>${target}</b>. We already hold <b>x</b> — no search needed.`, 0,
            { hotKey: x.key, kind: "remove" }),
        ];
        if (prev)
          F.push(mk(nodes, `<b>x.prev != NIL</b>, so <b>x.prev.next = x.next</b> — ${prev.value} now points past x.`, 2,
            { hotKey: x.key, kind: "remove", neighbour: prev.key, fwd: prev.key }));
        else
          F.push(mk(nodes, `<b>x.prev == NIL</b> — x is the head, so <b>L.head = x.next</b>.`, 4,
            { hotKey: x.key, kind: "remove" }));
        if (next)
          F.push(mk(nodes, `<b>x.next != NIL</b>, so <b>x.next.prev = x.prev</b> — ${next.value} points back past x.`, 6,
            { hotKey: x.key, kind: "remove", neighbour: next.key, back: next.key }));
        else
          F.push(mk(nodes, `<b>x.next == NIL</b> — x was the tail, so no back-pointer to repair.`, 5,
            { hotKey: x.key, kind: "remove" }));
        const after = nodes.filter((_, i) => i !== idx);
        F.push(mk(after, `<b>${target}</b> is unlinked. Both repairs were O(1).`, null, {}));
        nodes = after;
        ctx.load(F);
      }

      ctx.render = function (f) {
        const scene = ctx.scene;
        scene.begin();
        const state = f.state, o = f.opts;
        const step = BOX_W + 66;

        state.forEach((n, i) => {
          const x = i * step;
          let fill = C.idle, stroke = C.idleLine, tag = i === 0 ? "head" : null, tagFill = C.active;
          if (o.neighbour === n.key) { stroke = C.warn; fill = "#fcefd4"; tag = "repair"; tagFill = C.warn; }
          if (o.hotKey === n.key) {
            if (o.kind === "remove") { stroke = C.bad; fill = "#fde2e8"; tag = "x"; tagFill = C.bad; }
            else { stroke = C.done; fill = "#cdf0df"; tag = i === 0 ? "head · x" : "x"; tagFill = C.done; }
          }
          scene.put(`b-${n.key}`, "rect", {
            class: "n-box", x, y: 0, width: BOX_W, height: BOX_H, rx: 9, fill, stroke,
            "stroke-width": o.hotKey === n.key || o.neighbour === n.key ? 2.5 : 1.5,
          });
          scene.put(`v-${n.key}`, "text",
            { class: "n-label", x: x + BOX_W / 2, y: BOX_H / 2, fill: "#12291f", "font-size": 15 }, n.value);
          if (tag)
            scene.put(`t-${n.key}`, "text",
              { class: "n-label", x: x + BOX_W / 2, y: -18, fill: tagFill, "font-size": 11 }, tag);

          if (i < state.length - 1) {
            const hotF = o.fwd === n.key;
            scene.put(`fw-${n.key}`, "path", {
              class: "n-edge",
              d: `M ${x + BOX_W + 4} ${BOX_H / 2 - 8} L ${x + step - 6} ${BOX_H / 2 - 8}`,
              stroke: hotF ? C.warn : "#7fae95", "stroke-width": hotF ? 3 : 2, fill: "none",
              "marker-end": hotF ? "url(#arwHot)" : "url(#arw)",
            });
            const nextKey = state[i + 1].key;
            const hotB = o.back === nextKey;
            scene.put(`bw-${nextKey}`, "path", {
              class: "n-edge",
              d: `M ${x + step - 6} ${BOX_H / 2 + 8} L ${x + BOX_W + 4} ${BOX_H / 2 + 8}`,
              stroke: hotB ? C.warn : "#a8cbb8", "stroke-width": hotB ? 3 : 1.6, fill: "none",
              "marker-end": hotB ? "url(#arwHot)" : "url(#arw)",
            });
          }
        });

        // Terminal NIL pointers: tail.next on the forward lane, head.prev on the back lane.
        const NIL_ARROW = 34, NIL_TEXT = 46;
        const lastRight = state.length ? (state.length - 1) * step + BOX_W : 0;
        const firstLeft = 0;

        if (state.length) {
          scene.put("fw-nil", "path", {
            class: "n-edge",
            d: `M ${lastRight + 4} ${BOX_H / 2 - 8} L ${lastRight + NIL_ARROW} ${BOX_H / 2 - 8}`,
            stroke: "#7fae95", "stroke-width": 2, fill: "none", "marker-end": "url(#arw)",
          });
          scene.put("bw-nil", "path", {
            class: "n-edge",
            d: `M ${firstLeft - 4} ${BOX_H / 2 + 8} L ${firstLeft - NIL_ARROW} ${BOX_H / 2 + 8}`,
            stroke: "#a8cbb8", "stroke-width": 1.6, fill: "none", "marker-end": "url(#arw)",
          });
        }

        scene.put("nilR", "text",
          { class: "n-label", x: lastRight + NIL_TEXT, y: BOX_H / 2, fill: "#7d9a8b", "font-size": 12, "text-anchor": "start" }, "NIL");
        scene.put("nilL", "text",
          { class: "n-label", x: firstLeft - NIL_TEXT, y: BOX_H / 2, fill: "#7d9a8b", "font-size": 12, "text-anchor": "end" }, "NIL");
        scene.end();
        DSA.fit(ctx.svg, -76, -46, lastRight + 76, BOX_H + 20, 18);

        ctx.trace.innerHTML =
          DSA.chips("list:", state.map((n) => n.value), "empty list") +
          `<div style="margin-top:4px;color:var(--dim)">each node stores prev and next</div>`;
      };

      ctx.load([mk(nodes, "Four nodes, each linked in both directions.", null, {})]);
    },

    code: {
      exports: ["DoublyLinkedList", "DNode"],
      starter: `// Follow the pseudocode from the notes exactly.
class DNode {
  int value;
  DNode prev;
  DNode next;
  DNode(int value) {
    this.value = value;
  }
}

class DoublyLinkedList {
  DNode head = null;
  int length = 0;

  // x.next = L.head
  // if L.head != NIL then L.head.prev = x
  // x.prev = NIL
  // L.head = x
  DNode insert(int value) {
    // build the node, wire it in, return it
  }

  // if x.prev != NIL then x.prev.next = x.next else L.head = x.next
  // if x.next != NIL then x.next.prev = x.prev
  boolean delete(DNode node) {
    // unlink the given node
  }

  DNode find(int value) {
    DNode cur = head;
    while (cur != null && cur.value != value) cur = cur.next;
    return cur;
  }

  ArrayList<Integer> toArray() {
    ArrayList<Integer> out = new ArrayList<>();
    DNode cur = head;
    while (cur != null) {
      out.add(cur.value);
      cur = cur.next;
    }
    return out;
  }

  ArrayList<Integer> toArrayReverse() {
    ArrayList<Integer> out = new ArrayList<>();
    DNode cur = head;
    if (cur == null) return out;
    while (cur.next != null) cur = cur.next;
    while (cur != null) {
      out.add(cur.value);
      cur = cur.prev;
    }
    return out;
  }
}`,
      solution: `class DNode {
  int value;
  DNode prev;
  DNode next;
  DNode(int value) {
    this.value = value;
  }
}

class DoublyLinkedList {
  DNode head = null;
  int length = 0;

  DNode insert(int value) {
    DNode x = new DNode(value);
    x.next = head;
    if (head != null) head.prev = x;
    x.prev = null;
    head = x;
    length = length + 1;
    return x;
  }

  boolean delete(DNode node) {
    if (node == null) return false;
    if (node.prev != null) node.prev.next = node.next;
    else head = node.next;
    if (node.next != null) node.next.prev = node.prev;
    length = length - 1;
    return true;
  }

  DNode find(int value) {
    DNode cur = head;
    while (cur != null && cur.value != value) cur = cur.next;
    return cur;
  }

  ArrayList<Integer> toArray() {
    ArrayList<Integer> out = new ArrayList<>();
    DNode cur = head;
    while (cur != null) {
      out.add(cur.value);
      cur = cur.next;
    }
    return out;
  }

  ArrayList<Integer> toArrayReverse() {
    ArrayList<Integer> out = new ArrayList<>();
    DNode cur = head;
    if (cur == null) return out;
    while (cur.next != null) cur = cur.next;
    while (cur != null) {
      out.add(cur.value);
      cur = cur.prev;
    }
    return out;
  }
}`,
      tests: [
        {
          name: "insert builds the list front to back",
          run(x, a) {
            const l = new x.DoublyLinkedList();
            [1, 2, 3].forEach((v) => l.insert(v));
            a.eq(l.toArray(), [3, 2, 1], "forward order should be");
          },
        },
        {
          name: "prev pointers are wired, so reverse traversal works",
          run(x, a) {
            const l = new x.DoublyLinkedList();
            [1, 2, 3].forEach((v) => l.insert(v));
            a.eq(l.toArrayReverse(), [1, 2, 3], "reverse order should be");
          },
        },
        {
          name: "deleting a middle node repairs both directions",
          run(x, a) {
            const l = new x.DoublyLinkedList();
            [1, 2, 3].forEach((v) => l.insert(v)); // 3,2,1
            l.delete(l.find(2));
            a.eq(l.toArray(), [3, 1], "forward should be");
            a.eq(l.toArrayReverse(), [1, 3], "reverse should be");
          },
        },
        {
          name: "deleting the head moves L.head forward",
          run(x, a) {
            const l = new x.DoublyLinkedList();
            [1, 2].forEach((v) => l.insert(v)); // 2,1
            l.delete(l.find(2));
            a.eq(l.toArray(), [1], "forward should be");
            a.eq(l.head.prev, null, "new head prev should be");
          },
        },
        {
          name: "deleting the tail leaves the list intact",
          run(x, a) {
            const l = new x.DoublyLinkedList();
            [1, 2, 3].forEach((v) => l.insert(v)); // 3,2,1
            l.delete(l.find(1));
            a.eq(l.toArray(), [3, 2], "forward should be");
            a.eq(l.toArrayReverse(), [2, 3], "reverse should be");
          },
        },
        {
          name: "insert into an empty list works",
          run(x, a) {
            const l = new x.DoublyLinkedList();
            l.insert(9);
            a.eq(l.toArray(), [9], "list should be");
            a.eq(l.head.next, null, "head next should be");
          },
        },
      ],
    },

    quiz: [
      {
        q: "Why does DELETE guard with <code>if x.prev != NIL</code>?",
        options: [
          "To speed up the common case",
          "Because x might be the head, which has no predecessor to repair",
          "Because prev pointers are optional",
          "To avoid deleting twice",
        ],
        answer: 1,
        why: "When x is the head there is no x.prev to update — instead L.head must move to x.next.",
      },
      {
        q: "What does the doubly linked list buy you over a singly linked one?",
        options: [
          "O(1) random access by index",
          "Less memory per node",
          "O(1) deletion of a node you already hold, plus backward traversal",
          "Automatically sorted order",
        ],
        answer: 2,
        why: "The prev pointer removes the O(n) predecessor search and lets you walk backwards — at the cost of one extra pointer per node.",
      },
      {
        q: "In INSERT, what is the <code>if L.head != NIL</code> guard protecting against?",
        options: [
          "Inserting a duplicate value",
          "Writing prev on a head that does not exist (empty list)",
          "Exceeding capacity",
          "Losing the tail pointer",
        ],
        answer: 1,
        why: "On an empty list there is no old head, so L.head.prev would dereference NIL.",
      },
    ],
  });
})();
