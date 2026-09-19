"""Load the Marvel Cinematic Universe graph into FalkorDB.

Two layers:
  1. Wikidata (CC0): everything tagged "from narrative universe: MCU" -
     characters, items, places, works they appear in, actors, family, teams.
  2. curated.py: powers, teams, species, homes and items for the core heroes.

Usage:
  python load.py                      # localhost:6379
  FALKORDB_URL=falkor://user:password@host:port python load.py   # cloud (falkors:// for TLS)
"""
import csv
import os
from collections import defaultdict
from pathlib import Path

from falkordb import FalkorDB

import apply_images
import curated

DATA = Path(__file__).parent / "data"
GRAPH = os.getenv("FALKORDB_GRAPH", "marvel")

SPECIES_TYPES = {"Asgardian", "Eternal", "Kree", "frost giant", "mutate", "Xandarian", "Krylorian", "Skrull",
                 "supersoldier", "cyborg in a work of fiction", "artificial intelligence in fiction", "fictional robot"}
ITEM_WORDS = ("armor", "weapon", "object", "device", "vehicle", "book", "group of objects", "substance", "material")
PLACE_WORDS = ("location", "facility", "apartment", "residence", "planet", "restaurant", "house", "building",
               "establishment", "store", "city", "hospital", "mansion", "town", "prison", "station", "shop", "base",
               "laboratory", "school", "hotel", "diner", "country", "dimension", "island", "bar", "church", "moon")
EVENT_WORDS = ("occurrence", "battle", "war", "event")
ORG_WORDS = ("network", "newspaper", "group of fictional characters", "organization", "company", "team")

REL_MAP = {"P463": "MEMBER_OF", "P108": "MEMBER_OF", "P2563": "HAS_POWER", "P7047": "ENEMY_OF",
           "P40": "PARENT_OF", "P26": "SPOUSE_OF", "P3373": "SIBLING_OF", "P451": "PARTNER_OF"}


def qid(uri):
    return uri.rsplit("/", 1)[-1]


def classify(types):
    if any("species" in t or "extraterrestrials" in t for t in types):
        return "Species"
    if any("character" in t or "fictional human" == t or "humanoid" in t for t in types) or types & SPECIES_TYPES:
        return "Character"
    for words, label in ((ITEM_WORDS, "Item"), (EVENT_WORDS, "Event"), (ORG_WORDS, "Organization"), (PLACE_WORDS, "Location")):
        if any(w in t for t in types for w in words):
            return label
    return "Thing"


