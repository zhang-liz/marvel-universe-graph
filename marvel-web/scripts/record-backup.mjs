// Records the real answers of the running site, as a backup for a demo with no internet.
//   1. npm run dev          (with the internet on)
//   2. node scripts/record-backup.mjs [http://localhost:3000]
//      add --keep=stones to keep the recorded "no graph" answer of a step (the model does not give the same answer every time)
// It writes public/backup/graph.json (the whole map) and public/backup/answers.json (the 5 story steps).
// The page uses these files when the live call fails, or always when the address ends with ?backup=1
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const site = process.argv.slice(2).find((a) => a.startsWith("http")) || "http://localhost:3000";
const keep = (process.argv.find((a) => a.startsWith("--keep="))?.slice(7) ?? "").split(",");
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "public", "backup");

const get = async (url, init) => {
  const res = await fetch(site + url, init);
  const json = await res.json();
  if (json.error) throw new Error(`${url}: ${json.error}`);
  return json;
};
const chat = (body) => get("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const ids = [...(await readFile(path.join(root, "lib", "missions.ts"), "utf8")).matchAll(/^\s+id: "(\w+)"/gm)].map((m) => m[1]);
await mkdir(out, { recursive: true });

const graph = await get("/api/graph");
await writeFile(path.join(out, "graph.json"), JSON.stringify(graph));
console.log(`graph: ${graph.nodes.length} nodes, ${graph.links.length} links`);

const old = await readFile(path.join(out, "answers.json"), "utf8").then(JSON.parse).catch(() => null);
const missions = {};
for (const missionId of ids) {
  const { answer, cypher, names } = await chat({ missionId });
  const { alone } = (keep.includes(missionId) && old?.missions[missionId]?.alone) || (await chat({ missionId, aloneOnly: true }));
  if (!alone) throw new Error(`${missionId}: the model gave no "no graph" answer. Is LLM_API_KEY set?`);
  missions[missionId] = { graph: { answer, cypher, names }, alone: { alone } };
  console.log(`\n${missionId}\n  no graph:   ${alone.answer}${alone.same ? "  (same as the graph)" : ""}\n  with graph: ${answer}`);
}
await writeFile(path.join(out, "answers.json"), JSON.stringify({ recordedAt: new Date().toISOString(), missions }, null, 2) + "\n");
console.log(`\nSaved to ${out}`);
