/* ============================================================
   Winfo – Lernportal (Multi-Kurs)
   Vanilla JS. Registry: window.WINFO, Kursdaten: window.WINFO_DATA[id]
   ============================================================ */
(function () {
  "use strict";

  const REG = window.WINFO || { courses: [], semesters: [] };
  const DATA = window.WINFO_DATA || {};
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const store = {
    get(k, def) { try { const v = JSON.parse(localStorage.getItem("winfo_" + k)); return v == null ? def : v; } catch { return def; } },
    set(k, v) { try { localStorage.setItem("winfo_" + k, JSON.stringify(v)); return true; } catch { return false; } }
  };
  const VIEWS = ["uebersicht", "themen", "karteikarten", "test", "uebungen", "folien"];

  /* ---------- Kurs-Kontext ---------- */
  let CUR = null;                                   // aktueller Kurs-id
  const meta = (id) => REG.courses.find((c) => c.id === id) || {};
  const CD = () => DATA[CUR] || { topics: {}, slides: {}, uebungen: [], materialien: [] };
  const topicIds = () => Object.keys(CD().topics).sort();

  /* ============================================================
     PORTAL (Kursauswahl)
     ============================================================ */
  function courseStats(id) {
    const d = DATA[id]; if (!d) return { topics: 0, fc: 0, qz: 0 };
    let fc = 0, qz = 0; const ts = Object.values(d.topics);
    ts.forEach((t) => { fc += (t.flashcards || []).length; qz += (t.quiz || []).length; });
    return { topics: ts.length, fc, qz };
  }
  function daysLeft(examDate) {
    if (!examDate) return null;
    return Math.max(0, Math.ceil((new Date(examDate) - new Date()) / 864e5));
  }
  function renderPortal() {
    const html = REG.semesters.map((sem) => {
      const courses = REG.courses.filter((c) => c.semester === sem.id);
      if (!courses.length) return "";
      const cards = courses.map((c) => {
        const s = courseStats(c.id);
        const dl = daysLeft(c.examDate);
        const badge = dl != null ? `<span class="pc-exam">🗓️ noch ${dl} Tage</span>` : "";
        return `<button class="course-card" data-course="${c.id}">
          <div class="cc-ico">${c.icon || "📘"}</div>
          <div class="cc-body">
            <span class="cc-short">${esc(c.short || "")}</span>
            <h3>${esc(c.name)}</h3>
            <div class="cc-meta"><span>📚 ${s.topics} Themen</span><span>📝 ${s.fc} Karten</span><span>❓ ${s.qz} Fragen</span></div>
          </div>
          <div class="cc-foot">${badge}<span class="cc-go">Lernen →</span></div>
        </button>`;
      }).join("");
      return `<section class="sem-block">
        <h2 class="sem-title"><span class="sem-num">${esc(sem.id)}</span> ${esc(sem.name)}</h2>
        <div class="course-grid">${cards}</div>
      </section>`;
    }).join("");
    $("#portalContent").innerHTML = html;
    $$("#portalContent .course-card").forEach((c) =>
      c.addEventListener("click", () => openCourse(c.dataset.course)));
  }

  function goHome() {
    CUR = null;
    document.body.classList.add("portal-mode");
    $("#workspace").hidden = true;
    $("#portal").hidden = false;
    $("#tabs").hidden = true;
    $("#countdownMini").hidden = true;
    $("#brandTitle").textContent = REG.brand || "Winfo";
    $("#brandSub").textContent = REG.subtitle || "";
    location.hash = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openCourse(id, fromHash) {
    if (!DATA[id]) { alert("Kursdaten nicht gefunden."); return; }
    CUR = id;
    const m = meta(id);
    document.body.classList.remove("portal-mode");
    $("#portal").hidden = true;
    $("#workspace").hidden = false;
    $("#tabs").hidden = false;
    $("#brandTitle").textContent = m.name || id;
    $("#brandSub").textContent = (m.short ? m.short + " · " : "") + "Zur Kursübersicht ↩";
    // Kurs-spezifische Zustände zurücksetzen
    currentTopic = null; kkCards = []; kkIndex = 0;
    renderOverview();
    renderThemenNav();
    openTopic(topicIds()[0]);
    renderKKTopicSelect(); setKKTopic("all");
    renderTestTopics();
    renderUebungen();
    renderFolien();
    updateCountdown();
    if (!fromHash) location.hash = id;
    showView("uebersicht");
  }

  /* ============================================================
     NAVIGATION (Views)
     ============================================================ */
  function showView(name, fromHash) {
    $$("#workspace .view").forEach((v) => v.classList.toggle("active", v.id === "view-" + name));
    $$("#tabs .tab").forEach((t) => {
      const on = t.dataset.view === name;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
    });
    if (!fromHash && CUR) location.hash = CUR + "/" + name;
    const at = $("#tabs .tab.active"); if (at) at.scrollIntoView({ inline: "center", block: "nearest" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  $$("#tabs .tab").forEach((t) => t.addEventListener("click", () => showView(t.dataset.view)));
  document.addEventListener("click", (e) => {
    const g = e.target.closest("[data-goto]");
    if (g) showView(g.dataset.goto);
  });
  $("#homeBtn").addEventListener("click", goHome);
  window.addEventListener("hashchange", routeFromHash);

  function routeFromHash() {
    const h = location.hash.replace("#", "");
    if (!h) { if (CUR) goHome(); return; }
    const [cid, view] = h.split("/");
    if (DATA[cid]) {
      if (cid !== CUR) openCourse(cid, true);
      if (view && VIEWS.includes(view)) showView(view, true);
    }
  }

  /* ============================================================
     COUNTDOWN (kursspezifisch)
     ============================================================ */
  function updateCountdown() {
    const m = meta(CUR);
    const dl = daysLeft(m.examDate);
    const mini = $("#countdownMini");
    if (dl == null) { mini.hidden = true; }
    else { mini.hidden = false; $("#cdMiniDays").textContent = dl; }
  }
  function tickBig() {
    const el = $("#cdBig"); if (!el || !CUR) return;
    const m = meta(CUR); if (!m.examDate) return;
    let diff = Math.max(0, new Date(m.examDate) - new Date());
    const d = Math.floor(diff / 864e5), h = Math.floor((diff % 864e5) / 36e5), mi = Math.floor((diff % 36e5) / 6e4), s = Math.floor((diff % 6e4) / 1e3);
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = String(v).padStart(2, "0"); };
    set("cdDays", d); set("cdHours", h); set("cdMins", mi); set("cdSecs", s);
    const mini = $("#cdMiniDays"); if (mini) mini.textContent = d;
  }
  setInterval(tickBig, 1000);

  /* ============================================================
     ÜBERSICHT (Kurs)
     ============================================================ */
  function renderOverview() {
    const m = meta(CUR), d = CD();
    const ids = topicIds();
    let fc = 0, qz = 0, gl = 0;
    ids.forEach((id) => { const t = d.topics[id]; fc += (t.flashcards || []).length; qz += (t.quiz || []).length; gl += (t.glossary || []).length; });
    const hasExam = !!m.examDate;
    const countdown = hasExam ? `
      <div class="countdown-big" id="cdBig">
        <div class="cd-unit"><span id="cdDays">–</span><label>Tage</label></div><div class="cd-sep">:</div>
        <div class="cd-unit"><span id="cdHours">–</span><label>Std</label></div><div class="cd-sep">:</div>
        <div class="cd-unit"><span id="cdMins">–</span><label>Min</label></div><div class="cd-sep">:</div>
        <div class="cd-unit"><span id="cdSecs">–</span><label>Sek</label></div>
      </div>` : "";
    const examLine = hasExam
      ? `Bereit für die Klausur am <span class="accent">${new Date(m.examDate).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}</span>`
      : `<span class="accent">${esc(m.name)}</span>`;
    const cards = ids.map((id) => {
      const t = d.topics[id];
      return `<button class="topic-card" data-topic="${id}">
        <div class="tc-top"><span class="tc-num">${id}</span><span class="tc-date">${(d.slides[id] || 0)} Folien</span></div>
        <h3>${esc(t.title)}</h3>
        <p>${esc(t.summary || "")}</p>
        <div class="tc-foot"><span>📝 ${(t.flashcards || []).length} Karten</span><span>❓ ${(t.quiz || []).length} Fragen</span></div>
      </button>`;
    }).join("");
    $("#view-uebersicht").innerHTML = `
      <div class="hero">
        <div class="hero-left">
          <div class="hero-crumb"><button class="btn btn-small btn-ghost" id="backBtn">← Alle Kurse</button> <span class="hero-sem">${esc((REG.semesters.find(s=>s.id===m.semester)||{}).name||"")}</span></div>
          <h1>${examLine}</h1>
          <p class="lead">${esc(m.name)} – kompakt aufbereitet: Original-Folien zum Durchblättern (mit Wisch-Navigation), Kernpunkte, Karteikarten, Probetest und alle Materialien.</p>
          <div class="hero-actions"><button class="btn btn-primary" data-goto="themen">Themen lernen</button><button class="btn btn-ghost" data-goto="test">Test starten</button></div>
        </div>
        ${countdown}
      </div>
      <div class="stats">
        <div class="stat"><b>${ids.length}</b><span>Themen</span></div>
        <div class="stat"><b>${fc}</b><span>Karteikarten</span></div>
        <div class="stat"><b>${qz}</b><span>Testfragen</span></div>
        <div class="stat"><b>${gl}</b><span>Fachbegriffe</span></div>
      </div>
      <h2 class="section-title">Themenübersicht</h2>
      <div class="topic-grid">${cards}</div>`;
    $("#backBtn").addEventListener("click", goHome);
    $$("#view-uebersicht .topic-card").forEach((c) =>
      c.addEventListener("click", () => { showView("themen"); openTopic(c.dataset.topic); }));
    updateCountdown();
  }

  /* ============================================================
     THEMEN + Slide-Viewer (mit Swipe, ohne Zeichnen)
     ============================================================ */
  let currentTopic = null;
  let slideIdx = 1, slideMax = 1, slideTopic = "01", slideToken = 0, swipeFired = false;

  const slidePath = (t, n) => `courses/${CUR}/folien/img/${t}/p${String(n).padStart(3, "0")}.jpg`;
  const thumbPath = (t, n) => `courses/${CUR}/folien/img/${t}/thumb/p${String(n).padStart(3, "0")}.jpg`;

  function renderThemenNav() {
    const d = CD();
    $("#themenNav").innerHTML = topicIds().map((id) =>
      `<button class="tn-item" data-topic="${id}"><b>${id}</b><span>${esc(d.topics[id].title)}</span></button>`).join("");
    $$("#themenNav .tn-item").forEach((b) => b.addEventListener("click", () => openTopic(b.dataset.topic)));
  }

  function preloadSlide(n) { if (n >= 1 && n <= slideMax) { const im = new Image(); im.src = slidePath(slideTopic, n); } }
  function renderSlide() {
    const img = $("#slideImg"); if (!img) return;
    img.src = slidePath(slideTopic, slideIdx);
    $("#slideCounter").textContent = `Folie ${slideIdx} / ${slideMax}`;
    $("#slidePrev").disabled = slideIdx <= 1;
    $("#slideNext").disabled = slideIdx >= slideMax;
    $$("#slideThumbs .thumb").forEach((th) => th.classList.toggle("active", +th.dataset.n === slideIdx));
    const strip = $("#slideThumbs"), act = $(`#slideThumbs .thumb[data-n="${slideIdx}"]`);
    if (strip && act) strip.scrollTo({ left: act.offsetLeft - strip.clientWidth / 2 + act.clientWidth / 2, behavior: "smooth" });
    preloadSlide(slideIdx + 1); preloadSlide(slideIdx - 1);
  }
  function gotoSlide(n) { slideIdx = Math.min(slideMax, Math.max(1, n)); renderSlide(); }

  /* Lightbox */
  let lastFocus = null;
  function renderLightbox() {
    $("#lightboxImg").src = slidePath(slideTopic, slideIdx);
    $("#lightboxCounter").textContent = `${slideTopic} · Folie ${slideIdx} / ${slideMax}`;
  }
  function openLightbox() {
    if (swipeFired) return;
    lastFocus = document.activeElement; renderLightbox();
    $("#lightbox").classList.add("open");
    $("#app").setAttribute("aria-hidden", "true");
    setTimeout(() => { try { $("#lightboxClose").focus(); } catch {} }, 30);
  }
  function closeLightbox() {
    $("#lightbox").classList.remove("open");
    $("#app").removeAttribute("aria-hidden");
    if (lastFocus) { try { lastFocus.focus(); } catch {} }
  }

  function initSwipe() {
    const el = $("#stageWrap"); if (!el) return;
    let sx = 0, sy = 0, st = 0, tracking = false, decided = false, horiz = false;
    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      tracking = true; decided = false; horiz = false; sx = e.clientX; sy = e.clientY; st = performance.now();
    });
    el.addEventListener("pointermove", (e) => {
      if (!tracking) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!decided && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) { decided = true; horiz = Math.abs(dx) > Math.abs(dy) * 1.4; }
      if (horiz) e.preventDefault();
    });
    el.addEventListener("pointerup", (e) => {
      if (!tracking) return; tracking = false; if (!horiz) return;
      const dx = e.clientX - sx, dt = performance.now() - st, fast = Math.abs(dx) / dt > 0.45;
      if (Math.abs(dx) > 55 || fast) { swipeFired = true; setTimeout(() => { swipeFired = false; }, 350); if (dx < 0) gotoSlide(slideIdx + 1); else gotoSlide(slideIdx - 1); }
    });
    el.addEventListener("pointercancel", () => { tracking = false; });
  }

  function openTopic(id) {
    if (!id) return;
    if (id === currentTopic && $("#slideImg")) return;
    currentTopic = id;
    const d = CD(), t = d.topics[id];
    slideTopic = id; slideMax = d.slides[id] || 1; slideIdx = 1;
    $$("#themenNav .tn-item").forEach((b) => b.classList.toggle("active", b.dataset.topic === id));

    const secs = t.sections || [], gloss = t.glossary || [];
    const sections = secs.map((s, i) => `
      <details class="td-section" ${i === 0 ? "open" : ""}>
        <summary>${esc(s.heading)}</summary>
        <div class="sec-body"><ul>${(s.points || []).map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>
      </details>`).join("");
    const glossary = gloss.map((g) => `<tr><td>${esc(g.term)}</td><td>${esc(g.definition)}</td></tr>`).join("");
    const thumbs = Array.from({ length: slideMax }, (_, i) =>
      `<img class="thumb" data-n="${i + 1}" loading="lazy" decoding="async" width="120" height="85" src="${thumbPath(id, i + 1)}" alt="Folie ${i + 1}">`).join("");
    const kpList = (t.kernpunkte && t.kernpunkte.length) ? t.kernpunkte : secs.map((s) => s.heading);
    const kern = kpList.map((k) => `<li>${esc(k)}</li>`).join("");

    $("#themenContent").innerHTML = `
      <article class="topic-detail">
        <div class="td-head">
          <div><h2><span style="color:var(--muted);font-weight:700">${id}.</span> ${esc(t.title)}</h2>
            <span class="td-date">${slideMax} Folien</span></div>
          <div class="td-actions">
            <button class="btn btn-small" data-kk="${id}">Karteikarten</button>
            <a class="btn btn-small" href="courses/${CUR}/folien/${id}.pdf" target="_blank" rel="noopener">PDF ↗</a>
          </div>
        </div>
        <div class="td-slides">
          <div class="slide-viewer">
            <button class="slide-arrow sa-left" id="slidePrev" aria-label="Vorherige Folie">‹</button>
            <div class="stage-wrap" id="stageWrap"><img id="slideImg" alt="Folie" title="Zum Vergrößern tippen"></div>
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
          <h3 class="td-sub">🎯 Kernpunkte</h3>
          <ul class="kernpunkte">${kern}</ul>
          <details class="td-more">
            <summary>📖 Ausführliche Zusammenfassung &amp; Glossar anzeigen</summary>
            <div class="td-more-body">${sections}<h3 class="td-sub">📑 Glossar</h3><table class="glossary"><tbody>${glossary}</tbody></table></div>
          </details>
        </div>
      </article>`;
    $$("#themenContent [data-kk]").forEach((b) => b.addEventListener("click", () => { showView("karteikarten"); setKKTopic(b.dataset.kk); }));
    $("#slidePrev").addEventListener("click", () => gotoSlide(slideIdx - 1));
    $("#slideNext").addEventListener("click", () => gotoSlide(slideIdx + 1));
    $("#slideImg").addEventListener("click", openLightbox);
    $("#slideZoom").addEventListener("click", openLightbox);
    $$("#slideThumbs .thumb").forEach((th) => th.addEventListener("click", () => gotoSlide(+th.dataset.n)));
    renderSlide();
    initSwipe();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ============================================================
     KARTEIKARTEN
     ============================================================ */
  let kkCards = [], kkIndex = 0;
  function buildKKList(topic) {
    const d = CD(); let cards = [];
    const add = (id) => d.topics[id].flashcards.forEach((c, i) => cards.push({ ...c, topic: id, key: CUR + "-" + id + "-" + i }));
    if (topic === "all") topicIds().forEach(add); else add(topic);
    return cards;
  }
  function renderKKTopicSelect() {
    const d = CD(), sel = $("#kkTopic");
    const total = topicIds().reduce((a, id) => a + d.topics[id].flashcards.length, 0);
    sel.innerHTML = `<option value="all">Alle Themen (${total} Karten)</option>` +
      topicIds().map((id) => `<option value="${id}">${id} · ${esc(d.topics[id].title)} (${d.topics[id].flashcards.length})</option>`).join("");
    sel.onchange = () => setKKTopic(sel.value);
  }
  function setKKTopic(topic) { $("#kkTopic").value = topic; kkCards = buildKKList(topic); kkIndex = 0; renderKKCard(); }
  function renderKKCard() {
    const card = $("#flashcard"); card.classList.remove("flipped");
    if (!kkCards.length) { $("#kkFront").textContent = "Keine Karten."; $("#kkBack").textContent = ""; $("#kkCounter").textContent = "–"; return; }
    const c = kkCards[kkIndex], known = store.get("known", {});
    $("#kkFront").textContent = c.front; $("#kkBack").textContent = c.back;
    const tag = CD().topics[c.topic].title;
    $("#kkTagFront").textContent = c.topic + " · " + tag; $("#kkTagBack").textContent = c.topic + " · " + tag;
    $("#kkCounter").textContent = `Karte ${kkIndex + 1} / ${kkCards.length}` + (known[c.key] ? "  ·  ✓ gewusst" : "");
    const learned = kkCards.filter((x) => known[x.key]).length;
    $("#kkProgressBar").style.width = (learned / kkCards.length * 100) + "%";
  }
  function flipKK() { $("#flashcard").classList.toggle("flipped"); }
  function nextKK() { if (kkCards.length) { kkIndex = (kkIndex + 1) % kkCards.length; renderKKCard(); } }
  function prevKK() { if (kkCards.length) { kkIndex = (kkIndex - 1 + kkCards.length) % kkCards.length; renderKKCard(); } }
  function rateKK(good) {
    if (!kkCards.length) return;
    const known = store.get("known", {}), key = kkCards[kkIndex].key;
    if (good) known[key] = true; else delete known[key];
    store.set("known", known); nextKK();
  }
  $("#flashcard").addEventListener("click", flipKK);
  $("#kkNext").addEventListener("click", nextKK);
  $("#kkPrev").addEventListener("click", prevKK);
  $("#kkKnown").addEventListener("click", () => rateKK(true));
  $("#kkAgain").addEventListener("click", () => rateKK(false));
  $("#kkShuffle").addEventListener("click", () => { kkCards.sort(() => Math.random() - 0.5); kkIndex = 0; renderKKCard(); });
  $("#kkReset").addEventListener("click", () => { store.set("known", {}); renderKKCard(); });

  /* ============================================================
     TEST
     ============================================================ */
  let testQs = [], testIdx = 0, testAnswered = false, testScore = 0, testByTopic = {};
  function renderTestTopics() {
    const d = CD();
    $("#testTopics").innerHTML = `<span class="chip on" data-t="all">Alle</span>` +
      topicIds().map((id) => `<span class="chip on" data-t="${id}">${id} · ${esc(d.topics[id].title)}</span>`).join("");
    const chips = $$("#testTopics .chip");
    chips.forEach((ch) => ch.addEventListener("click", () => {
      const t = ch.dataset.t;
      if (t === "all") { const on = !ch.classList.contains("on"); chips.forEach((c) => c.classList.toggle("on", on)); }
      else { ch.classList.toggle("on"); $('#testTopics .chip[data-t="all"]').classList.toggle("on", chips.filter((c) => c.dataset.t !== "all").every((c) => c.classList.contains("on"))); }
    }));
  }
  function selectedTestTopics() { return $$('#testTopics .chip.on').map((c) => c.dataset.t).filter((t) => t !== "all"); }
  function startTest() {
    const d = CD(), topics = selectedTestTopics();
    if (!topics.length) { alert("Bitte mindestens ein Thema auswählen."); return; }
    let pool = []; topics.forEach((id) => d.topics[id].quiz.forEach((q) => pool.push({ ...q, topic: id })));
    pool.sort(() => Math.random() - 0.5);
    const n = parseInt($("#testCount").value, 10);
    testQs = n > 0 ? pool.slice(0, n) : pool; testIdx = 0; testScore = 0; testByTopic = {};
    topics.forEach((id) => testByTopic[id] = { right: 0, total: 0 });
    $("#testSetup").hidden = true; $("#testResult").hidden = true; $("#testRun").hidden = false;
    renderTestQuestion();
  }
  function renderTestQuestion() {
    testAnswered = false; const q = testQs[testIdx];
    $("#testProgressBar").style.width = (testIdx / testQs.length * 100) + "%";
    $("#testCounter").textContent = `Frage ${testIdx + 1} / ${testQs.length}`;
    $("#testQuestion").textContent = q.question;
    $("#testTag").textContent = q.topic + " · " + CD().topics[q.topic].title;
    $("#testExplain").hidden = true; $("#testNext").disabled = true;
    $("#testNext").textContent = testIdx + 1 === testQs.length ? "Auswerten" : "Weiter";
    const keys = ["A", "B", "C", "D", "E", "F"];
    $("#testAnswers").innerHTML = q.options.map((o, i) => `<button class="answer" data-i="${i}"><span class="a-key">${keys[i]}</span><span>${esc(o)}</span></button>`).join("");
    $$("#testAnswers .answer").forEach((a) => a.addEventListener("click", () => answerTest(parseInt(a.dataset.i, 10))));
  }
  function answerTest(i) {
    if (testAnswered) return; testAnswered = true; const q = testQs[testIdx];
    testByTopic[q.topic].total++;
    $$("#testAnswers .answer").forEach((a) => { const idx = +a.dataset.i; a.classList.add("locked"); if (idx === q.answer) a.classList.add("correct"); else if (idx === i) a.classList.add("wrong"); });
    if (i === q.answer) { testScore++; testByTopic[q.topic].right++; }
    const ex = $("#testExplain"); ex.innerHTML = `<b>${i === q.answer ? "✓ Richtig." : "✗ Leider falsch."}</b> ${esc(q.explanation || "")}`; ex.hidden = false;
    $("#testNext").disabled = false;
  }
  function nextTest() { if (!testAnswered) return; if (testIdx + 1 < testQs.length) { testIdx++; renderTestQuestion(); } else showTestResult(); }
  function showTestResult() {
    $("#testRun").hidden = true; const pct = Math.round(testScore / testQs.length * 100); let grade, color;
    if (pct >= 90) { grade = "Sehr gut – bereit für die Klausur! 🎉"; color = "var(--good)"; }
    else if (pct >= 75) { grade = "Gut – noch ein paar Lücken schließen."; color = "var(--accent)"; }
    else if (pct >= 60) { grade = "Befriedigend – dranbleiben!"; color = "var(--warn)"; }
    else { grade = "Da geht noch was – wiederhole die schwachen Themen."; color = "var(--bad)"; }
    const bars = Object.keys(testByTopic).filter((id) => testByTopic[id].total > 0).map((id) => {
      const b = testByTopic[id], p = Math.round(b.right / b.total * 100), c = p >= 75 ? "var(--good)" : p >= 50 ? "var(--warn)" : "var(--bad)";
      return `<div class="rb"><span class="rb-label">${id} · ${esc(CD().topics[id].title)}</span><span class="rb-track"><span class="rb-fill" style="width:${p}%;background:${c}"></span></span><span class="rb-val">${b.right}/${b.total}</span></div>`;
    }).join("");
    $("#testResult").innerHTML = `<div class="result-score" style="color:${color}">${pct}%</div><div class="result-grade">${grade}</div>
      <p class="lead" style="margin:0 auto">${testScore} von ${testQs.length} Fragen richtig.</p><div class="result-bars">${bars}</div>
      <div class="result-actions"><button class="btn btn-primary" id="testAgain">Neuen Test starten</button><button class="btn btn-ghost" data-goto="themen">Themen wiederholen</button></div>`;
    $("#testResult").hidden = false;
    $("#testAgain").addEventListener("click", () => { $("#testResult").hidden = true; $("#testSetup").hidden = false; });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  $("#testStart").addEventListener("click", startTest);
  $("#testNext").addEventListener("click", nextTest);

  /* ============================================================
     ÜBUNGEN + FOLIEN
     ============================================================ */
  function matCard(m, icon, cs) {
    return `<div class="folio-card ${cs || ""}"><span class="fc-ico">${icon}</span><h3>${esc(m.label)}</h3>
      <div class="fc-actions"><a class="btn btn-small" href="courses/${CUR}/${m.dir || "uebungen"}/${m.file}.pdf" target="_blank" rel="noopener">Öffnen ↗</a>
      <a class="btn btn-small" href="courses/${CUR}/${m.dir || "uebungen"}/${m.file}.pdf" download>Download</a></div></div>`;
  }
  function renderUebungen() {
    const d = CD();
    const ueb = (d.uebungen || []).map((m) => matCard(m, "📝")).join("");
    const mat = (d.materialien || []).map((m) => matCard(m, "📂", "cs")).join("");
    $("#view-uebungen").innerHTML = `
      <h2 class="section-title">Übungen & Materialien</h2>
      <p class="lead">Übungsaufgaben, Musterlösungen und weitere Materialien zum Kurs.</p>
      ${ueb ? `<h3 class="td-sub">📝 Übungen</h3><div class="folien-grid">${ueb}</div>` : ""}
      ${mat ? `<h3 class="td-sub">📂 Weitere Materialien</h3><div class="folien-grid">${mat}</div>` : "<p class='lead'>Keine zusätzlichen Materialien.</p>"}`;
  }
  function renderFolien() {
    const d = CD();
    const lectures = topicIds().map((id) =>
      `<div class="folio-card"><span class="fc-ico">📘</span><h3>${id} · ${esc(d.topics[id].title)}</h3>
        <span class="td-date" style="font-size:.78rem;color:var(--muted)">${d.slides[id] || 0} Folien</span>
        <div class="fc-actions"><a class="btn btn-small" href="courses/${CUR}/folien/${id}.pdf" target="_blank" rel="noopener">Öffnen ↗</a>
        <a class="btn btn-small" href="courses/${CUR}/folien/${id}.pdf" download>Download</a></div></div>`).join("");
    $("#view-folien").innerHTML = `<h2 class="section-title">Originalfolien</h2>
      <p class="lead">Alle Vorlesungsunterlagen dieses Kurses zum Ansehen und Herunterladen.</p>
      <div class="folien-grid">${lectures}</div>`;
  }

  /* ============================================================
     LIGHTBOX-Steuerung + Tastatur
     ============================================================ */
  (function initLightbox() {
    const lb = $("#lightbox");
    $("#lightboxClose").addEventListener("click", closeLightbox);
    lb.addEventListener("click", (e) => { if (e.target === lb) closeLightbox(); });
    $("#lightboxPrev").addEventListener("click", () => { gotoSlide(slideIdx - 1); renderLightbox(); });
    $("#lightboxNext").addEventListener("click", () => { gotoSlide(slideIdx + 1); renderLightbox(); });
    let sx = 0, st = 0, tracking = false;
    lb.addEventListener("pointerdown", (e) => { tracking = true; sx = e.clientX; st = performance.now(); });
    lb.addEventListener("pointerup", (e) => {
      if (!tracking) return; tracking = false; const dx = e.clientX - sx, dt = performance.now() - st;
      if (Math.abs(dx) > 55 || Math.abs(dx) / dt > 0.45) { if (dx < 0) gotoSlide(slideIdx + 1); else gotoSlide(slideIdx - 1); renderLightbox(); }
    });
    document.addEventListener("keydown", (e) => {
      if (lb.classList.contains("open")) {
        if (e.key === "Escape") closeLightbox();
        else if (e.key === "ArrowRight") { e.preventDefault(); gotoSlide(slideIdx + 1); renderLightbox(); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); gotoSlide(slideIdx - 1); renderLightbox(); }
        else if (e.key === "Tab") { const f = [$("#lightboxClose"), $("#lightboxPrev"), $("#lightboxNext")]; const i = f.indexOf(document.activeElement); e.preventDefault(); f[e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i >= f.length - 1 ? 0 : i + 1)].focus(); }
        return;
      }
      if (CUR && $("#view-themen").classList.contains("active")) {
        if (e.key === "ArrowRight") { e.preventDefault(); gotoSlide(slideIdx + 1); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); gotoSlide(slideIdx - 1); }
      } else if (CUR && $("#view-karteikarten").classList.contains("active")) {
        if (e.key === "ArrowRight") nextKK(); else if (e.key === "ArrowLeft") prevKK(); else if (e.key === " ") { e.preventDefault(); flipKK(); }
      }
    });
  })();

  /* ============================================================
     INIT
     ============================================================ */
  renderPortal();
  if (location.hash) routeFromHash();
})();
