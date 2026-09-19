import { FalkorDB } from "falkordb";

const GRAPH = process.env.FALKORDB_GRAPH || "marvel";

let client: Promise<FalkorDB> | null = null;

function connect() {
  // FALKORDB_URL wins: falkor://user:pass@host:port (falkors:// for TLS, which paid cloud tiers use)
  const url = process.env.FALKORDB_URL;
  if (url) return FalkorDB.connect({ url });
  return FalkorDB.connect({
    socket: {
      host: process.env.FALKORDB_HOST || "localhost",
      port: Number(process.env.FALKORDB_PORT || 6379),
      ...(process.env.FALKORDB_TLS === "true" ? { tls: true as const } : {}),
    },
    username: process.env.FALKORDB_USERNAME || undefined,
    password: process.env.FALKORDB_PASSWORD || undefined,
  });
}

export type Row = Record<string, unknown>;

/** Every query from the website is read-only: the server refuses writes on GRAPH.RO_QUERY. */
export async function roQuery(cypher: string, timeoutMs = 5000): Promise<Row[]> {
  client ??= connect().catch((e) => {
    client = null;
    throw e;
  });
  const graph = (await client).selectGraph(GRAPH);
  const reply = await graph.roQuery<Row>(cypher, { TIMEOUT: timeoutMs });
  return reply.data ?? [];
}
