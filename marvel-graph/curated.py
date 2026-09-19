"""Hand-curated MCU facts for the core characters.

Wikidata is thin on powers, teams and items, so this layer adds them.
Every edge loaded from here is tagged source='curated'.
Keys are the Wikidata English labels of the characters.
"""

# name: (alias, species, home, teams, powers)
HEROES = {
    "Tony Stark": ("Iron Man", "Human", "Earth", ["Avengers"], ["flight", "powered armor", "genius intellect", "energy blasts"]),
    "Steve Rogers": ("Captain America", "Human", "Earth", ["Avengers", "Howling Commandos"], ["superhuman strength", "superhuman durability", "healing factor", "expert combatant"]),
    "Thor": ("Thor", "Asgardian", "Asgard", ["Avengers", "Guardians of the Galaxy"], ["flight", "superhuman strength", "superhuman durability", "electrokinesis", "superhuman longevity"]),
    "Bruce Banner": ("Hulk", "Human", "Earth", ["Avengers"], ["superhuman strength", "superhuman durability", "healing factor", "genius intellect"]),
    "Natasha Romanoff": ("Black Widow", "Human", "Earth", ["Avengers", "S.H.I.E.L.D."], ["expert combatant", "espionage"]),
    "Clint Barton": ("Hawkeye", "Human", "Earth", ["Avengers", "S.H.I.E.L.D."], ["expert marksman", "expert combatant"]),
    "Nick Fury": ("Nick Fury", "Human", "Earth", ["S.H.I.E.L.D."], ["espionage", "expert combatant"]),
    "Peter Parker": ("Spider-Man", "Human", "Earth", ["Avengers"], ["superhuman strength", "superhuman agility", "wall-crawling", "danger sense"]),
    "Stephen Strange": ("Doctor Strange", "Human", "Earth", ["Avengers", "Masters of the Mystic Arts"], ["magic", "flight", "interdimensional travel", "time manipulation"]),
    "Wanda Maximoff": ("Scarlet Witch", "Human", "Sokovia", ["Avengers"], ["magic", "telekinesis", "telepathy", "flight", "reality warping"]),
    "Vision": ("Vision", "Synthezoid", "Earth", ["Avengers"], ["flight", "density control", "energy blasts", "superhuman strength"]),
    "Sam Wilson": ("Falcon", "Human", "Earth", ["Avengers"], ["flight", "expert combatant"]),
    "Bucky Barnes": ("Winter Soldier", "Human", "Earth", ["Howling Commandos", "Hydra"], ["superhuman strength", "expert combatant", "expert marksman"]),
    "James Rhodes": ("War Machine", "Human", "Earth", ["Avengers"], ["flight", "powered armor", "energy blasts"]),
    "T'Challa": ("Black Panther", "Human", "Wakanda", ["Avengers"], ["superhuman strength", "superhuman agility", "expert combatant"]),
    "Shuri": ("Shuri", "Human", "Wakanda", [], ["genius intellect"]),
    "Okoye": ("Okoye", "Human", "Wakanda", ["Dora Milaje"], ["expert combatant"]),
    "Scott Lang": ("Ant-Man", "Human", "Earth", ["Avengers"], ["size manipulation"]),
    "Hope van Dyne": ("Wasp", "Human", "Earth", [], ["size manipulation", "flight", "energy blasts"]),
    "Hank Pym": ("Ant-Man", "Human", "Earth", ["S.H.I.E.L.D."], ["genius intellect", "size manipulation"]),
    "Carol Danvers": ("Captain Marvel", "Human-Kree hybrid", "Earth", ["Avengers", "Starforce"], ["flight", "superhuman strength", "superhuman durability", "energy blasts", "energy absorption"]),
    "Peter Quill": ("Star-Lord", "Human-Celestial hybrid", "Earth", ["Guardians of the Galaxy", "Ravagers"], ["expert marksman", "expert pilot"]),
    "Gamora": ("Gamora", "Zehoberei", "Zen-Whoberi", ["Guardians of the Galaxy"], ["expert combatant", "superhuman strength"]),
    "Drax": ("Drax the Destroyer", "Kylosian", "Kylos", ["Guardians of the Galaxy"], ["superhuman strength", "superhuman durability"]),
    "Rocket": ("Rocket", "Halfworlder", "Halfworld", ["Guardians of the Galaxy", "Avengers"], ["expert marksman", "genius intellect", "expert pilot"]),
    "Groot": ("Groot", "Flora colossus", "Planet X", ["Guardians of the Galaxy"], ["superhuman strength", "healing factor", "plant manipulation"]),
    "Nebula": ("Nebula", "Luphomoid", "Luphom", ["Guardians of the Galaxy", "Avengers"], ["expert combatant", "cybernetic enhancement"]),
    "Mantis": ("Mantis", "Celestial-insectoid hybrid", None, ["Guardians of the Galaxy"], ["empathy"]),
    "Wong": ("Wong", "Human", "Earth", ["Masters of the Mystic Arts"], ["magic", "interdimensional travel"]),
    "The Ancient One": ("The Ancient One", "Human", "Earth", ["Masters of the Mystic Arts"], ["magic", "interdimensional travel", "superhuman longevity"]),
    "Valkyrie": ("Valkyrie", "Asgardian", "Asgard", ["Valkyrior"], ["superhuman strength", "superhuman durability", "expert combatant", "superhuman longevity"]),
    "Heimdall": ("Heimdall", "Asgardian", "Asgard", [], ["all-seeing vision", "superhuman strength", "superhuman longevity"]),
    "Odin": ("Odin", "Asgardian", "Asgard", [], ["magic", "superhuman strength", "superhuman longevity"]),
    "Loki": ("Loki", "Frost Giant", "Jotunheim", [], ["magic", "shapeshifting", "illusion casting", "superhuman longevity"]),
    "Hela": ("Hela", "Asgardian", "Asgard", [], ["superhuman strength", "superhuman durability", "weapon conjuring", "superhuman longevity"]),
    "Thanos": ("Thanos", "Titan", "Titan", ["Black Order"], ["superhuman strength", "superhuman durability", "genius intellect"]),
    "Ultron": ("Ultron", "Artificial intelligence", "Earth", [], ["flight", "energy blasts", "superhuman strength", "genius intellect"]),
    "Erik Killmonger": ("Killmonger", "Human", "Earth", [], ["expert combatant", "superhuman strength"]),
    "Johann Schmidt": ("Red Skull", "Human", "Earth", ["Hydra"], ["superhuman strength", "genius intellect"]),
    "Pietro Maximoff": ("Quicksilver", "Human", "Sokovia", ["Avengers"], ["superhuman speed"]),
    "Pepper Potts": ("Rescue", "Human", "Earth", [], ["powered armor", "flight"]),
    "Maria Hill": ("Maria Hill", "Human", "Earth", ["S.H.I.E.L.D."], ["espionage", "expert combatant"]),
    "Phil Coulson": ("Phil Coulson", "Human", "Earth", ["S.H.I.E.L.D."], ["espionage"]),
    "Peggy Carter": ("Peggy Carter", "Human", "Earth", ["S.H.I.E.L.D.", "Strategic Scientific Reserve"], ["espionage", "expert combatant"]),
    "Shang-Chi": ("Shang-Chi", "Human", "Earth", [], ["expert combatant"]),
    "Kate Bishop": ("Hawkeye", "Human", "Earth", [], ["expert marksman"]),
    "Yelena Belova": ("Black Widow", "Human", "Earth", [], ["expert combatant", "espionage"]),
    "Kamala Khan": ("Ms. Marvel", "Human", "Earth", [], ["hard-light constructs"]),
    "Monica Rambeau": ("Monica Rambeau", "Human", "Earth", ["S.W.O.R.D."], ["flight", "energy absorption", "intangibility"]),
    "Matt Murdock": ("Daredevil", "Human", "Earth", [], ["danger sense", "expert combatant"]),
    "Yondu Udonta": ("Yondu", "Centaurian", "Centauri-IV", ["Ravagers"], ["expert marksman", "expert pilot"]),
    "Korg": ("Korg", "Kronan", None, [], ["superhuman strength", "superhuman durability"]),
    "Dormammu": ("Dormammu", "Dark Dimension entity", "Dark Dimension", [], ["magic", "reality warping", "immortality"]),
    "Ego": ("Ego", "Celestial", None, [], ["reality warping", "immortality", "energy blasts"]),
}

