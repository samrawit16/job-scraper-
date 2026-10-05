import * as fs from "fs";

const KEY = process.env.GROQ_API_KEY;
if (!KEY) {
  console.error("GROQ_API_KEY missing");
  process.exit(1);
}

const MODEL = "openai/gpt-oss-20b";
const URL = "https://api.groq.com/openai/v1/chat/completions";

let jobs: any[];
if (fs.existsSync("data/jobs_final.json")) {
  jobs = JSON.parse(fs.readFileSync("data/jobs_final.json", "utf8"));
  const done = jobs.filter((j: any) => j.skills && j.skills.length > 0).length;
  console.log(`resuming: ${done} already done`);
} else {
  jobs = JSON.parse(fs.readFileSync("data/jobs_enriched.json", "utf8"));
}

async function extractSkills(batch: any[]): Promise<any[]> {
  const lines = batch.map((j, i) => `${i}: ${j.title} — ${(j.description || "").slice(0, 400).replace(/\s+/g, " ")}`);
  const prompt = `Extract the top skills mentioned in each numbered job posting (tech, tools, methods, soft skills). Up to 6 skills per job. Skills must be short (1-3 words).
Answer with ONLY one line per job, format: "number: skill1, skill2, skill3" — nothing else.

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
    return batch.map(() => []);
  }
  const data = await res.json();
  const text = (data?.choices?.[0]?.message?.content || "").trim().toLowerCase();
  const out: any[] = batch.map(() => []);
  for (const line of text.split("\n")) {
    const m = line.match(/(\d+)\s*[:\-]\s*(.+)/);
    if (m) {
      const idx = parseInt(m[1], 10);
      const skills = m[2].split(",").map((s: string) => s.trim()).filter(Boolean).slice(0, 6);
      if (idx >= 0 && idx < batch.length) out[idx] = skills;
    }
  }
  return out;
}

async function main() {
  const batchSize = 10;
  let done = 0;
  const todo = jobs.filter((j: any) => !j.skills || j.skills.length === 0);
  console.log(`${todo.length} jobs left to process`);
  for (let i = 0; i < todo.length; i += batchSize) {
    const batch = todo.slice(i, i + batchSize);
    const allSkills = await extractSkills(batch);
    batch.forEach((j: any, k: number) => { j.skills = allSkills[k]; });
    done += batch.length;
    fs.writeFileSync("data/jobs_final.json", JSON.stringify(jobs, null, 2));
    console.log(`${done}/${todo.length} done`);
    await new Promise((r) => setTimeout(r, 10000));
  }
  console.log("done");
}

main();
