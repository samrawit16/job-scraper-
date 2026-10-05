import * as fs from "fs";

const jobs: any[] = JSON.parse(fs.readFileSync("data/jobs_final.json", "utf8"));

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const sample = shuffle(jobs).slice(0, 30);
const rows = ["url,title,predicted_seniority,your_label"];
for (const j of sample) {
  rows.push(`"${j.url}","${j.title.replace(/"/g, "'")}",${j.seniority},`);
}
fs.writeFileSync("data/audit_sample.csv", rows.join("\n"));
console.log("wrote data/audit_sample.csv — open it and fill in your_label for each row");
