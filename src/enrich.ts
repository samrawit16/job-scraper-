import * as fs from "fs";

const KEY = process.env.GROQ_API_KEY;
if (!KEY) {
  console.error("set GROQ_API_KEY in .env first");
  process.exit(1);
}

const MODEL = "openai/gpt-oss-20b";

const URL = "https://api.groq.com/openai/v1/chat/completions";

let jobs: any[];
if (fs.existsSync("data/jobs_enriched.json")) {
  jobs = JSON.parse(fs.readFileSync("data/jobs_enriched.json", "utf8"));
  console.log(`resuming: ${jobs.filter((j: any) => j.seniority && j.seniority !== "unknown").length} already labeled`);
} else {
  jobs = JSON.parse(fs.readFileSync("data/jobs.json", "utf8"));
}

async function classifyBatch(batch: any[]): Promise<string[]> {
  const lines = batch.map((j, i) => `${i}: ${j.title} — ${j.description.slice(0, 300).replace(/\s+/g, " ")}`);
  const prompt = `Classify each numbered job posting's seniority as exactly one of: intern, junior, mid, senior, lead, unknown.
Rules: use the title primarily. No clear signal = unknown.
Answer with ONLY one label per line, format "number: label" — nothing else.

${lines.join("\n")}`;

  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    }),
  });
  if (!res.ok) {
    console.error(`API error ${res.status} on batch`);
    return batch.map(() => "unknown");
  }
  const data = await res.json();
  const text = (data?.choices?.[0]?.message?.content || "").trim().toLowerCase();
  const out: string[] = batch.map(() => "unknown");
  const valid = ["intern", "junior", "mid", "senior", "lead"];
  for (const line of text.split("\n")) {
    const m = line.match(/(\d+)\s*[:\-]\s*(\w+)/);
    if (m) {
      const idx = parseInt(m[1], 10);
      if (idx >= 0 && idx < batch.length && valid.includes(m[2])) out[idx] = m[2];
    }
  }
  return out;
}

async function main() {
  const batchSize = 10;
  let done = 0;
  const todo = jobs.filter((j: any) => !j.seniority || j.seniority === "unknown");
  console.log(`${todo.length} jobs left to classify`);
  for (let i = 0; i < todo.length; i += batchSize) {
    const batch = todo.slice(i, i + batchSize);
    const labels = await classifyBatch(batch);
    batch.forEach((j: any, k: number) => { j.seniority = labels[k]; });
    done += batch.length;
    fs.writeFileSync("data/jobs_enriched.json", JSON.stringify(jobs, null, 2));
    console.log(`${done}/${todo.length} classified`);
    await new Promise((r) => setTimeout(r, 20000));
  }
  console.log("done");
}

main();
