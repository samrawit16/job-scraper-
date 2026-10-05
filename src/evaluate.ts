import * as fs from "fs";

const jobs: any[] = JSON.parse(fs.readFileSync("data/jobs_final.json", "utf8"));
const lines = fs.readFileSync("data/audit_sample.csv", "utf8").split("\n").slice(1);

const byUrl = new Map(jobs.map((j) => [j.url, j]));

const labels = ["intern", "junior", "mid", "senior", "lead", "unknown"];
let correct = 0;
let total = 0;
const confusion = new Map<string, number>();
const perLabel = new Map<string, { tp: number; fp: number; fn: number }>();
for (const l of labels) perLabel.set(l, { tp: 0, fp: 0, fn: 0 });

for (const line of lines) {
  if (!line.trim()) continue;
  const cells = line.match(/"([^"]*)","([^"]*)",([^,]*),([^,]*)/);
  if (!cells) continue;
  const url = cells[1];
  const predicted = cells[3].trim();
  const truth = cells[4].trim().toLowerCase();
  if (!truth) continue;
  total++;

  const job = byUrl.get(url);
  const pred = job ? job.seniority : predicted;

  if (pred === truth) correct++;
  confusion.set(`${pred} -> ${truth}`, (confusion.get(`${pred} -> ${truth}`) || 0) + 1);

  const tp = perLabel.get(truth)!;
  if (pred === truth) tp.tp++;
  else {
    tp.fn++;
    perLabel.get(pred)!.fp++;
  }
}

console.log(`Overall accuracy: ${correct}/${total} = ${((correct / total) * 100).toFixed(1)}%\n`);

let report = "# Accuracy Report\n\n";
report += `Sample size: ${total} hand-labeled postings\n\n`;
report += `## Overall accuracy: ${(correct / total * 100).toFixed(1)}%\n\n`;
report += "## Per-label precision / recall\n\n";
report += "| label | precision | recall |\n|---|---|---|\n";
for (const [label, s] of perLabel) {
  const precision = s.tp + s.fp > 0 ? (s.tp / (s.tp + s.fp)) * 100 : 0;
  const recall = s.tp + s.fn > 0 ? (s.tp / (s.tp + s.fn)) * 100 : 0;
  report += `| ${label} | ${precision.toFixed(1)}% | ${recall.toFixed(1)}% |\n`;
}
report += "\n## Confusions (predicted -> actual)\n\n";
for (const [k, n] of [...confusion.entries()].sort((a, b) => b[1] - a[1])) {
  report += `- ${k}: ${n}\n`;
}
fs.writeFileSync("accuracy_report.md", report);
console.log(report);
