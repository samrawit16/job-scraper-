import * as fs from "fs";

const jobs: any[] = JSON.parse(fs.readFileSync("data/jobs_final.json", "utf8"));

const rules: [RegExp, string][] = [
  [/intern/i, "intern"],
  [/\b(junior|jr\.?|graduate|entry[- ]level)\b/i, "junior"],
  [/\b(lead|head of|director|chief|vp\b|svp|principal)\b/i, "lead"],
  [/\b(senior|sr\.?|staff)\b/i, "senior"],
];

let changed = 0;
for (const j of jobs) {
  if (j.seniority === "unknown") {
    let hit = false;
    for (const [re, label] of rules) {
      if (re.test(j.title)) { j.seniority = label; hit = true; changed++; break; }
    }
    if (!hit) { j.seniority = "mid"; changed++; }
  }
}

fs.writeFileSync("data/jobs_final.json", JSON.stringify(jobs, null, 2));
console.log(`fallback applied to ${changed} jobs`);
