/* ============================================================
   Informationsmanagement – Klausur-Lernportal
   Vanilla JS, keine Abhängigkeiten. Daten aus assets/data.js
   ============================================================ */
(function () {
  "use strict";

  const DATA = window.IM_DATA || {};
  const IDS = Object.keys(DATA).sort();
  const EXAM_DATE = new Date("2026-07-21T09:00:00");
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- Persistenz (localStorage) ---------- */
  const store = {
    get(k, def) { try { return JSON.parse(localStorage.getItem("im_" + k)) ?? def; } catch { return def; } },
    set(k, v) { try { localStorage.setItem("im_" + k, JSON.stringify(v)); } catch {} }
  };

  /* ============================================================
     NAVIGATION (Tabs / Views)
     ============================================================ */
  function showView(name) {
    $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + name));
    $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === name));
    window.scrollTo({ top: 0, behavior: "smooth" });
    location.hash = name;
  }
  $$("#tabs .tab").forEach((t) => t.addEventListener("click", () => showView(t.dataset.view)));
  document.addEventListener("click", (e) => {
    const g = e.target.closest("[data-goto]");
    if (g) showView(g.dataset.goto);
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
     THEMEN – Navigation + Detailansicht
     ============================================================ */
  let currentTopic = IDS[0];

  function renderThemenNav() {
    $("#themenNav").innerHTML = IDS.map((id) =>
      `<button class="tn-item" data-topic="${id}"><b>${id}</b><span>${esc(DATA[id].title)}</span></button>`
    ).join("");
    $$("#themenNav .tn-item").forEach((b) => b.addEventListener("click", () => openTopic(b.dataset.topic)));
  }

  function openTopic(id) {
    currentTopic = id;
    const t = DATA[id];
    $$("#themenNav .tn-item").forEach((b) => b.classList.toggle("active", b.dataset.topic === id));

    const sections = t.sections.map((s, i) => `
      <details class="td-section" ${i === 0 ? "open" : ""}>
        <summary>${esc(s.heading)}</summary>
        <div class="sec-body"><ul>${s.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>
      </details>`).join("");

    const glossary = t.glossary.map((g) =>
      `<tr><td>${esc(g.term)}</td><td>${esc(g.definition)}</td></tr>`).join("");

    $("#themenContent").innerHTML = `
      <article class="topic-detail">
        <div class="td-head">
          <div>
            <h2><span style="color:var(--muted);font-weight:700">${id}.</span> ${esc(t.title)}</h2>
            <span class="td-date">Vorlesung vom ${esc(t.date)}</span>
          </div>
          <div class="td-actions">
            <button class="btn btn-small" data-kk="${id}">Karteikarten zu diesem Thema</button>
            <a class="btn btn-small" href="folien/${id}.pdf" target="_blank" rel="noopener">Folien als PDF ↗</a>
          </div>
        </div>
        <div class="td-summary">${esc(t.summary)}</div>

        <h3 class="td-sub">📖 Zusammenfassung</h3>
        ${sections}

        <h3 class="td-sub">📑 Glossar</h3>
        <table class="glossary"><tbody>${glossary}</tbody></table>

        <h3 class="td-sub">🖼️ Originalfolien zur Kontrolle</h3>
        <object class="folioframe" data="folien/${id}.pdf#view=FitH" type="application/pdf">
          <p style="padding:1rem">Die Folien können nicht eingebettet werden.
          <a href="folien/${id}.pdf" target="_blank" rel="noopener">PDF in neuem Tab öffnen ↗</a></p>
        </object>
      </article>`;

    $$("#themenContent [data-kk]").forEach((b) =>
      b.addEventListener("click", () => { showView("karteikarten"); setKKTopic(b.dataset.kk); }));
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

  /* ============================================================
     INIT
     ============================================================ */
  renderStats();
  renderTopicGrid();
  renderThemenNav();
  openTopic(IDS[0]);
  initKK();
  initTest();
  renderFolien();

  const hash = location.hash.replace("#", "");
  if (["uebersicht", "themen", "karteikarten", "test", "folien"].includes(hash)) showView(hash);
})();
