/* Kurs-Registry für das Winfo-Lernportal.
   examDate: ISO-String für Countdown, oder null (kein Countdown). */
window.WINFO = {
  brand: "Winfo",
  subtitle: "Wirtschaftsinformatik · Lernportal",
  semesters: [
    { id: "1", name: "1. Semester" },
    { id: "2", name: "2. Semester" }
  ],
  courses: [
    { id: "gwi", name: "Grundlagen der Wirtschaftsinformatik", short: "GWI", semester: "1", examDate: "2026-07-29T09:00:00", icon: "💻" },
    { id: "eib", name: "Einführung in die BWL", short: "BWL", semester: "1", examDate: "2026-07-22T09:00:00", icon: "📊" },
    { id: "im",  name: "Informationsmanagement", short: "IM", semester: "2", examDate: "2026-07-21T09:00:00", icon: "📘" }
  ]
};
