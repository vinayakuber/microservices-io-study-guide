// ============================================================
// Microservice Patterns Chapters Registry — PARTS + registerChapter()
// ============================================================
// "Microservice Patterns" (2nd Edition) by Chris Richardson
// (Manning, 2018) + microservices.io — the official companion site.
//
//   Part 1  : Architecture                     (chapters 1-4)
//   Part 2  : Inter-service Communication      (chapters 5-7)
//   Part 3  : Service Discovery                (chapters 8-11)
//   Part 4  : Distributed Data                 (chapters 12-20)
//   Part 5  : Queries & API Gateway            (chapters 21-24)
//   Part 6  : Testing                          (chapters 25-27)
//   Part 7  : Security & Configuration         (chapters 28-29)
//   Part 8  : Observability                    (chapters 30-36)
//   Part 9  : Deployment                       (chapters 37-42)
//   Part 10 : Refactoring                      (chapters 43-44)
// ============================================================

var PARTS = [
  { num: 1, label: "Part 1: Architecture" },
  { num: 2, label: "Part 2: Inter-service Communication" },
  { num: 3, label: "Part 3: Service Discovery" },
  { num: 4, label: "Part 4: Distributed Data" },
  { num: 5, label: "Part 5: Queries & API Gateway" },
  { num: 6, label: "Part 6: Testing" },
  { num: 7, label: "Part 7: Security & Configuration" },
  { num: 8, label: "Part 8: Observability" },
  { num: 9, label: "Part 9: Deployment" },
  { num: 10, label: "Part 10: Refactoring" }
];

var CHAPTERS = [];

function registerChapter(ch) {
  CHAPTERS.push(ch);
}
