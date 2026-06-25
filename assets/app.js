/* ============================================================
   Informationsmanagement – Klausur-Lernportal
   Vanilla JS, keine Abhängigkeiten. Daten aus assets/data.js
   ============================================================ */
(function () {
  "use strict";

  const DATA = window.IM_DATA || {};
  const IDS = Object.keys(DATA).sort();
  const SLIDES = window.IM_SLIDES || {};
  const EXAM_DATE = new Date("2026-07-21T09:00:00");
  const VIEWS = ["uebersicht", "themen", "karteikarten", "test", "uebungen", "folien"];
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- Persistenz (localStorage) ---------- */
  const store = {
    get(k, def) { try { const v = JSON.parse(localStorage.getItem("im_" + k)); return v == null ? def : v; } catch { return def; } },
    set(k, v) { try { localStorage.setItem("im_" + k, JSON.stringify(v)); return true; } catch { return false; } }
  };

  /* ---------- kleine Toast-Meldung ---------- */
  let toastTimer = null;
  function toast(msg) {
    let t = $("#imToast");
    if (!t) { t = document.createElement("div"); t.id = "imToast"; t.className = "im-toast"; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2800);
  }

  /* ============================================================
     NAVIGATION (Tabs / Views)
     ============================================================ */
  function showView(name, fromHash) {
    $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + name));
    $$("#tabs .tab").forEach((t) => {
      const on = t.dataset.view === name;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
    });
    if (!fromHash) location.hash = name;
    const at = $("#tabs .tab.active");
    if (at) at.scrollIntoView({ inline: "center", block: "nearest" });
    window.scrollTo({ top: 0, behavior: "smooth" });
    const panel = document.getElementById("view-" + name);
    if (panel) { panel.setAttribute("tabindex", "-1"); try { panel.focus({ preventScroll: true }); } catch {} }
  }
  $$("#tabs .tab").forEach((t) => t.addEventListener("click", () => showView(t.dataset.view)));
  document.addEventListener("click", (e) => {
    const g = e.target.closest("[data-goto]");
    if (g) showView(g.dataset.goto);
  });
  window.addEventListener("hashchange", () => {
    const h = location.hash.replace("#", "");
    if (VIEWS.includes(h)) showView(h, true);
  });

  /* ============================================================
     COUNTDOWN
     ============================================================ */
  function tickCountdown() {
    const now = new Date();
    let diff = Math.max(0, EXAM_DATE - now);
    const d = Math.floor(diff / 864e5);
    const h = Math.floor((diff % 864e5) / 36e5);
    const m = Math.floor((diff % 36e5) / 6e4);
    const s = Math.floor((diff % 6e4) / 1e3);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = String(v).padStart(2, "0"); };
    set("cdDays", d); set("cdHours", h); set("cdMins", m); set("cdSecs", s);
    const mini = $("#cdMiniDays"); if (mini) mini.textContent = d;
  }
  tickCountdown();
  setInterval(tickCountdown, 1000);

  /* ============================================================
     ÜBERSICHT – Stats + Themenkacheln
     ============================================================ */
  function renderStats() {
    let fc = 0, qz = 0, gl = 0;
    IDS.forEach((id) => { fc += DATA[id].flashcards.length; qz += DATA[id].quiz.length; gl += DATA[id].glossary.length; });
    const items = [
      [IDS.length, "Themen"],
      [fc, "Karteikarten"],
      [qz, "Testfragen"],
      [gl, "Fachbegriffe"]
    ];
    $("#stats").innerHTML = items.map(([n, l]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join("");
  }

  function renderTopicGrid() {
    $("#topicGrid").innerHTML = IDS.map((id) => {
      const t = DATA[id];
      return `<button class="topic-card" data-topic="${id}">
        <div class="tc-top"><span class="tc-num">${id}</span><span class="tc-date">${esc(t.date)}</span></div>
        <h3>${esc(t.title)}</h3>
        <p>${esc(t.summary)}</p>
        <div class="tc-foot">
          <span>📝 ${t.flashcards.length} Karten</span>
          <span>❓ ${t.quiz.length} Fragen</span>
        </div>
      </button>`;
    }).join("");
    $$("#topicGrid .topic-card").forEach((c) =>
      c.addEventListener("click", () => { showView("themen"); openTopic(c.dataset.topic); })
    );
  }

  /* ============================================================
     THEMEN – Navigation + Detailansicht + Slide-Viewer
     ============================================================ */
  let currentTopic = null;
  let slideIdx = 1, slideMax = 1, slideTopic = "01", slideToken = 0, swipeFired = false;

  function slidePath(id, n) { return `folien/img/${id}/p${String(n).padStart(3, "0")}.jpg`; }
  function thumbPath(id, n) { return `folien/img/${id}/thumb/p${String(n).padStart(3, "0")}.jpg`; }

  function renderThemenNav() {
    $("#themenNav").innerHTML = IDS.map((id) =>
      `<button class="tn-item" data-topic="${id}"><b>${id}</b><span>${esc(DATA[id].title)}</span></button>`
    ).join("");
    $$("#themenNav .tn-item").forEach((b) => b.addEventListener("click", () => openTopic(b.dataset.topic)));
  }

  function preloadSlide(n) { if (n >= 1 && n <= slideMax) { const im = new Image(); im.src = slidePath(slideTopic, n); } }

  function renderSlide() {
    const img = $("#slideImg");
    if (!img) return;
    const path = slidePath(slideTopic, slideIdx);
    const token = ++slideToken;
    const show = () => { if (token === slideToken) img.src = path; };
    const pre = new Image();
    pre.src = path;
    if (pre.decode) pre.decode().then(show).catch(show);
    else if (pre.complete) show();
    else { pre.onload = show; pre.onerror = show; }

    $("#slideCounter").textContent = `Folie ${slideIdx} / ${slideMax}`;
    $("#slidePrev").disabled = slideIdx <= 1;
    $("#slideNext").disabled = slideIdx >= slideMax;
    $$("#slideThumbs .thumb").forEach((th) => th.classList.toggle("active", +th.dataset.n === slideIdx));
    const strip = $("#slideThumbs"), act = $(`#slideThumbs .thumb[data-n="${slideIdx}"]`);
    if (strip && act) strip.scrollTo({ left: act.offsetLeft - strip.clientWidth / 2 + act.clientWidth / 2, behavior: "smooth" });
    preloadSlide(slideIdx + 1); preloadSlide(slideIdx - 1);
  }

  function gotoSlide(n) {
    slideIdx = Math.min(slideMax, Math.max(1, n));
    renderSlide();
    SlideDraw.loadForCurrent();
  }

  /* ---------- Lightbox ---------- */
  let lastFocus = null;
  function renderLightbox() {
    $("#lightboxImg").src = slidePath(slideTopic, slideIdx);
    $("#lightboxCounter").textContent = `${slideTopic} · Folie ${slideIdx} / ${slideMax}`;
  }
  function openLightbox() {
    if (swipeFired) return;
    lastFocus = document.activeElement;
    renderLightbox();
    const lb = $("#lightbox");
    lb.classList.add("open");
    $("#app").setAttribute("aria-hidden", "true");
    $("header.topbar").setAttribute("aria-hidden", "true");
    setTimeout(() => { try { $("#lightboxClose").focus(); } catch {} }, 30);
  }
  function closeLightbox() {
    const lb = $("#lightbox");
    lb.classList.remove("open");
    $("#app").removeAttribute("aria-hidden");
    $("header.topbar").removeAttribute("aria-hidden");
    SlideDraw.resync();
    if (lastFocus) { try { lastFocus.focus(); } catch {} }
  }

  /* ============================================================
     SLIDE DRAWING – Annotation pro Folie (Vektor-Striche)
     - normierte Koordinaten 0..1 (auflösungs-/größenunabhängig)
     - Offscreen-Base + Live-Blit (scharf, performant, korrekter Marker)
     - idempotentes mount() (kein Listener-/Observer-Leak)
     ============================================================ */
  const SlideDraw = (function () {
    let canvas, ctx, base, bctx, img, slidesEl, toggleBtn, panel;
    let strokes = [], cur = null, drawing = false, enabled = false;
    let tool = "pen", color = "#e2574c";
    let ro = null, globalWired = false;
    const activePointers = new Set();

    const TOOL = {
      pen:   { w: 0.0045, alpha: 1,    cap: "round", comp: "source-over" },
      hl:    { w: 0.026,  alpha: 0.35, cap: "round", comp: "source-over" },
      erase: { w: 0.04,   alpha: 1,    cap: "round", comp: "destination-out" }
    };

    function keyFor() { return "draw_" + slideTopic + "_" + slideIdx; }

    function styleFor(c, s) {
      const cfg = TOOL[s.t] || TOOL.pen;
      c.globalCompositeOperation = cfg.comp;
      c.globalAlpha = cfg.alpha;
      c.strokeStyle = s.c;
      c.fillStyle = s.c;
      c.lineCap = cfg.cap;
      c.lineJoin = "round";
      c.lineWidth = Math.max(1, s.w * c.canvas.width);
    }
    function strokePath(c, s) {
      if (!s.p.length) return;
      styleFor(c, s);
      const W = c.canvas.width, H = c.canvas.height;
      if (s.p.length === 1) {
        c.beginPath();
        c.arc(s.p[0][0] * W, s.p[0][1] * H, Math.max(0.8, c.lineWidth / 2), 0, Math.PI * 2);
        c.fill();
        return;
      }
      c.beginPath();
      c.moveTo(s.p[0][0] * W, s.p[0][1] * H);
      for (let i = 1; i < s.p.length; i++) c.lineTo(s.p[i][0] * W, s.p[i][1] * H);
      c.stroke();
    }
    function rebuildBase() {
      if (!bctx) return;
      bctx.setTransform(1, 0, 0, 1, 0, 0);
      bctx.globalCompositeOperation = "source-over"; bctx.globalAlpha = 1;
      bctx.clearRect(0, 0, base.width, base.height);
      strokes.forEach((s) => strokePath(bctx, s));
    }
    function blit() {
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (base) ctx.drawImage(base, 0, 0);
      if (cur) strokePath(ctx, cur);
    }
    function syncSize() {
      if (!canvas || !img || !img.complete || !img.naturalWidth) return;
      const r = img.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        base.width = w; base.height = h;
      }
      ctx = canvas.getContext("2d");
      bctx = base.getContext("2d");
      rebuildBase();
      blit();
    }
    function toNorm(ev) {
      const r = canvas.getBoundingClientRect();
      let x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
      x = Math.min(1, Math.max(0, x)); y = Math.min(1, Math.max(0, y));
      return [+x.toFixed(4), +y.toFixed(4)];
    }
    function persist() {
      const ok = store.set(keyFor(), strokes.length ? strokes : null);
      if (ok === false) toast("Speicher voll – Zeichnung evtl. nicht dauerhaft gesichert.");
    }

    function onDown(ev) {
      if (!enabled) return;
      if (ev.pointerType === "touch" && activePointers.size > 0) return; // Palm-Rejection
      activePointers.add(ev.pointerId);
      ev.preventDefault();
      try { canvas.setPointerCapture(ev.pointerId); } catch {}
      drawing = true;
      const cfg = TOOL[tool];
      cur = { t: tool, c: color, w: cfg.w, p: [toNorm(ev)] };
      blit();
    }
    function onMove(ev) {
      if (!drawing || !cur) return;
      ev.preventDefault();
      const coalesced = ev.getCoalescedEvents ? ev.getCoalescedEvents() : null;
      const evs = (coalesced && coalesced.length) ? coalesced : [ev];
      let changed = false;
      for (const e of evs) {
        const pt = toNorm(e);
        const last = cur.p[cur.p.length - 1];
        const dx = (pt[0] - last[0]) * canvas.width, dy = (pt[1] - last[1]) * canvas.height;
        if (dx * dx + dy * dy >= 4) { cur.p.push(pt); changed = true; }
      }
      if (changed) blit();
    }
    function onUp(ev) {
      activePointers.delete(ev.pointerId);
      if (!drawing) return;
      drawing = false;
      try { canvas.releasePointerCapture(ev.pointerId); } catch {}
      if (cur && cur.p.length) { strokePath(bctx, cur); strokes.push(cur); persist(); }
      cur = null;
      blit();
    }

    function bindToolbar() {
      toggleBtn.addEventListener("click", () => {
        enabled = !enabled;
        toggleBtn.setAttribute("aria-pressed", String(enabled));
        panel.hidden = !enabled;
        slidesEl.classList.toggle("draw-on", enabled);
      });
      $$("#dtPanel .dt-tool").forEach((b) => b.addEventListener("click", () => {
        tool = b.dataset.tool;
        $$("#dtPanel .dt-tool").forEach((x) => x.classList.toggle("is-active", x === b));
      }));
      $$("#dtPanel .dt-swatch").forEach((b) => b.addEventListener("click", () => {
        color = b.dataset.color;
        $$("#dtPanel .dt-swatch").forEach((x) => x.classList.toggle("is-active", x === b));
        if (tool === "erase") { tool = "pen"; $$("#dtPanel .dt-tool").forEach((x) => x.classList.toggle("is-active", x.dataset.tool === "pen")); }
      }));
      $("#dtUndo").addEventListener("click", () => { strokes.pop(); rebuildBase(); blit(); persist(); });
      $("#dtClear").addEventListener("click", () => {
        if (!strokes.length || confirm("Alle Zeichnungen dieser Folie löschen?")) { strokes = []; rebuildBase(); blit(); persist(); }
      });
    }

    return {
      // pro openTopic aufgerufen – frisches DOM, idempotent
      mount() {
        canvas = $("#slideCanvas"); img = $("#slideImg"); slidesEl = $(".td-slides");
        toggleBtn = $("#dtToggle"); panel = $("#dtPanel");
        if (!canvas || !img) return;
        base = document.createElement("canvas");
        ctx = canvas.getContext("2d"); bctx = base.getContext("2d");
        canvas.addEventListener("pointerdown", onDown);
        canvas.addEventListener("pointermove", onMove);
        canvas.addEventListener("pointerup", onUp);
        canvas.addEventListener("pointercancel", onUp);
        img.addEventListener("load", syncSize);
        if (ro) ro.disconnect();
        if (window.ResizeObserver) { ro = new ResizeObserver(syncSize); ro.observe(img); }
        if (!globalWired) { window.addEventListener("resize", syncSize); globalWired = true; }
        bindToolbar();
        // Zustand zurücksetzen (DOM ist neu)
        enabled = false; drawing = false; cur = null; activePointers.clear();
        tool = "pen";
        slidesEl.classList.remove("draw-on");
        toggleBtn.setAttribute("aria-pressed", "false");
        panel.hidden = true;
        $$("#dtPanel .dt-tool").forEach((x) => x.classList.toggle("is-active", x.dataset.tool === "pen"));
      },
      loadForCurrent() { strokes = store.get(keyFor(), null) || []; syncSize(); },
      resync() { syncSize(); },
      isEnabled() { return enabled; }
    };
  })();

  /* ---------- Swipe / Wisch-Navigation (Pointer Events) ---------- */
  function initSwipe() {
    const el = $("#stageWrap");
    if (!el) return;
    let sx = 0, sy = 0, st = 0, tracking = false, decided = false, horiz = false;
    el.addEventListener("pointerdown", (e) => {
      if (SlideDraw.isEnabled()) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      tracking = true; decided = false; horiz = false;
      sx = e.clientX; sy = e.clientY; st = performance.now();
    });
    el.addEventListener("pointermove", (e) => {
      if (!tracking) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!decided && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        decided = true; horiz = Math.abs(dx) > Math.abs(dy) * 1.4;
      }
      if (horiz) e.preventDefault();
    });
    el.addEventListener("pointerup", (e) => {
      if (!tracking) return; tracking = false;
      if (!horiz) return;
      const dx = e.clientX - sx, dt = performance.now() - st;
      const fast = Math.abs(dx) / dt > 0.45;
      if (Math.abs(dx) > 55 || fast) {
        swipeFired = true; setTimeout(() => { swipeFired = false; }, 350);
        if (dx < 0) gotoSlide(slideIdx + 1); else gotoSlide(slideIdx - 1);
      }
    });
    el.addEventListener("pointercancel", () => { tracking = false; });
  }

  function openTopic(id) {
    if (id === currentTopic && $("#slideImg")) return; // bereits offen
    currentTopic = id;
    const t = DATA[id];
    slideTopic = id; slideMax = SLIDES[id] || 1; slideIdx = 1;
    $$("#themenNav .tn-item").forEach((b) => b.classList.toggle("active", b.dataset.topic === id));

    const secs = t.sections || [];
    const gloss = t.glossary || [];
    const sections = secs.map((s, i) => `
      <details class="td-section" ${i === 0 ? "open" : ""}>
        <summary>${esc(s.heading)}</summary>
        <div class="sec-body"><ul>${(s.points || []).map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>
      </details>`).join("");
    const glossary = gloss.map((g) =>
      `<tr><td>${esc(g.term)}</td><td>${esc(g.definition)}</td></tr>`).join("");
    const thumbs = Array.from({ length: slideMax }, (_, i) =>
      `<img class="thumb" data-n="${i + 1}" loading="lazy" decoding="async" width="120" height="85" src="${thumbPath(id, i + 1)}" alt="Folie ${i + 1}">`).join("");

    $("#themenContent").innerHTML = `
      <article class="topic-detail">
        <div class="td-head">
          <div>
            <h2><span style="color:var(--muted);font-weight:700">${id}.</span> ${esc(t.title)}</h2>
            <span class="td-date">Vorlesung vom ${esc(t.date)} · ${slideMax} Folien</span>
          </div>
          <div class="td-actions">
            <button class="btn btn-small" id="focusToggle" title="Folie groß / klein">🎯 Fokus</button>
            <button class="btn btn-small" data-kk="${id}">Karteikarten</button>
            <a class="btn btn-small" href="folien/${id}.pdf" target="_blank" rel="noopener">PDF ↗</a>
          </div>
        </div>
        <div class="td-summary">${esc(t.summary)}</div>

        <div class="td-split">
          <div class="td-slides">
            <div class="draw-tools" role="toolbar" aria-label="Zeichenwerkzeuge">
              <button class="dt-btn dt-toggle" id="dtToggle" aria-pressed="false" title="Auf der Folie zeichnen">✏️ Zeichnen</button>
              <div class="dt-group" id="dtPanel" hidden>
                <button class="dt-btn dt-tool is-active" data-tool="pen" title="Stift">✏️</button>
                <button class="dt-btn dt-tool" data-tool="hl" title="Textmarker">🖍️</button>
                <button class="dt-btn dt-tool" data-tool="erase" title="Radiergummi">🧽</button>
                <span class="dt-sep"></span>
                <button class="dt-swatch is-active" data-color="#e2574c" style="--sw:#e2574c" title="Rot" aria-label="Rot"></button>
                <button class="dt-swatch" data-color="#2f6df0" style="--sw:#2f6df0" title="Blau" aria-label="Blau"></button>
                <button class="dt-swatch" data-color="#1aa56d" style="--sw:#1aa56d" title="Grün" aria-label="Grün"></button>
                <button class="dt-swatch" data-color="#1c2433" style="--sw:#1c2433" title="Schwarz" aria-label="Schwarz"></button>
                <button class="dt-swatch" data-color="#f2b705" style="--sw:#f2b705" title="Gelb" aria-label="Gelb"></button>
                <span class="dt-sep"></span>
                <button class="dt-btn" id="dtUndo" title="Rückgängig">↶</button>
                <button class="dt-btn" id="dtClear" title="Alles löschen">🗑️</button>
              </div>
            </div>

            <div class="slide-viewer">
              <button class="slide-arrow sa-left" id="slidePrev" aria-label="Vorherige Folie">‹</button>
              <div class="stage-wrap" id="stageWrap">
                <img id="slideImg" alt="Folie" title="Zum Vergrößern tippen">
                <canvas id="slideCanvas" class="slide-canvas"></canvas>
              </div>
              <button class="slide-arrow sa-right" id="slideNext" aria-label="Nächste Folie">›</button>
            </div>

            <div class="slide-bar">
              <span id="slideCounter"></span>
              <span class="slide-hint">← wischen zum Blättern →</span>
              <button class="btn btn-small" id="slideZoom">⤢ Vergrößern</button>
            </div>
            <div class="slide-thumbs" id="slideThumbs">${thumbs}</div>
          </div>

          <div class="td-text">
            <h3 class="td-sub">📖 Zusammenfassung</h3>
            ${sections}
            <h3 class="td-sub">📑 Glossar</h3>
            <table class="glossary"><tbody>${glossary}</tbody></table>
          </div>
        </div>
      </article>`;

    $$("#themenContent [data-kk]").forEach((b) =>
      b.addEventListener("click", () => { showView("karteikarten"); setKKTopic(b.dataset.kk); }));
    $("#slidePrev").addEventListener("click", () => gotoSlide(slideIdx - 1));
    $("#slideNext").addEventListener("click", () => gotoSlide(slideIdx + 1));
    $("#slideImg").addEventListener("click", openLightbox);
    $("#slideZoom").addEventListener("click", openLightbox);
    $$("#slideThumbs .thumb").forEach((th) => th.addEventListener("click", () => gotoSlide(+th.dataset.n)));
    const ft = $("#focusToggle");
    ft.addEventListener("click", () => { $(".td-split").classList.toggle("focus"); ft.classList.toggle("on"); SlideDraw.resync(); });

    SlideDraw.mount();
    renderSlide();
    SlideDraw.loadForCurrent();
    initSwipe();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ============================================================
     KARTEIKARTEN
     ============================================================ */
  let kkCards = [], kkIndex = 0;

  function buildKKList(topic) {
    let cards = [];
    if (topic === "all") {
      IDS.forEach((id) => DATA[id].flashcards.forEach((c, i) => cards.push({ ...c, topic: id, key: id + "-" + i })));
    } else {
      DATA[topic].flashcards.forEach((c, i) => cards.push({ ...c, topic: topic, key: topic + "-" + i }));
    }
    return cards;
  }

  function renderKKTopicSelect() {
    const sel = $("#kkTopic");
    sel.innerHTML = `<option value="all">Alle Themen (${IDS.reduce((a, id) => a + DATA[id].flashcards.length, 0)} Karten)</option>` +
      IDS.map((id) => `<option value="${id}">${id} · ${esc(DATA[id].title)} (${DATA[id].flashcards.length})</option>`).join("");
    sel.addEventListener("change", () => setKKTopic(sel.value));
  }

  function setKKTopic(topic) {
    $("#kkTopic").value = topic;
    kkCards = buildKKList(topic);
    kkIndex = 0;
    renderKKCard();
  }

  function renderKKCard() {
    const card = $("#flashcard");
    card.classList.remove("flipped");
    if (!kkCards.length) { $("#kkFront").textContent = "Keine Karten."; return; }
    const c = kkCards[kkIndex];
    const known = store.get("known", {});
    $("#kkFront").textContent = c.front;
    $("#kkBack").textContent = c.back;
    const tag = DATA[c.topic].title;
    $("#kkTagFront").textContent = c.topic + " · " + tag;
    $("#kkTagBack").textContent = c.topic + " · " + tag;
    $("#kkCounter").textContent = `Karte ${kkIndex + 1} / ${kkCards.length}` +
      (known[c.key] ? "  ·  ✓ gewusst" : "");
    const learned = kkCards.filter((x) => known[x.key]).length;
    $("#kkProgressBar").style.width = (learned / kkCards.length * 100) + "%";
  }

  function flipKK() { $("#flashcard").classList.toggle("flipped"); }
  function nextKK() { if (kkCards.length) { kkIndex = (kkIndex + 1) % kkCards.length; renderKKCard(); } }
  function prevKK() { if (kkCards.length) { kkIndex = (kkIndex - 1 + kkCards.length) % kkCards.length; renderKKCard(); } }
  function rateKK(good) {
    if (!kkCards.length) return;
    const known = store.get("known", {});
    const key = kkCards[kkIndex].key;
    if (good) known[key] = true; else delete known[key];
    store.set("known", known);
    nextKK();
  }

  function initKK() {
    renderKKTopicSelect();
    setKKTopic("all");
    $("#flashcard").addEventListener("click", flipKK);
    $("#kkNext").addEventListener("click", nextKK);
    $("#kkPrev").addEventListener("click", prevKK);
    $("#kkKnown").addEventListener("click", () => rateKK(true));
    $("#kkAgain").addEventListener("click", () => rateKK(false));
    $("#kkShuffle").addEventListener("click", () => { kkCards.sort(() => Math.random() - 0.5); kkIndex = 0; renderKKCard(); });
    $("#kkReset").addEventListener("click", () => { store.set("known", {}); renderKKCard(); });
    document.addEventListener("keydown", (e) => {
      if (!$("#view-karteikarten").classList.contains("active")) return;
      if (e.key === "ArrowRight") nextKK();
      else if (e.key === "ArrowLeft") prevKK();
      else if (e.key === " ") { e.preventDefault(); flipKK(); }
    });
  }

  /* ============================================================
     TEST / QUIZ
     ============================================================ */
  let testQs = [], testIdx = 0, testAnswered = false, testScore = 0, testByTopic = {};

  function renderTestTopics() {
    $("#testTopics").innerHTML = `<span class="chip on" data-t="all">Alle</span>` +
      IDS.map((id) => `<span class="chip on" data-t="${id}">${id} · ${esc(DATA[id].title)}</span>`).join("");
    const chips = $$("#testTopics .chip");
    chips.forEach((ch) => ch.addEventListener("click", () => {
      const t = ch.dataset.t;
      if (t === "all") {
        const turnOn = !ch.classList.contains("on");
        chips.forEach((c) => c.classList.toggle("on", turnOn));
      } else {
        ch.classList.toggle("on");
        $('#testTopics .chip[data-t="all"]').classList.toggle("on",
          chips.filter((c) => c.dataset.t !== "all").every((c) => c.classList.contains("on")));
      }
    }));
  }

  function selectedTestTopics() {
    return $$('#testTopics .chip.on').map((c) => c.dataset.t).filter((t) => t !== "all");
  }

  function startTest() {
    const topics = selectedTestTopics();
    if (!topics.length) { alert("Bitte mindestens ein Thema auswählen."); return; }
    let pool = [];
    topics.forEach((id) => DATA[id].quiz.forEach((q) => pool.push({ ...q, topic: id })));
    pool.sort(() => Math.random() - 0.5);
    const n = parseInt($("#testCount").value, 10);
    testQs = n > 0 ? pool.slice(0, n) : pool;
    testIdx = 0; testScore = 0; testByTopic = {};
    topics.forEach((id) => testByTopic[id] = { right: 0, total: 0 });
    $("#testSetup").hidden = true; $("#testResult").hidden = true; $("#testRun").hidden = false;
    renderTestQuestion();
  }

  function renderTestQuestion() {
    testAnswered = false;
    const q = testQs[testIdx];
    $("#testProgressBar").style.width = (testIdx / testQs.length * 100) + "%";
    $("#testCounter").textContent = `Frage ${testIdx + 1} / ${testQs.length}`;
    $("#testQuestion").textContent = q.question;
    $("#testTag").textContent = q.topic + " · " + DATA[q.topic].title;
    $("#testExplain").hidden = true;
    $("#testNext").disabled = true;
    $("#testNext").textContent = testIdx + 1 === testQs.length ? "Auswerten" : "Weiter";
    const keys = ["A", "B", "C", "D", "E", "F"];
    $("#testAnswers").innerHTML = q.options.map((o, i) =>
      `<button class="answer" data-i="${i}"><span class="a-key">${keys[i]}</span><span>${esc(o)}</span></button>`).join("");
    $$("#testAnswers .answer").forEach((a) => a.addEventListener("click", () => answerTest(parseInt(a.dataset.i, 10))));
  }

  function answerTest(i) {
    if (testAnswered) return;
    testAnswered = true;
    const q = testQs[testIdx];
    testByTopic[q.topic].total++;
    $$("#testAnswers .answer").forEach((a) => {
      const idx = parseInt(a.dataset.i, 10);
      a.classList.add("locked");
      if (idx === q.answer) a.classList.add("correct");
      else if (idx === i) a.classList.add("wrong");
    });
    if (i === q.answer) { testScore++; testByTopic[q.topic].right++; }
    const ex = $("#testExplain");
    ex.innerHTML = `<b>${i === q.answer ? "✓ Richtig." : "✗ Leider falsch."}</b> ${esc(q.explanation || "")}`;
    ex.hidden = false;
    $("#testNext").disabled = false;
  }

  function nextTest() {
    if (!testAnswered) return;
    if (testIdx + 1 < testQs.length) { testIdx++; renderTestQuestion(); }
    else showTestResult();
  }

  function showTestResult() {
    $("#testRun").hidden = true;
    const pct = Math.round(testScore / testQs.length * 100);
    let grade, color;
    if (pct >= 90) { grade = "Sehr gut – bereit für die Klausur! 🎉"; color = "var(--good)"; }
    else if (pct >= 75) { grade = "Gut – noch ein paar Lücken schließen."; color = "var(--accent)"; }
    else if (pct >= 60) { grade = "Befriedigend – dranbleiben!"; color = "var(--warn)"; }
    else { grade = "Da geht noch was – wiederhole die schwachen Themen."; color = "var(--bad)"; }

    const bars = Object.keys(testByTopic).filter((id) => testByTopic[id].total > 0).map((id) => {
      const b = testByTopic[id], p = Math.round(b.right / b.total * 100);
      const c = p >= 75 ? "var(--good)" : p >= 50 ? "var(--warn)" : "var(--bad)";
      return `<div class="rb"><span class="rb-label">${id} · ${esc(DATA[id].title)}</span>
        <span class="rb-track"><span class="rb-fill" style="width:${p}%;background:${c}"></span></span>
        <span class="rb-val">${b.right}/${b.total}</span></div>`;
    }).join("");

    $("#testResult").innerHTML = `
      <div class="result-score" style="color:${color}">${pct}%</div>
      <div class="result-grade">${grade}</div>
      <p class="lead" style="margin:0 auto">${testScore} von ${testQs.length} Fragen richtig.</p>
      <div class="result-bars">${bars}</div>
      <div class="result-actions">
        <button class="btn btn-primary" id="testAgain">Neuen Test starten</button>
        <button class="btn btn-ghost" data-goto="themen">Themen wiederholen</button>
      </div>`;
    $("#testResult").hidden = false;
    $("#testAgain").addEventListener("click", () => { $("#testResult").hidden = true; $("#testSetup").hidden = false; });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function initTest() {
    renderTestTopics();
    $("#testStart").addEventListener("click", startTest);
    $("#testNext").addEventListener("click", nextTest);
  }

  /* ============================================================
     ÜBUNGEN
     ============================================================ */
  const UEBUNGEN = [
    ["ueb_03", "Übung 03"],
    ["ueb_04", "Übung 04"],
    ["ueb_05", "Übung 05"],
    ["ueb_06", "Übung 06 · Innovationsmanagement"],
    ["ueb_07", "Übung 07 · IT-Controlling"],
    ["ueb_08", "Übung 08 · Gastvortrag Cloud Computing & digitale Souveränität"]
  ];
  const SITZUNGEN = [
    ["sit_01", "Sitzung 01 · Einführung"],
    ["sit_02", "Sitzung 02 · Fragen (Aufgabensammlung)"],
    ["sit_03", "Sitzung 03 · EAM"],
    ["sit_04", "Sitzung 04 · Organisation & Portfolio"],
    ["sit_05", "Sitzung 05 · IT-Outsourcing"]
  ];

  function uebCard(file, title, icon) {
    return `<div class="folio-card cs">
      <span class="fc-ico">${icon}</span>
      <h3>${esc(title)}</h3>
      <span class="td-date" style="font-size:.78rem;color:var(--muted)">Übungsmaterial</span>
      <div class="fc-actions">
        <a class="btn btn-small" href="uebungen/${file}.pdf" target="_blank" rel="noopener">Öffnen ↗</a>
        <a class="btn btn-small" href="uebungen/${file}.pdf" download>Download</a>
      </div>
    </div>`;
  }

  function renderUebungen() {
    $("#uebGrid").innerHTML = UEBUNGEN.map(([f, t]) => uebCard(f, t, "📝")).join("");
    $("#sitGrid").innerHTML = SITZUNGEN.map(([f, t]) => uebCard(f, t, "🗂️")).join("");
  }

  /* ============================================================
     FOLIEN
     ============================================================ */
  function renderFolien() {
    const lectures = IDS.map((id) =>
      `<div class="folio-card">
        <span class="fc-ico">📘</span>
        <h3>${id} · ${esc(DATA[id].title)}</h3>
        <span class="td-date" style="font-size:.78rem;color:var(--muted)">Vorlesung ${esc(DATA[id].date)}</span>
        <div class="fc-actions">
          <a class="btn btn-small" href="folien/${id}.pdf" target="_blank" rel="noopener">Öffnen ↗</a>
          <a class="btn btn-small" href="folien/${id}.pdf" download>Download</a>
        </div>
      </div>`).join("");
    const cases = [
      ["fall_01", "Fallstudie 1 · Soundscape"],
      ["fall_02", "Fallstudie 2 · Klinikum Südwest"],
      ["fall_03", "Fallstudie 3 · Nordprotect AG"]
    ].map(([f, t]) =>
      `<div class="folio-card cs">
        <span class="fc-ico">📂</span>
        <h3>${esc(t)}</h3>
        <span class="td-date" style="font-size:.78rem;color:var(--muted)">Fallstudie zur Übung</span>
        <div class="fc-actions">
          <a class="btn btn-small" href="folien/${f}.pdf" target="_blank" rel="noopener">Öffnen ↗</a>
          <a class="btn btn-small" href="folien/${f}.pdf" download>Download</a>
        </div>
      </div>`).join("");
    $("#folienGrid").innerHTML = lectures + cases;
  }

  /* ---------- Lightbox-Steuerung (stabiles DOM) ---------- */
  function initLightboxControls() {
    const lb = $("#lightbox");
    $("#lightboxClose").addEventListener("click", closeLightbox);
    lb.addEventListener("click", (e) => { if (e.target === lb) closeLightbox(); });
    $("#lightboxPrev").addEventListener("click", () => { gotoSlide(slideIdx - 1); renderLightbox(); });
    $("#lightboxNext").addEventListener("click", () => { gotoSlide(slideIdx + 1); renderLightbox(); });
    // Swipe in der Lightbox
    let sx = 0, st = 0, tracking = false;
    lb.addEventListener("pointerdown", (e) => { tracking = true; sx = e.clientX; st = performance.now(); });
    lb.addEventListener("pointerup", (e) => {
      if (!tracking) return; tracking = false;
      const dx = e.clientX - sx, dt = performance.now() - st;
      if (Math.abs(dx) > 55 || Math.abs(dx) / dt > 0.45) {
        if (dx < 0) gotoSlide(slideIdx + 1); else gotoSlide(slideIdx - 1);
        renderLightbox();
      }
    });
    // Tastatur
    document.addEventListener("keydown", (e) => {
      if (lb.classList.contains("open")) {
        if (e.key === "Escape") closeLightbox();
        else if (e.key === "ArrowRight") { e.preventDefault(); gotoSlide(slideIdx + 1); renderLightbox(); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); gotoSlide(slideIdx - 1); renderLightbox(); }
        else if (e.key === "Tab") { // einfache Fokusfalle
          const f = [$("#lightboxClose"), $("#lightboxPrev"), $("#lightboxNext")];
          const i = f.indexOf(document.activeElement);
          e.preventDefault();
          const ni = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i >= f.length - 1 ? 0 : i + 1);
          f[ni].focus();
        }
        return;
      }
      // In der Themen-Ansicht: Pfeiltasten blättern (nicht im Zeichenmodus)
      if ($("#view-themen").classList.contains("active") && !SlideDraw.isEnabled()) {
        if (e.key === "ArrowRight") { e.preventDefault(); gotoSlide(slideIdx + 1); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); gotoSlide(slideIdx - 1); }
      }
    });
  }

  /* ============================================================
     INIT
     ============================================================ */
  renderStats();
  renderTopicGrid();
  renderThemenNav();
  openTopic(IDS[0]);
  initKK();
  initTest();
  initLightboxControls();
  renderUebungen();
  renderFolien();

  const hash = location.hash.replace("#", "");
  if (VIEWS.includes(hash)) showView(hash, true);
})();
