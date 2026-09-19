# Marvel Universe Graph

The Marvel Cinematic Universe as a [FalkorDB](https://www.falkordb.com) graph, with a comic-style website to explore it.

Ask a question twice: once to an AI model with **no graph**, and once to the same model **with the graph**. The model alone forgets heroes and invents facts. With the graph it answers from real links, and the site lights up the path it used.

Use this repository to learn how to build something like it: load data into FalkorDB, query it with Cypher, draw it, and let an agent answer from it.

| Folder | What it is |
|---|---|
| `marvel-graph/` | Python loader. Builds the graph (about 2,000 nodes, 3,600 links) from Wikidata plus hand-written hero facts. |
| `marvel-web/` | Next.js website: graph view, a five-step story ("Thanos is coming"), and a chat that answers only from the graph. |

## Run it

You need Docker, Python 3 and Node.js 20 or newer.

```sh
# 1. Start FalkorDB (or use a free cloud instance: https://app.falkordb.cloud)
docker run -d --name falkordb-marvel -p 6379:6379 -p 3000:3000 falkordb/falkordb

# 2. Load the graph
cd marvel-graph && pip install -r requirements.txt && python load.py

# 3. Start the website
cd ../marvel-web && cp .env.example .env.local
npm install && npm run dev -- -p 3100
```

Open http://localhost:3100. The five story steps work with no AI key. For the chat and the "no graph" comparison, put an [OpenRouter](https://openrouter.ai) key in `LLM_API_KEY` in `marvel-web/.env.local`. Any OpenAI-compatible endpoint works. The default models are small open-weight ones, at about $0.0003 per question.

Cloud database: put `FALKORDB_URL=falkor://user:password@host:port` in `marvel-web/.env.local`, then run `marvel-graph/load_cloud.sh`.

## How it works

```
question ──> LLM writes Cypher ──> FalkorDB (read-only query) ──> rows ──> LLM answers from the rows only
                                         │
                                         └──> names in the rows ──> the site lights up those nodes
```

| To learn how to... | Read |
|---|---|
| Model a domain as a graph (labels, link types) | `marvel-graph/README.md`, `marvel-graph/curated.py` |
| Load nodes and links in batches with `UNWIND` | `marvel-graph/load.py` |
| Connect from Node.js and run read-only queries | `marvel-web/lib/db.ts` |
| Turn a question into Cypher, with one repair try when the query fails | `marvel-web/app/api/chat/route.ts` |
| Write multi-condition and path queries | `marvel-web/lib/missions.ts` |
| Draw a graph with pictures in the browser | `marvel-web/components/Universe.tsx` (react-force-graph-2d) |

Example: an Avenger who can fly **and** has wielded Mjolnir. Three conditions in one query. A vector search cannot do this.

```cypher
MATCH (c:Character)-[:HAS_POWER]->(:Power {name:'flight'}),
      (c)-[:MEMBER_OF]->(:Team {name:'Avengers'}),
      (c)-[:WIELDED]->(:Item {name:'Mjolnir'})
RETURN c.alias
```

### Things I learned about FalkorDB

- Use `GRAPH.RO_QUERY` (`graph.roQuery` in falkordb-ts) for everything an LLM writes. The model can then never change your data.
- Give the model the schema, a few real values ('Avengers', 'flight'), and the rules of the dialect. For example, the `=~` regex operator is not supported, so tell it to use `CONTAINS` with `toLower()`.
- `shortestPath()` works only in `WITH`/`RETURN` and only along the link direction. For "how is A connected to B" in any direction, use the procedure:
  `CALL algo.SPpaths({sourceNode: a, targetNode: b, relTypes: [...], relDirection: 'both', maxLen: 6, pathCount: 1}) YIELD path`
- Ask the model to return the names of every node on the path, not only the final answer. The UI can then show why the answer is true.
- Tell the answering model to use only the rows. When there are no rows, the honest answer is "the graph has no such link". Step 5 of the story shows this.

## Demo with no internet

The five story steps have recorded answers in `marvel-web/public/backup/`. The page uses them when the live call fails or takes more than 8 seconds. Add `?backup=1` to the address to use only the recorded answers. Record again with `cd marvel-web && node scripts/record-backup.mjs http://localhost:3100`. Models do not give the same answer every time; `--keep=<step>` keeps the recorded "no graph" answer of a step.

## Credits and license

The code is under the MIT license (see `LICENSE`). The graph data comes from [Wikidata](https://www.wikidata.org) (CC0) plus hand-written facts in `marvel-graph/curated.py`.

This is an unofficial fan project. It is not affiliated with Marvel or Disney. The pictures in `marvel-web/public/wiki/` are © Marvel Studios, from the [MCU fan wiki](https://marvelcinematicuniverse.fandom.com), and the actor photos come from Wikimedia Commons. They are not covered by the MIT license. If you are a rights holder and want a picture removed, open an issue.