# item: (kind, note)
ITEMS = {
    "Mjolnir": "weapon",
    "Stormbreaker": "weapon",
    "Captain America's Shield": "weapon",
    "Infinity Gauntlet": "artifact",
    "Eye of Agamotto": "artifact",
    "Tesseract": "artifact",
    "Scepter": "weapon",
    "Aether": "artifact",
    "Orb": "artifact",
    "Space Stone": "Infinity Stone",
    "Mind Stone": "Infinity Stone",
    "Reality Stone": "Infinity Stone",
    "Power Stone": "Infinity Stone",
    "Time Stone": "Infinity Stone",
    "Soul Stone": "Infinity Stone",
}

# (character, item) -> character has wielded the item on screen
WIELDED = [
    ("Thor", "Mjolnir"), ("Thor", "Stormbreaker"),
    ("Steve Rogers", "Mjolnir"), ("Steve Rogers", "Captain America's Shield"),
    ("Vision", "Mjolnir"), ("Hela", "Mjolnir"),
    ("Sam Wilson", "Captain America's Shield"), ("Bucky Barnes", "Captain America's Shield"),
    ("Thanos", "Infinity Gauntlet"), ("Bruce Banner", "Infinity Gauntlet"), ("Tony Stark", "Infinity Gauntlet"),
    ("Stephen Strange", "Eye of Agamotto"), ("Stephen Strange", "Time Stone"),
    ("Loki", "Tesseract"), ("Loki", "Scepter"), ("Johann Schmidt", "Tesseract"),
    ("Vision", "Mind Stone"), ("Peter Quill", "Power Stone"),
    ("Thanos", "Space Stone"), ("Thanos", "Mind Stone"), ("Thanos", "Reality Stone"),
    ("Thanos", "Power Stone"), ("Thanos", "Time Stone"), ("Thanos", "Soul Stone"),
    # Avengers: Endgame - Hulk brings everyone back and Tony makes the last snap: both use all six stones
    *[(hero, stone + " Stone") for hero in ("Bruce Banner", "Tony Stark")
      for stone in ("Space", "Mind", "Reality", "Power", "Time", "Soul")],
]

