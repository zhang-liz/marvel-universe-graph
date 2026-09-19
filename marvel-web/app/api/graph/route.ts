import { roQuery } from "@/lib/db";

let cache: { at: number; body: unknown } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < 60_000) return Response.json(cache.body);
  try {
    const [nodes, links] = await Promise.all([
      roQuery(
        "MATCH (n) RETURN id(n) AS id, labels(n)[0] AS label, n.name AS name, n.alias AS alias, n.image AS image, n.core AS core, n.kind AS kind, n.year AS year, n.played_by AS playedBy, n.wiki AS wiki",
        15000,
      ),
      roQuery("MATCH (a)-[r]->(b) RETURN id(a) AS source, id(b) AS target, type(r) AS type", 15000),
    ]);
    cache = { at: Date.now(), body: { nodes, links } };
    return Response.json(cache.body);
  } catch (e) {
    return Response.json({ error: `Cannot reach FalkorDB: ${(e as Error).message}` }, { status: 503 });
  }
}
