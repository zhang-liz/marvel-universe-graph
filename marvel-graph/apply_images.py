"""Point graph nodes at the downloaded movie stills (data/wiki_images.csv). Fast; safe to run again and again.

IMAGE_SOURCE=actors python apply_images.py   -> switch characters back to the free-licensed actor photos
"""
import csv
import os
from pathlib import Path

from falkordb import FalkorDB

CSV = Path(__file__).parent / "data" / "wiki_images.csv"


def connect():
    """FALKORDB_URL=falkor://user:password@host:port (falkors:// for TLS), or the FALKORDB_HOST/PORT/... variables."""
    if os.getenv("FALKORDB_URL"):
        return FalkorDB.from_url(os.environ["FALKORDB_URL"])
    return FalkorDB(host=os.getenv("FALKORDB_HOST", "localhost"), port=int(os.getenv("FALKORDB_PORT", "6379")),
                    username=os.getenv("FALKORDB_USERNAME") or None, password=os.getenv("FALKORDB_PASSWORD") or None)


def apply(g):
    # actor_image always keeps the Wikimedia Commons portrait, so switching back is one command
    g.query("MATCH (c:Character) WHERE c.actor_image IS NOT NULL SET c.image = c.actor_image, c.wiki = NULL")
    if os.getenv("IMAGE_SOURCE") == "actors" or not CSV.exists():
        return 0
    rows = [{"name": r["name"], "wiki": r["wiki"], "img": "/wiki/" + r["file"]} for r in csv.DictReader(open(CSV, encoding="utf-8"))]
    # A film can have the same name as its hero ("Iron Man"). A "Work:" row is the film poster; plain rows skip films then.
    posters = [dict(r, name=r["name"][5:]) for r in rows if r["name"].startswith("Work:")]
    rows = [r for r in rows if not r["name"].startswith("Work:")]
    for i in range(0, len(rows), 200):
        g.query("UNWIND $rows AS r MATCH (n {name: r.name}) WHERE NOT n:Actor SET n.image = r.img, n.wiki = r.wiki",
                {"rows": rows[i:i + 200]})
    g.query("MATCH (c:Character) WHERE c.image STARTS WITH '/wiki/' WITH collect(c.name) + collect(c.alias) AS heroes "
            "MATCH (w:Work) WHERE w.name IN heroes SET w.image = NULL, w.wiki = NULL")
    g.query("UNWIND $rows AS r MATCH (w:Work {name: r.name}) SET w.image = r.img, w.wiki = r.wiki", {"rows": posters})
    return len(rows) + len(posters)


if __name__ == "__main__":
    print("nodes with a movie still:", apply(connect().select_graph(os.getenv("FALKORDB_GRAPH", "marvel"))))
