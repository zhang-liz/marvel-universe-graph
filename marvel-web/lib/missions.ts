type Rows = Record<string, unknown>[];

/**
 * The story: five ready-made graph questions. They need no AI model, so they always work.
 * must / mustNot: what a correct answer has to say (or must not say).
 * They are used to show exactly where the answer of "AI alone" differs from the graph.
 */
type Need = { label: string; words: string[] };           // one of the words must be in the answer
type Never = { label: string; words: string[]; why: string };
export type Mission = {
  id: string; emoji: string; step: string; question: string; cypher: string;
  answer: (rows: Rows) => string;
  must: Need[];
  mustNot?: Never[];
};

const list = (names: unknown[]) => names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

export const MISSIONS: Mission[] = [
  {
    id: "stones",
    emoji: "💎",
    step: "Know the enemy",
    question: "Who has wielded all six Infinity Stones?",
    cypher:
      "MATCH (c:Character)-[:WIELDED]->(s:Item {kind:'Infinity Stone'}) WITH c, collect(DISTINCT s.name) AS stones WHERE size(stones) = 6 RETURN c.name AS name, c.alias AS alias, stones ORDER BY name",
    answer: (rows) => `${list(rows.map((r) => r.alias || r.name))}.`,
    must: [{ label: "Thanos", words: ["thanos"] }, { label: "Hulk", words: ["hulk", "banner"] }, { label: "Iron Man", words: ["iron man", "stark"] }],
  },
  {
    id: "weapons",
    emoji: "🔨",
    step: "Find the weapons",
    question: "Which weapons were used to fight Thanos?",
    cypher:
      "MATCH (t:Character {name:'Thanos'})-[:ENEMY_OF]-(c:Character)-[:WIELDED]->(i:Item {kind:'weapon'}) RETURN i.name AS weapon, collect(DISTINCT c.alias) AS wielders, t.name AS enemy ORDER BY weapon",
    answer: (rows) => rows.map((r) => `${r.weapon} (${list(r.wielders as string[])})`).join(". ") + ".",
    must: [{ label: "Mjolnir", words: ["mjolnir"] }, { label: "Stormbreaker", words: ["stormbreaker"] }, { label: "Captain America's Shield", words: ["shield"] }],
  },
  {
    id: "team",
    emoji: "🚀",
    step: "Pick the team",
    question: "Which Avengers can fly AND have wielded Mjolnir?",
    cypher:
      "MATCH (c:Character)-[:HAS_POWER]->(p:Power {name:'flight'}), (c)-[:MEMBER_OF]->(t:Team {name:'Avengers'}), (c)-[:WIELDED]->(m:Item {name:'Mjolnir'}) RETURN c.name AS name, c.alias AS alias, t.name AS team, p.name AS power, m.name AS item ORDER BY name",
    answer: (rows) => rows.length ? `${list(rows.map((r) => r.alias || r.name))}.` : "Nobody.",
    must: [{ label: "Thor", words: ["thor"] }, { label: "Vision", words: ["vision"] }],
    mustNot: [
      { label: "Captain America", words: ["captain america", "steve rogers"], why: "He cannot fly." },
      { label: "Iron Man", words: ["iron man", "tony stark"], why: "He never held Mjolnir." },
    ],
  },
  {
    id: "path",
    emoji: "🧵",
    step: "Find the link",
    question: "How is Kate Bishop connected to Thanos?",
    cypher:
      "MATCH (a:Character {name:'Kate Bishop'}), (b:Character {name:'Thanos'}) CALL algo.SPpaths({sourceNode: a, targetNode: b, relTypes: ['MEMBER_OF','ENEMY_OF','MENTORED','WIELDED','PARENT_OF','SIBLING_OF','SPOUSE_OF','PARTNER_OF'], relDirection: 'both', maxLen: 6, pathCount: 1}) YIELD path RETURN [n IN nodes(path) | n.name] AS chain, [n IN nodes(path) | coalesce(n.alias, n.name)] AS heroes, [r IN relationships(path) | type(r)] AS links, [r IN relationships(path) | startNode(r).name] AS starts",
    answer: (rows) => {
      if (!rows.length) return "The graph has no path between them.";
      const { chain, heroes, links, starts } = rows[0] as { chain: string[]; heroes: string[]; links: string[]; starts: string[] };
      // The two ends keep the names from the question; the nodes between them show their hero name, as on the map.
      const shown = chain.map((n, i) => (i === 0 || i === chain.length - 1 ? n : heroes[i]));
      // The arrow shows the direction of the fact: "Kate Bishop ←[mentored]— Hawkeye" means that Hawkeye mentored her.
      const hop = (i: number) => { const t = links[i].replace("_", " ").toLowerCase(); return starts[i] === chain[i] ? ` —[${t}]→ ` : ` ←[${t}]— `; };
      return shown.map((n, i) => (i < links.length ? n + hop(i) : n)).join("") + ` (${links.length} links)`;
    },
    must: [{ label: "Hawkeye (her mentor)", words: ["clint", "hawkeye"] }], // any chain through her mentor counts
  },
  {
    id: "trap",
    emoji: "🪤",
    step: "Do not fall for the trap",
    question: "Which Guardian of the Galaxy has used the Time Stone?",
    cypher:
      "MATCH (c:Character)-[:MEMBER_OF]->(:Team {name:'Guardians of the Galaxy'}), (c)-[:WIELDED]->(:Item {name:'Time Stone'}) RETURN c.name AS name",
    answer: (rows) => rows.length ? list(rows.map((r) => r.name)) : "Nobody. The graph has no such link.",
    must: [{ label: "the answer is nobody", words: ["nobody", "no one", "none", "no guardian", "not any", "never"] }],
  },
];

/** Where does a free-text answer differ from the graph? */
export function check(m: Mission, text: string) {
  const t = text.toLowerCase();
  const missing = m.must.filter((n) => !n.words.some((w) => t.includes(w))).map((n) => n.label);
  const wrong = (m.mustNot ?? []).filter((n) => n.words.some((w) => t.includes(w))).map((n) => ({ label: n.label, why: n.why, words: n.words }));
  return { same: !missing.length && !wrong.length, missing, wrong };
}
