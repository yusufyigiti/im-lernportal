/* Baut je Kurs courses/<id>/data.js aus data/*.json + gerenderten Folien + Übungs-/Material-Konfig.
   Aufruf: node build_courses.js [id ...]   (ohne Argumente: alle) */
const fs = require("fs");
const path = require("path");
const ROOT = __dirname;

// ---- Übungen / Materialien pro Kurs (Datei-Slug -> Label) ----
const gwiUeb = [];
for (let i = 1; i <= 10; i++) {
  const n = String(i).padStart(2, "0");
  gwiUeb.push({ file: "ueb_" + n, label: "Übung " + n });
  gwiUeb.push({ file: "blatt_" + n, label: "Übungsblatt " + n });
}

const CONFIG = {
  im: {
    uebungen: [
      { file: "ueb_03", label: "Übung 03" },
      { file: "ueb_04", label: "Übung 04" },
      { file: "ueb_05", label: "Übung 05" },
      { file: "ueb_06", label: "Übung 06 · Innovationsmanagement" },
      { file: "ueb_07", label: "Übung 07 · IT-Controlling" },
      { file: "ueb_08", label: "Übung 08 · Gastvortrag Cloud Computing" },
      { file: "sit_01", label: "Sitzung 01 · Einführung" },
      { file: "sit_02", label: "Sitzung 02 · Fragen (Aufgabensammlung)" },
      { file: "sit_03", label: "Sitzung 03 · EAM" },
      { file: "sit_04", label: "Sitzung 04 · Organisation & Portfolio" },
      { file: "sit_05", label: "Sitzung 05 · IT-Outsourcing" }
    ],
    materialien: [
      { file: "fall_01", dir: "folien", label: "Fallstudie 1 · Soundscape" },
      { file: "fall_02", dir: "folien", label: "Fallstudie 2 · Klinikum Südwest" },
      { file: "fall_03", dir: "folien", label: "Fallstudie 3 · Nordprotect AG" }
    ]
  },
  gwi: {
    uebungen: gwiUeb,
    materialien: [
      { file: "protokoll_1", label: "Gedächtnisprotokoll 1" },
      { file: "protokoll_2", label: "Gedächtnisprotokoll 2" },
      { file: "crm_auszug", label: "CRM-Auszug (Geib 2006)" }
    ]
  },
  eib: {
    uebungen: [
      { file: "bwl_bungen_l_sungen", label: "BWL-Übungen mit Lösungen" },
      { file: "hinweise_zur_klausur", label: "Hinweise zur Klausur" },
      { file: "kindig_erg_nzungsskript_ws2526_1", label: "Kindig Ergänzungsskript" }
    ],
    materialien: [
      { file: "probeklausur", label: "Probeklausur" },
      { file: "probeklausur_l_sungen", label: "Probeklausur · Lösungen" },
      { file: "probeklausur_2012_mit_losung", label: "Probeklausur 2012 (mit Lösung)" },
      { file: "probeklausur_2012_ohne_losung", label: "Probeklausur 2012 (ohne Lösung)" },
      { file: "probeklausur_2011_mit_losung", label: "Probeklausur 2011 (mit Lösung)" },
      { file: "probeklausur_2011_ohne_losung", label: "Probeklausur 2011 (ohne Lösung)" },
      { file: "probeklausur_2009_ohne_losung", label: "Probeklausur 2009 (ohne Lösung)" },
      { file: "probeklausur_1415_ohne_losung", label: "Probeklausur 14/15 (ohne Lösung)" }
    ]
  }
};

function countSlides(courseDir, tid) {
  const d = path.join(courseDir, "folien", "img", tid);
  if (!fs.existsSync(d)) return 0;
  return fs.readdirSync(d).filter((f) => f.endsWith(".jpg")).length;
}

function buildCourse(id) {
  const cdir = path.join(ROOT, "courses", id);
  const dataDir = path.join(cdir, "data");
  if (!fs.existsSync(dataDir)) { console.log("skip", id, "(no data dir)"); return; }
  const topics = {};
  const slides = {};
  const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".json")).sort();
  for (const f of files) {
    const t = JSON.parse(fs.readFileSync(path.join(dataDir, f), "utf8"));
    const tid = t.id || f.replace(".json", "");
    if (!t.pdf) t.pdf = `courses/${id}/folien/${tid}.pdf`;
    topics[tid] = t;
    slides[tid] = countSlides(cdir, tid);
  }
  const cfg = CONFIG[id] || {};
  // Übungen/Materialien nur behalten, wenn Datei existiert
  const exist = (m) => fs.existsSync(path.join(cdir, m.dir || "uebungen", m.file + ".pdf"));
  const uebungen = (cfg.uebungen || []).filter(exist).map((m) => ({ file: m.file, label: m.label, dir: m.dir || "uebungen" }));
  const materialien = (cfg.materialien || []).filter(exist).map((m) => ({ file: m.file, label: m.label, dir: m.dir || "uebungen" }));

  const out = `(window.WINFO_DATA=window.WINFO_DATA||{})[${JSON.stringify(id)}]=` +
    JSON.stringify({ topics, slides, uebungen, materialien }) + ";\n";
  fs.writeFileSync(path.join(cdir, "data.js"), out);
  const tc = Object.keys(topics).length;
  let fc = 0, qz = 0, kp = 0;
  Object.values(topics).forEach((t) => { fc += (t.flashcards || []).length; qz += (t.quiz || []).length; kp += (t.kernpunkte || []).length; });
  console.log(`${id}: topics=${tc} slides=${Object.values(slides).reduce((a, b) => a + b, 0)} flashcards=${fc} quiz=${qz} kernpunkte=${kp} ueb=${uebungen.length} mat=${materialien.length} -> ${(out.length / 1024).toFixed(0)}KB`);
}

const ids = process.argv.slice(2);
(ids.length ? ids : ["im", "gwi", "eib"]).forEach(buildCourse);
