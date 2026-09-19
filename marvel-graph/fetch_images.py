"""Fetch a movie still for every node that has a page on the MCU fan wiki (Fandom).

Writes data/wiki_images.csv and saves 256px images to ../marvel-web/public/wiki/.
The stills are copyrighted by Marvel Studios; the wiki uses them as fair use. This is a fan demo.
Run load.py again afterwards.
"""
import csv
import json
import os
import re
import subprocess
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from falkordb import FalkorDB

API = "https://marvelcinematicuniverse.fandom.com/api.php?"
UA = {"User-Agent": "marvel-universe-graph/0.1 (https://github.com/zhang-liz/marvel-universe-graph)"}
OUT = Path(__file__).parent.parent / "marvel-web" / "public" / "wiki"
LABELS = ["Character", "Item", "Location", "Team", "Species", "Organization", "Event", "Work"]


def get(url):
    # curl -4: the IPv6 route to this CDN can be very slow (20 s per file here), IPv4 is under 1 s
    return subprocess.run(["curl", "-4", "-sSf", "-m", "45", "--retry", "2", "-A", UA["User-Agent"], url],
                          check=True, capture_output=True).stdout


# The wiki's main picture is sometimes the wrong look (no costume, or a later hero name). Use these files instead.
OVERRIDES = {
    "Steve Rogers": "File:Cap Civil War Textless Poster.jpg",
    "Sam Wilson": "File:TF&TWS Textless Character Posters 01.jpg",
}


# The graph name is not always the wiki page name.
PAGES = {"Zemo": "Helmut Zemo", "Kraglin": "Kraglin Obfonteri", "Wenwu": "Xu Wenwu", "Lady Sif": "Sif",
         "Everett K. Ross": "Everett Ross", "James Paxton": "Jim Paxton", "Liz Toomes": "Liz Allan"}


def api(**params):
    return json.loads(get(API + urllib.parse.urlencode({"action": "query", "format": "json", **params})))["query"]


def filename(n):
    return re.sub(r"[^a-z0-9]+", "-", n.lower()).strip("-") + ".webp"  # the CDN always serves WebP


def download(job):
    n, title, url = job
    try:
        if not (OUT / filename(n)).exists():
            (OUT / filename(n)).write_bytes(get(url))
        return n, title
    except Exception:
        return None  # skip: the node keeps its actor photo or icon


def main():
    g = FalkorDB().select_graph("marvel")
    # Most important first: core heroes, then characters, then hubs. Stop any time; rerun to continue.
    rows = g.query("MATCH (n) WHERE labels(n)[0] IN $l OPTIONAL MATCH (n)-[r]-() "
                   "RETURN n.name, n.core, labels(n)[0], count(r) ORDER BY coalesce(n.core, false) DESC, "
                   "labels(n)[0] = 'Character' DESC, count(r) DESC", {"l": LABELS}).result_set
    names = list(dict.fromkeys(r[0] for r in rows if r[0] and "|" not in r[0] and "(other version)" not in r[0]))
    names = names[:int(os.getenv("LIMIT", "160"))]
    OUT.mkdir(parents=True, exist_ok=True)
    out_csv = Path(__file__).parent / "data" / "wiki_images.csv"
    old = list(csv.DictReader(open(out_csv, encoding="utf-8"))) if out_csv.exists() else []
    for n, title in OVERRIDES.items():  # fetch these again, one time
        if not any(r["name"] == n and r["wiki"] == title for r in old):
            old = [r for r in old if r["name"] != n]
            (OUT / filename(n)).unlink(missing_ok=True)
    done = {r["name"] for r in old}
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["name", "wiki", "file"])
        w.writerows([r["name"], r["wiki"], r["file"]] for r in old)
        f.flush()
        jobs = []
        for n, title in OVERRIDES.items():
            if n in done:
                continue
            for p in api(titles=title, prop="imageinfo", iiprop="url", iiurlwidth=256)["pages"].values():
                if "imageinfo" in p:
                    jobs.append((n, title, p["imageinfo"][0]["thumburl"]))
        # A film with the same name as its hero ("Iron Man") needs the film page: rows named "Work:Iron Man"
        same = g.query("MATCH (c:Character) WITH collect(c.name) + collect(c.alias) AS heroes "
                       "MATCH (w:Work) WHERE w.name IN heroes RETURN w.name, w.kind").result_set
        for name, kind in same:
            if "Work:" + name in done:
                continue
            titles = [f"{name} ({s})" for s in (("TV series", "film") if kind == "series" else ("film", "TV series"))]
            pages = {p["title"]: p["thumbnail"]["source"] for p in
                     api(titles="|".join(titles), prop="pageimages", pithumbsize=256)["pages"].values() if "thumbnail" in p}
            for title in titles:
                if title in pages:
                    jobs.append(("Work:" + name, title, pages[title]))
                    break
        todo = [n for n in names if n not in done and n not in OVERRIDES]
        for i in range(0, len(todo), 50):
            batch = todo[i:i + 50]
            alias = {n: PAGES.get(n, n) for n in batch}
            d = api(titles="|".join(alias.values()), prop="pageimages", pithumbsize=256, redirects=1)
            for step in ("normalized", "redirects"):
                hop = {x["from"]: x["to"] for x in d.get(step, [])}
                alias = {n: hop.get(t, t) for n, t in alias.items()}
            pages = {p["title"]: p["thumbnail"]["source"] for p in d["pages"].values() if "thumbnail" in p}
            jobs += [(n, title, pages[title]) for n, title in alias.items() if title in pages]
        print(f"{len(jobs)} pictures to download", flush=True)
        # the image host stalls single downloads for up to 30 s, so run several at the same time
        with ThreadPoolExecutor(int(os.getenv("WORKERS", "8"))) as pool:
            for k, res in enumerate(pool.map(download, jobs), 1):
                if res:
                    w.writerow([res[0], res[1], filename(res[0])])
                    f.flush()
                if k % 20 == 0:
                    print(f"{k} of {len(jobs)}", flush=True)


if __name__ == "__main__":
    main()