def read(name):
    with open(DATA / name, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def batches(rows, n=500):
    for i in range(0, len(rows), n):
        yield rows[i:i + n]


def main():
    db = apply_images.connect()
    if GRAPH in db.list_graphs():
        db.select_graph(GRAPH).delete()
    g = db.select_graph(GRAPH)

    def run(query, rows):
        for b in batches(rows):
            g.query(query, {"rows": b})

    # ---- Wikidata layer
    rels = read("rels.csv")
    types = defaultdict(set)
    for r in rels:
        if r["p"].endswith("P31"):
            types[qid(r["c"])].add(r["oLabel"])
    entities = {}
    for r in read("chars.csv"):
        q = qid(r["c"])
        if r["cLabel"] == q:  # no English label
            continue
        label = ("Character" if r["cLabel"] in curated.HEROES else "Item" if r["cLabel"] in curated.ITEMS
                 else classify(types[q]))
        entities[q] = {"qid": q, "name": r["cLabel"], "gender": r.get("genderLabel") or None, "label": label}
    for label in {e["label"] for e in entities.values()}:
        g.query(f"CREATE INDEX FOR (n:{label}) ON (n.name)")
        g.query(f"CREATE INDEX FOR (n:{label}) ON (n.qid)")
        run(f"UNWIND $rows AS r CREATE (n:{label} {{qid: r.qid, name: r.name}}) SET n.gender = r.gender",
            [e for e in entities.values() if e["label"] == label])
    for label in ("Work", "Actor", "Team", "Power"):
        g.query(f"CREATE INDEX FOR (n:{label}) ON (n.name)")

    works, appears = {}, set()
    for r in read("works.csv"):
        c, w = qid(r["c"]), qid(r["w"])
        if c not in entities or w in {"Q390137"}:  # a God of War game that Wikidata links to the wrong Thor
            continue
        rec = works.setdefault(w, {"qid": w, "name": r["wLabel"], "kinds": set(), "year": None})
        rec["kinds"].add(r["typeLabel"])
        if r["date"] and (rec["year"] is None or int(r["date"][:4]) < rec["year"]):
            rec["year"] = int(r["date"][:4])
        appears.add((c, w))
    for w in works.values():
        kinds = " ".join(w.pop("kinds"))
        w["kind"] = ("series" if "series" in kinds or "episode" in kinds else "game" if "game" in kinds
                     else "film" if "film" in kinds or "quel" in kinds else "other")
    run("UNWIND $rows AS r CREATE (:Work {qid: r.qid, name: r.name, kind: r.kind, year: r.year})", list(works.values()))
    by_label = defaultdict(list)
    for c, w in appears:
        by_label[entities[c]["label"]].append({"c": c, "w": w})
    for label, rows in by_label.items():
        run(f"UNWIND $rows AS r MATCH (n:{label} {{qid: r.c}}), (w:Work {{qid: r.w}}) "
            "CREATE (n)-[:APPEARS_IN {source:'wikidata'}]->(w)", rows)

    actors = [{"c": qid(r["c"]), "a": qid(r["a"]), "name": r["aLabel"]} for r in read("actors.csv") if qid(r["c"]) in entities]
    run("UNWIND $rows AS r MERGE (a:Actor {qid: r.a}) SET a.name = r.name", actors)
    run("UNWIND $rows AS r MATCH (a:Actor {qid: r.a}), (c:Character {qid: r.c}) "
        "MERGE (a)-[:PLAYS {source:'wikidata'}]->(c)", actors)

    extra = {r["aLabel"]: r for r in read("extra_actors.csv")}
    for char, actor in curated.EXTRA_CAST.items():
        g.query("MATCH (c:Character {name: $c}) MERGE (a:Actor {qid: $q}) SET a.name = $a "
                "MERGE (a)-[:PLAYS {source:'curated'}]->(c)", {"c": char, "a": actor, "q": qid(extra[actor]["a"])})

    # Photos: free-licensed actor portraits from Wikimedia Commons. A character shows its best-known actor.
    photos = [{"a": qid(r["a"]), "img": r["image"].replace("http://", "https://") + "?width=256",
               "pop": int(r["sitelinks"])} for r in read("actor_images.csv") + list(extra.values()) if r["image"]]
    run("UNWIND $rows AS r MATCH (a:Actor {qid: r.a}) SET a.image = r.img, a.popularity = r.pop", photos)
    g.query("MATCH (a:Actor)-[:PLAYS]->(c:Character) WHERE a.image IS NOT NULL "
            "WITH c, a ORDER BY a.popularity DESC WITH c, collect(a)[0] AS star "
            "SET c.image = star.image, c.actor_image = star.image, c.played_by = star.name")

    for r in rels:
        p, c, o = r["p"].rsplit("/", 1)[-1], qid(r["c"]), qid(r["o"])
        if p not in REL_MAP or c not in entities or entities[c]["label"] != "Character":
            continue
        rel, row = REL_MAP[p], {"rows": [{"c": c, "o": o, "name": r["oLabel"]}]}
        if rel == "MEMBER_OF":
            g.query("UNWIND $rows AS r MATCH (c:Character {qid: r.c}) MERGE (t:Team {name: r.name}) "
                    "MERGE (c)-[:MEMBER_OF {source:'wikidata'}]->(t)", row)
        elif rel == "HAS_POWER":
            row["rows"][0]["name"] = r["oLabel"].replace(" in fiction", "").replace(" / reflexes", "")
            g.query("UNWIND $rows AS r MATCH (c:Character {qid: r.c}) MERGE (p:Power {name: r.name}) "
                    "MERGE (c)-[:HAS_POWER {source:'wikidata'}]->(p)", row)
        elif o in entities and entities[o]["label"] == "Character":
            g.query(f"UNWIND $rows AS r MATCH (c:Character {{qid: r.c}}), (o:Character {{qid: r.o}}) "
                    f"MERGE (c)-[:{rel} {{source:'wikidata'}}]->(o)", row)

    # Wikidata has a few works with no English label, and a few characters with several versions.
    g.query("MATCH (w:Work) WHERE w.name = w.qid DETACH DELETE w")  # still unnamed: drop it
    for name in curated.HEROES:
        rows = g.query("MATCH (c:Character {name: $n}) OPTIONAL MATCH (c)-[a:APPEARS_IN]->() "
                       "WITH c, count(a) AS films OPTIONAL MATCH (c)<-[p:PLAYS]-() "
                       "RETURN c.qid, count(p) > 0 AS has_actor, films ORDER BY has_actor DESC, films DESC",
                       {"n": name}).result_set
        for q, *_ in rows[1:]:  # keep the node with an actor and the most films as the main version
            g.query("MATCH (c:Character {qid: $q}) SET c.name = $n", {"q": q, "n": f"{name} (other version)"})

    # Wikidata sometimes has two entries for one thing ("Asgardian"): keep one node, move the links to it
    for (name,) in g.query("MATCH (s:Species) WITH s.name AS n, count(*) AS c WHERE c > 1 RETURN n").result_set:
        ids = [r[0] for r in g.query("MATCH (s:Species {name: $n}) RETURN id(s) ORDER BY id(s)", {"n": name}).result_set]
        for dup in ids[1:]:
            g.query("MATCH (d) WHERE id(d) = $d MATCH (k) WHERE id(k) = $k OPTIONAL MATCH (d)-[:APPEARS_IN]->(w:Work) "
                    "FOREACH (x IN CASE WHEN w IS NULL THEN [] ELSE [w] END | MERGE (k)-[:APPEARS_IN {source:'wikidata'}]->(x))",
                    {"d": dup, "k": ids[0]})
            g.query("MATCH (d) WHERE id(d) = $d DETACH DELETE d", {"d": dup})

    # ---- curated layer
    for name, (alias, species, home, teams, powers) in curated.HEROES.items():
        res = g.query("MATCH (c:Character {name: $n}) SET c.alias = $a, c.core = true RETURN count(c)", {"n": name, "a": alias})
        assert res.result_set[0][0] >= 1, f"curated hero not in Wikidata set: {name}"
        g.query("MATCH (c:Character {name: $n}) MERGE (s:Species {name: $s}) MERGE (c)-[:IS_A {source:'curated'}]->(s)",
                {"n": name, "s": species})
        if home:
            g.query("MATCH (c:Character {name: $n}) MERGE (l:Location {name: $h}) MERGE (c)-[:FROM {source:'curated'}]->(l)",
                    {"n": name, "h": home})
        for t in teams:
            g.query("MATCH (c:Character {name: $n}) MERGE (t:Team {name: $t}) MERGE (c)-[r:MEMBER_OF]->(t) "
                    "ON CREATE SET r.source = 'curated'", {"n": name, "t": t})
        for p in powers:
            g.query("MATCH (c:Character {name: $n}) MERGE (p:Power {name: $p}) MERGE (c)-[r:HAS_POWER]->(p) "
                    "ON CREATE SET r.source = 'curated'", {"n": name, "p": p})
    for item, kind in curated.ITEMS.items():
        g.query("MERGE (i:Item {name: $i}) SET i.kind = $k", {"i": item, "k": kind})
    pairs = [
        (curated.WIELDED, "Character", "Item", "WIELDED"), (curated.CONTAINED_IN, "Item", "Item", "CONTAINED_IN"),
        (curated.ENEMIES, "Character", "Character", "ENEMY_OF"), (curated.MENTORED, "Character", "Character", "MENTORED"),
    ]
    for rows, la, lb, rel in pairs:
        for a, b in rows:
            res = g.query(f"MATCH (a:{la} {{name: $a}}), (b:{lb} {{name: $b}}) MERGE (a)-[r:{rel}]->(b) "
                          "ON CREATE SET r.source = 'curated' RETURN count(r)", {"a": a, "b": b})
            assert res.result_set[0][0] >= 1, f"missing node for {rel}: {a} -> {b}"
    for stone, place in curated.LOCATED_AT:
        g.query("MATCH (i:Item {name: $i}) MERGE (l:Location {name: $l}) MERGE (i)-[:LOCATED_AT {source:'curated'}]->(l)",
                {"i": stone, "l": place})

    print("movie stills applied:", apply_images.apply(g))  # run fetch_images.py first to download them

    nodes = g.query("MATCH (n) RETURN labels(n)[0], count(n) ORDER BY count(n) DESC").result_set
    edges = g.query("MATCH ()-[r]->() RETURN type(r), count(r) ORDER BY count(r) DESC").result_set
    print("graph:", GRAPH)
    print("nodes:", sum(n for _, n in nodes), dict(nodes))
    print("edges:", sum(n for _, n in edges), dict(edges))


if __name__ == "__main__":
    main()
