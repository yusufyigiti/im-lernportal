# WINFO – Klausur-Lernportal

Lernwebsite für die Klausur **Informationsmanagement** (Uni Stuttgart, Dr. Baars) am **21.07.2026**.

## Inhalt
- **Übersicht** – Countdown bis zur Klausur, Statistiken, Themenkacheln, Lerntipps
- **Themen** – ausführliche deutsche Zusammenfassungen je Vorlesung, Glossar und die **Originalfolien daneben** zur Kontrolle
- **Karteikarten** – interaktive Lernkarten mit Fortschritts-Tracking (gespeichert im Browser)
- **Test** – Probeklausur mit Multiple-Choice-Fragen, Sofort-Auswertung und Erklärungen
- **Folien** – alle Vorlesungs-PDFs und die 3 Fallstudien zum Ansehen/Download

Die Inhalte (10 Themen, ~180 Karteikarten, ~110 Testfragen, ~206 Begriffe) wurden automatisch aus den Vorlesungsfolien erstellt. Im Zweifel bitte mit den Originalfolien abgleichen.

## Lokal ansehen
Einfach `index.html` im Browser öffnen (Doppelklick). Es ist kein Server nötig – die Daten liegen in `assets/data.js`.

## Auf GitHub Pages veröffentlichen
1. Neues GitHub-Repository anlegen (z. B. `im-lernportal`).
2. **Den gesamten Inhalt dieses `site`-Ordners** ins Repository hochladen (sodass `index.html` im Wurzelverzeichnis des Repos liegt).
   ```bash
   cd site
   git init
   git add .
   git commit -m "IM Lernportal"
   git branch -M main
   git remote add origin https://github.com/<DEIN-NAME>/im-lernportal.git
   git push -u origin main
   ```
3. Im Repo: **Settings → Pages → Branch: `main` / root → Save**.
4. Nach ein paar Minuten ist die Seite unter `https://<DEIN-NAME>.github.io/im-lernportal/` erreichbar.

> Hinweis: Die PDFs liegen im Ordner `folien/`. Beim Hochladen mitnehmen, damit „Originalfolien" und „Folien" funktionieren.

## Struktur
```
site/
├─ index.html
├─ assets/
│  ├─ style.css
│  ├─ app.js
│  └─ data.js        # gebündelte Lerninhalte
├─ data/             # Einzel-JSONs je Thema (Quelle)
└─ folien/           # Original-PDFs (01–12) + Fallstudien
```