# (stone, container) -> stone was housed in this item
CONTAINED_IN = [
    ("Space Stone", "Tesseract"), ("Mind Stone", "Scepter"), ("Reality Stone", "Aether"),
    ("Power Stone", "Orb"), ("Time Stone", "Eye of Agamotto"),
]

# (stone, place) -> where the stone was kept before Thanos took it
LOCATED_AT = [
    ("Soul Stone", "Vormir"), ("Power Stone", "Xandar"), ("Reality Stone", "Knowhere"),
    ("Time Stone", "Earth"), ("Mind Stone", "Earth"), ("Space Stone", "Asgard"),
]

# (hero, villain)
ENEMIES = [
    ("Tony Stark", "Thanos"), ("Steve Rogers", "Johann Schmidt"), ("Thor", "Hela"), ("Thor", "Loki"),
    ("Thor", "Thanos"), ("T'Challa", "Erik Killmonger"), ("Stephen Strange", "Dormammu"),
    ("Peter Quill", "Ego"), ("Gamora", "Thanos"), ("Nebula", "Thanos"), ("Tony Stark", "Ultron"),
    ("Wanda Maximoff", "Ultron"), ("Vision", "Ultron"), ("Steve Rogers", "Thanos"), ("Carol Danvers", "Thanos"),
]

# (mentor, student)
MENTORED = [
    ("Tony Stark", "Peter Parker"), ("The Ancient One", "Stephen Strange"), ("Hank Pym", "Scott Lang"),
    ("Clint Barton", "Kate Bishop"), ("Nick Fury", "Carol Danvers"), ("Yondu Udonta", "Peter Quill"),
    ("Odin", "Thor"),
]

# Cast links that Wikidata is missing: character -> actor (actor rows are in data/extra_actors.csv)
EXTRA_CAST = {"Kate Bishop": "Hailee Steinfeld", "Kamala Khan": "Iman Vellani"}
