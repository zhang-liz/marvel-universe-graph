# Marvel Cinematic Universe graph for FalkorDB

A demo graph: about 2,000 nodes and 3,600 edges.

| Layer | What | Source |
| --- | --- | --- |
| Wikidata | characters, items, places, films and series they appear in, actors, family, teams | Wikidata, CC0 (`data/*.csv`) |
| Curated | powers, teams, species, homes, Infinity Stones and weapons for 54 core heroes | `curated.py` (edges tagged `source: 'curated'`) |

## Load it

```bash
docker run -d -p 6379:6379 -p 3000:3000 falkordb/falkordb   # skip if you use a cloud instance
pip install -r requirements.txt
python load.py
```

Cloud instance:

```bash
FALKORDB_HOST=<host> FALKORDB_PORT=<port> FALKORDB_USERNAME=<user> FALKORDB_PASSWORD=<password> python load.py
```

Then open the Browser at http://localhost:3000 and pick the graph `marvel`.

## Schema

`(:Character)-[:APPEARS_IN]->(:Work)`, `(:Actor)-[:PLAYS]->(:Character)`,
`(:Character)-[:MEMBER_OF]->(:Team)`, `-[:HAS_POWER]->(:Power)`, `-[:IS_A]->(:Species)`, `-[:FROM]->(:Location)`,
`-[:WIELDED]->(:Item)`, `-[:ENEMY_OF|MENTORED|PARENT_OF|SPOUSE_OF|SIBLING_OF|PARTNER_OF]->(:Character)`,
`(:Item)-[:CONTAINED_IN]->(:Item)`, `(:Item)-[:LOCATED_AT]->(:Location)`.
Other Wikidata entities: `:Item`, `:Location`, `:Event`, `:Organization`, `:Species`, `:Thing`.

## Try it

```cypher
// The mission: an Avenger who can fly and has wielded Mjolnir
MATCH (c:Character)-[:HAS_POWER]->(:Power {name:'flight'}),
      (c)-[:MEMBER_OF]->(:Team {name:'Avengers'}),
      (c)-[:WIELDED]->(:Item {name:'Mjolnir'})
RETURN c.name

// Count: how many Avengers can fly?
MATCH (c:Character)-[:MEMBER_OF]->(:Team {name:'Avengers'}), (c)-[:HAS_POWER]->(:Power {name:'flight'})
RETURN count(DISTINCT c)

// Multi-hop: who held the stone that was inside the Tesseract?
MATCH (s:Item)-[:CONTAINED_IN]->(:Item {name:'Tesseract'}), (c:Character)-[:WIELDED]->(s)
RETURN s.name, c.name
```

Character and film names are trademarks of their owners. This is an unofficial fan demo.
