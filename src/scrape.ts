import * as fs from "fs";
import * as cheerio from "cheerio";

const CATEGORIES = [
  "remote-programming-jobs",
  "remote-devops-sysadmin-jobs",
  "remote-design-jobs",
  "remote-customer-support-jobs",
  "remote-product-jobs",
  "remote-full-stack-programming-jobs",
  "remote-front-end-programming-jobs",
  "remote-back-end-programming-jobs",
];

const BASE = "https://weworkremotely.com/categories/";
const UA = "JobScraper/1.0 (student project; samrawit@example.com)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const randDelay = () => sleep(1000 + Math.floor(Math.random() * 2000));

interface Job {
  title: string;
  company: string;
  url: string;
  location: string;
  category: string;
  posted_date: string;
  description: string;
}

function validate(raw: any): Job | null {
  if (!raw.title || !raw.url) return null;
  const idx = raw.title.indexOf(":");
  return {
    company: idx > 0 ? raw.title.slice(0, idx).trim() : "Unknown",
    title: idx > 0 ? raw.title.slice(idx + 1).trim() : raw.title,
    url: raw.url,
    location: raw.region || "Unknown",
    category: raw.category || "Unknown",
    posted_date: raw.pubDate || "",
    description: (raw.description || "").replace(/<[^>]+>/g, " ").trim().slice(0, 2000),
  };
}

async function scrapeWwr(jobs: Job[], seen: Set<string>) {
  for (const cat of CATEGORIES) {
    const res = await fetch(BASE + cat + ".rss", { headers: { "User-Agent": UA } });
    if (!res.ok) {
      console.error(`failed to fetch ${cat}: HTTP ${res.status}`);
      continue;
    }
    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });

    $("item").each((_, item) => {
      const raw = {
        title: $("title", item).text(),
        url: $("link", item).text().trim(),
        region: $("region", item).text(),
        category: $("category", item).text(),
        pubDate: $("pubDate", item).text(),
        description: $("description", item).text(),
      };
      const job = validate(raw);
      if (!job || seen.has(job.url)) return;
      seen.add(job.url);
      jobs.push(job);
    });

    console.log(`wwr ${cat}: total so far ${jobs.length}`);
    await randDelay();
  }
}

async function scrapeJobicy(jobs: Job[], seen: Set<string>) {
  const res = await fetch("https://jobicy.com/api/v2/remote-jobs?count=100", {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) {
    console.error(`failed to fetch jobicy: HTTP ${res.status}`);
    return;
  }
  const data = await res.json();
  for (const j of data.jobs) {
    const job = validate({
      title: `${j.companyName}: ${j.jobTitle}`,
      url: j.url,
      region: j.jobGeo,
      category: (j.jobIndustry || []).join(", ") || "Unknown",
      pubDate: j.pubDate,
      description: j.jobDescription || j.jobExcerpt || "",
    });
    if (!job || seen.has(job.url)) continue;
    seen.add(job.url);
    jobs.push(job);
  }
  console.log(`jobicy: total so far ${jobs.length}`);
}

async function main() {
  const jobs: Job[] = [];
  const seen = new Set<string>();

  await scrapeWwr(jobs, seen);
  await scrapeJobicy(jobs, seen);

  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync("data/jobs.json", JSON.stringify(jobs, null, 2));
  console.log(`saved ${jobs.length} jobs to data/jobs.json`);
}

main();
