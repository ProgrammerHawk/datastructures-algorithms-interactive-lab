/* App shell: lesson registry, routing, player wiring, quiz, progress. */
(function () {
  const DSA = (window.DSA = window.DSA || {});
  const $ = DSA.$;

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    const svg = $("#stage");
    const scene = new DSA.Scene(svg);
    const editor = new DSA.Editor($("#editor"), $("#hl"), $("#gutter"));

    const state = {
      lesson: null,
      ctx: null,
      done: loadProgress(),
      codeCache: {},
    };

    /* ---------- player ---------- */
    const player = new DSA.Player({
      onFrame(frame) {
        const ctx = state.ctx;
        if (!ctx || !ctx.render) return;
        ctx.render(frame);
        $("#caption").innerHTML = frame.msg || "";
        DSA.highlightLine($("#pseudo"), frame.line);
      },
      onUpdate(p) {
        $("#pPlay").textContent = p.playing ? "⏸" : "▶";
        $("#pCount").textContent = `${p.length ? p.i + 1 : 0} / ${p.length}`;
        const scrub = $("#pScrub");
        scrub.max = Math.max(0, p.length - 1);
        scrub.value = p.i;
        const single = p.length < 2;
        $("#pPlay").disabled = single;
        $("#pNext").disabled = single || p.i >= p.length - 1;
        $("#pPrev").disabled = single || p.i === 0;
        $("#pStart").disabled = single;
      },
    });

    $("#pPlay").addEventListener("click", () => player.toggle());
    $("#pNext").addEventListener("click", () => { player.pause(); player.next(); });
    $("#pPrev").addEventListener("click", () => player.prev());
    $("#pStart").addEventListener("click", () => player.restart());
    $("#pScrub").addEventListener("input", (e) => player.seek(parseInt(e.target.value, 10)));
    $("#pSpeed").addEventListener("change", (e) => player.setSpeed(parseFloat(e.target.value)));

    document.addEventListener("keydown", (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
      if (e.key === " ") { e.preventDefault(); player.toggle(); }
      else if (e.key === "ArrowRight") { player.pause(); player.next(); }
      else if (e.key === "ArrowLeft") { player.prev(); }
    });

    /* ---------- navigation ---------- */
    buildNav("");
    $("#search").addEventListener("input", (e) => buildNav(e.target.value.trim().toLowerCase()));

    function buildNav(filter) {
      const nav = $("#nav");
      nav.innerHTML = "";
      const groups = {};
      DSA.lessons.forEach((l) => {
        const hay = (l.title + " " + l.module + " " + (l.blurb || "") + " " + (l.tags || []).join(" ")).toLowerCase();
        if (filter && hay.indexOf(filter) < 0) return;
        (groups[l.module] = groups[l.module] || []).push(l);
      });
      const modules = Object.keys(groups);
      if (!modules.length) {
        nav.appendChild(DSA.el("div", { class: "panel-hint", text: "No lessons match.", style: "padding:10px" }));
        return;
      }
      modules.forEach((m) => {
        const g = DSA.el("div", { class: "nav-group" });
        g.appendChild(DSA.el("h4", { text: m }));
        groups[m].forEach((l) => {
          const b = DSA.el("button", {
            class: "nav-item" + (state.lesson && state.lesson.id === l.id ? " active" : "") + (state.done[l.id] ? " done" : ""),
            "data-id": l.id,
          });
          b.appendChild(DSA.el("span", { class: "nav-dot" }));
          b.appendChild(DSA.el("span", { text: l.title }));
          b.addEventListener("click", () => go(l.id));
          g.appendChild(b);
        });
        nav.appendChild(g);
      });
      updateProgress();
    }

    /* ---------- lesson loading ---------- */
    function go(id) {
      const lesson = DSA.lessons.find((l) => l.id === id);
      if (!lesson) return;

      player.pause();
      scene.clear();
      svg.innerHTML = "";
      state.lesson = lesson;

      $("#lessonTitle").textContent = lesson.title;
      $("#lessonBlurb").textContent = lesson.blurb || "";
      $("#crumbModule").textContent = lesson.module;
      $("#crumbLesson").textContent = lesson.title;
      document.title = `${lesson.title} — DSA Lab`;

      const tags = $("#lessonTags");
      tags.innerHTML = "";
      (lesson.tags || []).forEach((t, i) =>
        tags.appendChild(DSA.el("span", { class: "tag" + (i === 1 ? " big-o" : ""), text: t })));

      $("#notes").innerHTML = lesson.notes || "";
      renderComplexity(lesson.complexity);
      DSA.renderPseudo($("#pseudo"), lesson.pseudo || []);
      DSA.legend($("#legend"), lesson.legend || []);
      $("#trace").innerHTML = "";
      $("#caption").textContent = "";
      $("#vizHint").textContent = "space = play/pause · ← → = step";

      // build the lesson's own context
      const ctx = {
        svg, scene,
        controls: $("#controls"),
        trace: $("#trace"),
        render: null,
        load(frames, opts) { player.load(frames, opts); },
      };
      state.ctx = ctx;
      lesson.mount(ctx);

      // playground
      const cached = state.codeCache[lesson.id];
      editor.setValue(cached != null ? cached : (lesson.code && lesson.code.starter) || "");
      $("#testResults").innerHTML = "";
      $("#consoleOut").textContent = "";
      $("#runSummary").textContent = "";
      $("#runSummary").className = "run-summary";

      renderQuiz(lesson);
      markDoneButton();
      DSA.$$(".nav-item").forEach((n) => n.classList.toggle("active", n.dataset.id === id));
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (window.innerWidth <= 900) $("#sidebar").classList.remove("open");
      history.replaceState(null, "", "#" + id);
    }

    function renderComplexity(rows) {
      const host = $("#complexity");
      if (!rows || !rows.length) { host.innerHTML = ""; return; }
      const [head, ...body] = rows;
      let html = "<table><thead><tr>";
      head.forEach((h) => (html += `<th>${DSA.esc(h)}</th>`));
      html += "</tr></thead><tbody>";
      body.forEach((r) => {
        html += "<tr>";
        r.forEach((c) => (html += `<td>${DSA.esc(c)}</td>`));
        html += "</tr>";
      });
      html += "</tbody></table>";
      host.innerHTML = html;
    }

    /* ---------- playground ---------- */
    $("#editor").addEventListener("input", () => {
      if (state.lesson) state.codeCache[state.lesson.id] = editor.getValue();
    });

    $("#runBtn").addEventListener("click", () => {
      const lesson = state.lesson;
      if (!lesson || !lesson.code) return;
      const res = DSA.runTests({
        src: editor.getValue(),
        spec: lesson.code,
        resultsEl: $("#testResults"),
        consoleEl: $("#consoleOut"),
        summaryEl: $("#runSummary"),
      });
      if (res.total && res.passed === res.total) setDone(lesson.id, true);
    });

    $("#resetCode").addEventListener("click", () => {
      const lesson = state.lesson;
      if (!lesson || !lesson.code) return;
      delete state.codeCache[lesson.id];
      editor.setValue(lesson.code.starter || "");
      $("#testResults").innerHTML = "";
      $("#consoleOut").textContent = "";
      $("#runSummary").textContent = "";
    });

    /* ---------- quiz ---------- */
    function renderQuiz(lesson) {
      const host = $("#quiz");
      host.innerHTML = "";
      const qs = lesson.quiz || [];
      let answered = 0, correct = 0;
      $("#quizScore").textContent = qs.length ? `0 / ${qs.length}` : "";
      if (!qs.length) { host.innerHTML = '<div class="panel-hint">No questions for this lesson.</div>'; return; }

      qs.forEach((q, qi) => {
        const card = DSA.el("div", { class: "q" });
        card.appendChild(DSA.el("div", { class: "q-text", html: `<b>${qi + 1}.</b> ${q.q}` }));
        const opts = DSA.el("div", { class: "q-opts" });
        const buttons = [];
        q.options.forEach((opt, oi) => {
          const b = DSA.el("button", { class: "q-opt", html: opt });
          b.addEventListener("click", () => {
            if (b.disabled) return;
            buttons.forEach((x) => (x.disabled = true));
            const right = oi === q.answer;
            b.classList.add(right ? "correct" : "wrong");
            if (!right) buttons[q.answer].classList.add("correct");
            answered++;
            if (right) correct++;
            $("#quizScore").textContent = `${correct} / ${qs.length}`;
            card.appendChild(DSA.el("div", { class: "q-why", html: (right ? "<b>Correct.</b> " : "<b>Not quite.</b> ") + q.why }));
            if (answered === qs.length && correct === qs.length) setDone(lesson.id, true);
          });
          buttons.push(b);
          opts.appendChild(b);
        });
        card.appendChild(opts);
        host.appendChild(card);
      });
    }

    /* ---------- progress ---------- */
    function loadProgress() {
      try { return JSON.parse(localStorage.getItem("dsa-lab-progress") || "{}"); }
      catch (e) { return {}; }
    }
    function saveProgress() {
      try { localStorage.setItem("dsa-lab-progress", JSON.stringify(state.done)); } catch (e) {}
    }
    function setDone(id, v) {
      if (v) state.done[id] = true; else delete state.done[id];
      saveProgress();
      DSA.$$(".nav-item").forEach((n) => n.classList.toggle("done", !!state.done[n.dataset.id]));
      markDoneButton();
      updateProgress();
    }
    function markDoneButton() {
      const b = $("#markDone");
      const isDone = state.lesson && !!state.done[state.lesson.id];
      b.textContent = isDone ? "✓ Completed" : "Mark complete";
      b.classList.toggle("is-done", isDone);
    }
    function updateProgress() {
      const total = DSA.lessons.length;
      const n = DSA.lessons.filter((l) => state.done[l.id]).length;
      $("#progressLabel").textContent = `${n} / ${total}`;
      $("#progressFill").style.width = total ? (n / total) * 100 + "%" : "0%";
    }

    $("#markDone").addEventListener("click", () => {
      if (!state.lesson) return;
      setDone(state.lesson.id, !state.done[state.lesson.id]);
    });
    $("#resetProgress").addEventListener("click", () => {
      state.done = {};
      saveProgress();
      DSA.$$(".nav-item").forEach((n) => n.classList.remove("done"));
      markDoneButton();
      updateProgress();
    });

    /* ---------- prev / next ---------- */
    $("#prevLesson").addEventListener("click", () => step(-1));
    $("#nextLesson").addEventListener("click", () => step(1));
    function step(dir) {
      const i = DSA.lessons.findIndex((l) => state.lesson && l.id === state.lesson.id);
      const j = i + dir;
      if (j >= 0 && j < DSA.lessons.length) go(DSA.lessons[j].id);
    }

    $("#menuBtn").addEventListener("click", () => $("#sidebar").classList.toggle("open"));

    /* ---------- boot ---------- */
    const hash = location.hash.replace("#", "");
    go(DSA.lessons.some((l) => l.id === hash) ? hash : DSA.lessons[0].id);
    updateProgress();
  }
})();
