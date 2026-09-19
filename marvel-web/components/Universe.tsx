"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ForceGraphMethods } from "react-force-graph-2d";
import { forceCollide, forceX, forceY } from "d3-force";
import { MISSIONS } from "@/lib/missions";

const FG = dynamic(() => import("./FG"), { ssr: false });

type GNode = { shown?: string;
  id: number; label: string; name: string; alias?: string; image?: string; core?: boolean;
  kind?: string; year?: number; playedBy?: string; wiki?: string; x?: number; y?: number;
};
type GLink = { source: number; target: number; type: string };
type Wrong = { label: string; why: string; words: string[] };
type Msg = { who: "me" | "bot" | "oops" | "alone"; text: string; cypher?: string; same?: boolean; missing?: string[]; wrong?: Wrong[]; id?: number; pending?: boolean; revealed?: boolean };

const STYLE: Record<string, { color: string; icon: string; plural: string }> = {
  Character: { color: "#e23636", icon: "🦸", plural: "Characters" },
  Actor: { color: "#ff9f1c", icon: "🎭", plural: "Actors" },
  Work: { color: "#1e6bff", icon: "🎬", plural: "Films & series" },
  Team: { color: "#7b2ff7", icon: "🛡️", plural: "Teams" },
  Power: { color: "#ffd60a", icon: "⚡", plural: "Powers" },
  Item: { color: "#00c2a8", icon: "💎", plural: "Items" },
  Species: { color: "#8ac926", icon: "🧬", plural: "Species" },
  Location: { color: "#6c757d", icon: "📍", plural: "Places" },
  Event: { color: "#ff5d8f", icon: "💥", plural: "Events" },
  Organization: { color: "#495057", icon: "🏢", plural: "Organizations" },
  Thing: { color: "#adb5bd", icon: "❔", plural: "Other" },
};
const REL_TEXT: Record<string, string> = {
  MEMBER_OF: "Team", HAS_POWER: "Powers", IS_A: "Species", FROM: "Home", WIELDED: "Wielded", APPEARS_IN: "Appears in",
  PLAYS: "Played by / plays", ENEMY_OF: "Enemies", MENTORED: "Mentor & student", PARENT_OF: "Parent & child",
  SPOUSE_OF: "Married to", SIBLING_OF: "Siblings", PARTNER_OF: "Partner", CONTAINED_IN: "Inside / holds", LOCATED_AT: "Location",
};
// Info card: the most useful groups first
const REL_ORDER = ["MEMBER_OF", "WIELDED", "ENEMY_OF", "MENTORED", "HAS_POWER", "IS_A", "FROM", "PLAYS"];
// The "story" links are shown by default: who is on which team, who fights whom, who held what.
// Powers, places and films are extra layers, because they link almost everyone and hide the picture.
const STORY = new Set(["MEMBER_OF", "WIELDED", "CONTAINED_IN", "ENEMY_OF", "MENTORED", "PARENT_OF", "SPOUSE_OF", "SIBLING_OF", "PARTNER_OF"]);
const TRAITS_LABELS = new Set(["Power", "Species", "Location"]);
const SPOTS = [["avengers", "⭐ Avengers"], ["guardians", "🚀 Guardians"], ["stones", "💎 Infinity Stones"], ["villains", "😈 Villains"]] as const;
const ADD = [["powers", "⚡ Powers"], ["places", "🌍 Places"], ["films", "🎬 Films"], ["everything", "🌌 Everything"]] as const;
const NAME_RANK = ["Character", "Team", "Item", "Power", "Species", "Location", "Event", "Organization", "Actor", "Work", "Thing"];

const images = new Map<string, HTMLImageElement | "loading" | "failed">();
function getImage(url: string) {
  const hit = images.get(url);
  if (hit) return typeof hit === "string" ? null : hit;
  images.set(url, "loading");
  const img = new Image();
  img.onload = () => images.set(url, img);
  img.onerror = () => images.set(url, "failed");
  img.src = url;
  return null;
}
/** The answer of "AI alone", with the wrong names marked in red. */
function Marked({ text, wrong }: { text: string; wrong: Wrong[] }) {
  const words = wrong.flatMap((w) => w.words);
  if (!words.length) return <>{text}</>;
  const parts = text.split(new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi"));
  return <>{parts.map((s, i) => (i % 2 ? <mark key={i} className="wrong">{s}</mark> : s))}</>;
}
const display = (n: GNode) => n.shown ?? (n.alias && n.alias !== n.name ? n.alias : n.name);
// Two heroes can share one hero name (Clint Barton and Kate Bishop are both "Hawkeye").
// The one with the most links keeps it on the map; the others show their real name.
function nameSharedAliases(d: { nodes: GNode[]; links: { source: number; target: number }[] }) {
  const degree = new Map<number, number>();
  for (const l of d.links) for (const id of [l.source, l.target]) degree.set(id, (degree.get(id) ?? 0) + 1);
  const owner = new Map<string, GNode>();
  const heroes = d.nodes.filter((n) => n.label === "Character" && n.alias && n.alias !== n.name);
  for (const n of heroes) { const o = owner.get(n.alias!); if (!o || (degree.get(n.id) ?? 0) > (degree.get(o.id) ?? 0)) owner.set(n.alias!, n); }
  for (const n of heroes) if (owner.get(n.alias!) !== n) n.shown = n.name;
}
const creditUrl = (image: string) => image.replace("Special:FilePath/", "File:").replace(/\?width=\d+$/, "");

// Backup for a demo with no internet: real answers, recorded before the demo by scripts/record-backup.mjs
const LIVE_WAIT = 8000; // milliseconds to wait for a live answer before the recorded one is used
type Recorded = { recordedAt: string; missions: Record<string, { graph: object; alone: object }> };
let recordedFile: Promise<Recorded | null> | null = null;
const recordedAnswers = () => (recordedFile ??= fetch("/backup/answers.json").then((r) => (r.ok ? r.json() : null)).catch(() => null));
const forcedBackup = () => new URLSearchParams(window.location.search).has("backup");

export default function Universe() {
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [data, setData] = useState<{ nodes: GNode[]; links: GLink[] } | null>(null);
  const [error, setError] = useState("");
  const [layers, setLayers] = useState({ powers: false, places: false, films: false, everything: false });
  const [spot, setSpot] = useState<string | null>(null); // the spotlight that is on
  const [selected, setSelected] = useState<number | null>(null);
  const [answerIds, setAnswerIds] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([{ who: "bot", text: "Press the yellow button to start." }]);
  const [compare, setCompare] = useState(true); // also ask the same AI with no graph, to see the difference
  const [done, setDone] = useState<string[]>([]); // finished story steps
  const [team, setTeam] = useState<number[]>([]); // heroes found during the story
  const [reveal, setReveal] = useState<{ id: number; graph: Promise<{ error?: string; answer: string; cypher: string; names: string[] }>; body: { question?: string; missionId?: string } } | null>(null); // waiting for the second click
  const [skipped, setSkipped] = useState(false); // the visitor went directly to the free chat
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);
  // Clicks: the graph library drops a click when the mouse moves 1 pixel while the button is down.
  // So we track the press ourselves, allow a few pixels of hand shake, and find the node under the pointer.
  const press = useRef<{ x: number; y: number } | null>(null);
  const touched = useRef(false); // true once the visitor clicks or asks: stop auto-fitting the camera

  useEffect(() => {
    // No internet on stage? The page falls back to the recorded files in public/backup (see scripts/record-backup.mjs).
    const live = () => fetch("/api/graph", { signal: AbortSignal.timeout(LIVE_WAIT) }).then((r) => r.json()).then((d) => (d.error ? Promise.reject(d.error) : d));
    const saved = () => fetch("/backup/graph.json").then((r) => r.json());
    (forcedBackup() ? saved() : live().catch((e) => saved().catch(() => Promise.reject(e)))).then((d) => {
      nameSharedAliases(d);
      (d.nodes as GNode[]).forEach((n) => { if (n.core && n.image) getImage(n.image); }); // start loading the main faces at once
      setData(d);
    }).catch((e) => setError(String(e)));
    recordedAnswers(); // keep the recorded answers in memory, in case the internet goes away later
  }, []);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    measure();
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); // newer browsers return a Promise here
  }, [msgs, busy]);

  // First look: fit the whole universe in the panel as soon as the layout settles a little.
  useEffect(() => {
    if (!data) return;
    const timers = [900, 2500, 5000, 8000, 12000].map((ms) => setTimeout(() => { if (!touched.current) fgRef.current?.zoomToFit(500, size.w < 500 ? 16 : 70); }, ms));
    return () => timers.forEach(clearTimeout);
  }, [data, layers, size.w]);

  const byId = useMemo(() => new Map((data?.nodes ?? []).map((n) => [n.id, n])), [data]);

  // Which nodes and links are on screen for the chosen layers. Selected and answer nodes are always kept.
  const view = useMemo(() => {
    if (!data) return { nodes: [] as GNode[], links: [] as GLink[], neighbors: new Map<number, Set<number>>(), degree: new Map<number, number>() };
    const keep = new Set<number>(data.nodes.filter((n) => n.core).map((n) => n.id));
    const forced = new Set<number>(answerIds);
    if (selected !== null) forced.add(selected);
    let links: GLink[];
    if (layers.everything) { // the whole universe: every node and every link
      data.nodes.forEach((n) => keep.add(n.id));
      links = data.links;
    } else {
      const layerOf = (type: string) => STORY.has(type) || (layers.powers && type === "HAS_POWER") || (layers.places && (type === "FROM" || type === "LOCATED_AT"));
      // First view: only the main heroes, their teams and the famous items. Few nodes, so every face is big.
      // A clicked node also brings all of its own links.
      const wanted = data.links.filter((l) => layerOf(l.type));
      const coreIds = new Set(keep);
      const heroes = new Map<number, number>(); // team -> number of main heroes in it
      wanted.forEach((l) => { if (l.type === "MEMBER_OF" && coreIds.has(l.source)) heroes.set(l.target, (heroes.get(l.target) ?? 0) + 1); });
      const main = (id: number) => { const n = byId.get(id); return !!n && (n.core || (n.label === "Team" && (heroes.get(id) ?? 0) >= 2) || (n.label === "Item" && !!n.kind) || (layers.powers && n.label === "Power") || (layers.places && n.label === "Location")); };
      links = wanted.filter((l) =>
        (main(l.source) && main(l.target) && (coreIds.has(l.source) || coreIds.has(l.target))) ||
        l.source === selected || l.target === selected || (forced.has(l.source) && forced.has(l.target)));
      links.forEach((l) => { keep.add(l.source); keep.add(l.target); });
      forced.forEach((id) => keep.add(id));
      const extra = data.links.filter((l) => {
        if (layerOf(l.type)) return false;
        if (answerIds.has(l.source) && answerIds.has(l.target)) return true; // the answer path, whatever the link type
        const touchesForced = l.source === selected || l.target === selected; // only a clicked node brings its powers, home and actor
        if (l.type === "APPEARS_IN") return byId.get(l.source)?.label === "Character" && keep.has(l.source) && byId.get(l.target)?.kind === "film" && (layers.films || forced.has(l.target));
        if (l.type === "PLAYS") return keep.has(l.target) && touchesForced;
        return touchesForced; // a clicked hero also shows its powers, species and home
      });
      extra.forEach((l) => { keep.add(l.source); keep.add(l.target); });
      links = links.concat(extra);
    }
    const neighbors = new Map<number, Set<number>>();
    const degree = new Map<number, number>();
    for (const l of links) {
      if (!neighbors.has(l.source)) neighbors.set(l.source, new Set());
      if (!neighbors.has(l.target)) neighbors.set(l.target, new Set());
      neighbors.get(l.source)!.add(l.target);
      neighbors.get(l.target)!.add(l.source);
      degree.set(l.source, (degree.get(l.source) ?? 0) + 1);
      degree.set(l.target, (degree.get(l.target) ?? 0) + 1);
    }
    // New nodes start in a ring around the clicked node, so they fan out instead of piling up.
    const anchor = selected !== null ? byId.get(selected) : undefined;
    if (anchor?.x !== undefined && anchor.y !== undefined) {
      const fresh = data.nodes.filter((n) => keep.has(n.id) && n.x === undefined);
      fresh.forEach((n, i) => {
        const a = (2 * Math.PI * i) / fresh.length;
        n.x = anchor.x! + 130 * Math.cos(a);
        n.y = anchor.y! + 130 * Math.sin(a);
      });
    }
    // force-graph turns source/target into objects, so every view gets fresh link objects
    return { nodes: data.nodes.filter((n) => keep.has(n.id)), links: links.map((l) => ({ ...l })), neighbors, degree };
  }, [data, layers, selected, answerIds, byId]);

  // The lit-up set: the clicked node and its neighbors, or the nodes in the last answer.
  const lit = useMemo(() => {
    if (selected !== null) return new Set([selected, ...(view.neighbors.get(selected) ?? [])]);
    return answerIds.size ? answerIds : null;
  }, [selected, answerIds, view.neighbors]);

  const radius = useCallback((n: GNode) => (n.core ? 20 : n.label === "Team" ? 12 : n.image ? 9 : 5) + Math.min(7, Math.sqrt(view.degree.get(n.id) ?? 0)), [view.degree]);

  // The graph component loads a moment after this runs, so keep trying until it is there.
  useEffect(() => {
    if (!view.nodes.length) return;
    let timer: ReturnType<typeof setTimeout>;
    const apply = () => {
      const fg = fgRef.current;
      if (!fg) { timer = setTimeout(apply, 100); return; }
      fg.d3Force("charge")?.strength(-950);
      fg.d3Force("link")?.distance(115);
      fg.d3Force("collide", forceCollide((n) => radius(n as GNode) + 14)); // faces never overlap
      const tall = size.h > size.w * 1.15; // phone or narrow window: make the map tall, not wide
      fg.d3Force("x", forceX(0).strength(tall ? 0.12 : 0.09)); // pull loners toward the middle, so the first view stays tight
      fg.d3Force("y", forceY(0).strength(tall ? 0.08 : 0.12));
      fg.d3ReheatSimulation();
    };
    apply();
    return () => clearTimeout(timer);
  }, [view.nodes.length, radius, size.h > size.w * 1.15]);

  const focus = useCallback((ids: number[], ms = 700) => {
    setTimeout(() => {
      const set = new Set(ids);
      fgRef.current?.zoomToFit(ms, size.w < 500 ? 36 : 90, (n) => set.has((n as GNode).id)); // a phone has no room for a wide margin
    }, 350);
  }, [size.w]);

  const select = useCallback((n: GNode | null) => {
    touched.current = n !== null;
    setSpot(null);
    setAnswerIds(new Set());
    setSelected(n ? n.id : null);
    if (n) focus([n.id, ...(view.neighbors.get(n.id) ?? [])]);
    else setTimeout(() => fgRef.current?.zoomToFit(700, 50), 350); // back to the whole map
  }, [focus, view.neighbors]);

  // Spotlights: light up one part of the universe. The ids come from the links, so this is a graph query too.
  const spotlight = useCallback((key: string) => {
    if (!data) return;
    if (spot === key) { select(null); return; }
    const ids = new Set<number>();
    const teamOf = (name: string) => data.nodes.find((n) => n.label === "Team" && n.name === name)?.id;
    const members = (team?: number) => new Set(data.links.filter((l) => l.type === "MEMBER_OF" && l.target === team).map((l) => l.source));
    if (key === "avengers" || key === "guardians") {
      const team = teamOf(key === "avengers" ? "Avengers" : "Guardians of the Galaxy");
      if (team !== undefined) ids.add(team);
      members(team).forEach((id) => { if (byId.get(id)?.core) ids.add(id); });
    } else if (key === "stones") {
      data.nodes.forEach((n) => { if (n.kind === "Infinity Stone" || n.name === "Infinity Gauntlet") ids.add(n.id); });
      data.links.forEach((l) => { if (l.type === "CONTAINED_IN" && ids.has(l.source)) ids.add(l.target); }); // the Tesseract, the Orb, ...
      const items = new Set(ids);
      data.links.forEach((l) => { if (l.type === "WIELDED" && items.has(l.target)) ids.add(l.source); }); // and who held them
    } else {
      const avengers = members(teamOf("Avengers"));
      data.links.forEach((l) => {
        if (l.type !== "ENEMY_OF") return;
        for (const [hero, other] of [[l.source, l.target], [l.target, l.source]]) if (avengers.has(hero) && !avengers.has(other)) { ids.add(hero); ids.add(other); }
      });
    }
    touched.current = true;
    setSelected(null);
    setSpot(key);
    setAnswerIds(ids);
    focus([...ids], 900);
  }, [data, spot, byId, focus, select]);

  const paint = useCallback((node: object, ctx: CanvasRenderingContext2D, scale: number) => {
    const n = node as GNode;
    if (n.x === undefined || n.y === undefined) return;
    const r = radius(n);
    const on = !lit || lit.has(n.id);
    const px = r * scale; // size on screen
    ctx.globalAlpha = on ? 1 : 0.08;
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = STYLE[n.label]?.color ?? "#adb5bd";
    ctx.fill();
    const img = n.image && px > (n.core ? 3 : 9) ? getImage(n.image) : null;
    if (img) {
      const s = Math.min(img.width, img.height);
      ctx.save();
      ctx.clip();
      ctx.drawImage(img, (img.width - s) / 2, img.height > img.width ? (img.height - s) * 0.12 : 0, s, s, n.x - r, n.y - r, 2 * r, 2 * r);
      ctx.restore();
    } else if (px > 8) {
      ctx.font = `${r * 1.1}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(STYLE[n.label]?.icon ?? "", n.x, n.y + r * 0.08);
    }
    const strong = lit?.has(n.id) && (n.id === selected || answerIds.has(n.id));
    ctx.lineWidth = Math.max(strong ? 3 : 1.5, (strong ? 4 : 2) / scale) * (strong ? 1 : 0.8);
    ctx.strokeStyle = strong ? "#ffd60a" : "#111";
    if (strong) { ctx.stroke(); ctx.lineWidth /= 2.2; ctx.strokeStyle = "#111"; }
    ctx.stroke();
    // Names for the main nodes, but only when they are big enough on screen (on a phone the first view is too small for names).
    const hub = px > (n.core ? 7.5 : 6) && (n.core || (!layers.everything && (n.label === "Team" || n.label === "Item")));
    const trait = TRAITS_LABELS.has(n.label); // many small trait nodes: a name only when you zoom in, or they pile up
    const shared = ((layers.powers && n.label === "Power") || (layers.places && n.label === "Location")) && (view.degree.get(n.id) ?? 0) >= 3;
    if (on && (px > 13 || hub || shared || (lit && lit.has(n.id) && (!trait || px > 9 || answerIds.has(n.id))))) {
      const fs = Math.max(11 / scale, r * 0.55);
      ctx.font = `700 ${fs}px "Comic Neue", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.lineWidth = fs / 4;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#fff";
      ctx.strokeText(display(n), n.x, n.y + r + fs * 0.25);
      ctx.fillStyle = "#111";
      ctx.fillText(display(n), n.x, n.y + r + fs * 0.25);
    }
    ctx.globalAlpha = 1;
  }, [radius, lit, selected, answerIds, layers, view.degree]);

  const linkOn = useCallback((l: object) => {
    if (!lit) return null;
    const s = ((l as { source: GNode }).source as GNode).id, t = ((l as { target: GNode }).target as GNode).id;
    if (selected !== null) return s === selected || t === selected;
    return lit.has(s) && lit.has(t);
  }, [lit, selected]);

  type Ask = { question?: string; missionId?: string };
  type Answer = { error?: string; answer: string; cypher: string; names: string[] };
  // Story steps have a recorded answer. It is used when the live call fails or is too slow, or always with ?backup=1
  async function post(body: Ask, extra: { aloneOnly?: boolean } = {}) {
    const saved = async () => {
      const hit = body.missionId && (await recordedAnswers())?.missions[body.missionId]?.[extra.aloneOnly ? "alone" : "graph"];
      return hit || null;
    };
    if (forcedBackup()) {
      const hit = await saved();
      // wait about as long as the live model does, so the demo looks the same
      if (hit) return new Promise((done) => setTimeout(() => done(hit), extra.aloneOnly ? 1400 + Math.random() * 800 : 500));
    }
    try {
      const out = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, ...extra }),
        signal: body.missionId ? AbortSignal.timeout(LIVE_WAIT) : undefined,
      }).then((r) => r.json());
      return (out.error || (extra.aloneOnly && !out.alone)) ? (await saved()) ?? out : out;
    } catch (e) {
      const hit = await saved();
      if (hit) return hit;
      throw e;
    }
  }

  // Two clicks: first the answer with no graph, then "Now ask the graph" shows the answer with the graph.
  async function ask(body: Ask, shown: string) {
    if (busy || reveal) return;
    setBusy(true);
    const graph: Promise<Answer> = post(body); // starts now, so the second click is instant
    graph.catch(() => {});
    const id = Date.now();
    setMsgs((m) => [...m, { who: "me", text: shown }, ...(compare ? [{ who: "alone", text: "Thinking… 💭", id, pending: true } as Msg] : [])]);
    const out = compare ? await post(body, { aloneOnly: true }).catch(() => null) : null;
    if (out?.alone) {
      setMsgs((m) => m.map((x) => (x.id === id ? { who: "alone", text: out.alone.answer, same: out.alone.same, missing: out.alone.missing, wrong: out.alone.wrong, id } : x)));
      setReveal({ id, graph, body });
      setBusy(false);
      return;
    }
    setMsgs((m) => m.filter((x) => x.id !== id)); // no model to compare with: go directly to the graph
    await showGraph(graph, body);
    setBusy(false);
  }

  async function revealGraph() {
    if (!reveal || busy) return;
    setBusy(true);
    await showGraph(reveal.graph, reveal.body);
    setMsgs((m) => m.map((x) => (x.id === reveal.id ? { ...x, revealed: true } : x))); // now mark where "no graph" was wrong
    setReveal(null);
    setBusy(false);
  }

  async function showGraph(graph: Promise<Answer>, body: Ask) {
    try {
      const out = await graph;
      if (out.error) setMsgs((m) => [...m, { who: "oops", text: out.error! }]);
      else {
        setMsgs((m) => [...m, { who: "bot", text: out.answer, cypher: out.cypher }]);
        // A film can have the same name as its hero ("Thor"). Light up one node per name: the hero before the film.
        const wanted = new Set((out.names as string[]).map((s) => s.toLowerCase()));
        const best = new Map<string, GNode>();
        for (const n of data?.nodes ?? []) {
          for (const key of [n.name.toLowerCase(), n.label === "Character" ? n.alias?.toLowerCase() : undefined]) {
            if (!key || !wanted.has(key)) continue;
            const old = best.get(key);
            const rank = (x: GNode) => NAME_RANK.indexOf(x.label) * 2 + (x.core ? 0 : 1); // "Hawkeye" is Clint before Kate
            if (!old || rank(n) < rank(old)) best.set(key, n);
          }
        }
        const ids = [...best.values()].map((n) => n.id);
        if (body.missionId) {
          setDone((d) => (d.includes(body.missionId!) ? d : [...d, body.missionId!]));
          const heroes = ids.filter((id) => { const n = byId.get(id); return n?.label === "Character" && n.name !== "Thanos"; });
          setTeam((t) => [...new Set([...t, ...heroes])]);
        }
        touched.current = ids.length > 0;
        setSpot(null);
        setSelected(null);
        setAnswerIds(new Set(ids));
        if (ids.length) focus(ids, 900);
      }
    } catch (e) {
      setMsgs((m) => [...m, { who: "oops", text: String(e) }]);
    }
  }

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2 || !data) return [];
    return data.nodes.filter((n) => n.name.toLowerCase().includes(q) || n.alias?.toLowerCase().includes(q))
      .sort((a, b) => Number(!!b.core) - Number(!!a.core)).slice(0, 8);
  }, [query, data]);

  const next = skipped ? undefined : MISSIONS.find((m) => !done.includes(m.id));
  const saved = !next; // the chat box is open
  const won = done.length === MISSIONS.length;
  const sel = selected !== null ? byId.get(selected) : undefined;
  const groups = useMemo(() => {
    if (!sel || !data) return [];
    const g = new Map<string, GNode[]>();
    for (const l of data.links) {
      const other = l.source === sel.id ? l.target : l.target === sel.id ? l.source : null;
      if (other === null) continue;
      const n = byId.get(other);
      const have = g.get(l.type) ?? [];
      if (n && !have.some((x) => x.name === n.name)) g.set(l.type, [...have, n]);
    }
    const rank = (type: string) => { const i = REL_ORDER.indexOf(type); return i < 0 ? 99 : i; };
    return [...g.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
  }, [sel, data, byId]);

  return (
    <main className="min-h-dvh md:h-dvh flex flex-col gap-3 p-3 md:p-4">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="bangers text-3xl md:text-5xl title-burst">Marvel Universe Graph</h1>
        <p className="font-bold text-sm md:text-base">Thanos is coming. Use the graph to stop him.</p>
        <a className="font-bold text-sm md:text-base opacity-70 ml-auto hover:opacity-100" href="https://www.falkordb.com" target="_blank" rel="noreferrer">Powered by FalkorDB</a>
      </header>

      {/* phone: the page scrolls (graph, then chat). Desktop: one fixed screen, two columns. */}
      <div className="flex-1 min-h-0 grid gap-3 md:gap-4 md:grid-rows-1 md:grid-cols-[minmax(0,1fr)_400px]">
        {/* ---------- the graph */}
        <section className="panel panel-dots relative overflow-hidden h-[60dvh] md:h-auto" ref={boxRef}
          onPointerDown={(e) => { press.current = (e.target as HTMLElement).tagName === "CANVAS" ? { x: e.clientX, y: e.clientY } : null; }}
          onPointerUp={(e) => {
            const p = press.current;
            press.current = null;
            if (!p || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 6) return; // a drag or a pan, not a click
            const fg = fgRef.current, box = boxRef.current?.getBoundingClientRect();
            if (!fg || !box) return;
            const at = fg.screen2GraphCoords(e.clientX - box.left, e.clientY - box.top);
            const hit = [...view.nodes].reverse().find((n) => n.x !== undefined && Math.hypot(n.x - at.x, n.y! - at.y) <= radius(n) + 2); // the last node is drawn on top
            if (hit || selected !== null || answerIds.size) select(hit ?? null); // a click on empty paper with nothing lit changes nothing
          }}>
          {error && <p className="absolute inset-0 grid place-items-center p-6 text-center font-bold">💥 {error}</p>}
          {!data && !error && <p className="absolute inset-0 grid place-items-center bangers text-3xl">Assembling…</p>}
          {data && (
            <FG
              fgRef={fgRef}
              width={size.w}
              height={size.h}
              graphData={view}
              nodeId="id"
              nodeLabel={(n) => `${STYLE[(n as GNode).label]?.icon ?? ""} ${display(n as GNode)}`}
              nodeCanvasObject={paint}
              nodePointerAreaPaint={(n, color, ctx) => {
                const g = n as GNode;
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(g.x!, g.y!, radius(g) + 1.5, 0, 2 * Math.PI);
                ctx.fill();
              }}
              linkLabel={(l) => (l as GLink).type.replaceAll("_", " ")}
              linkColor={(l) => { const on = linkOn(l); return on === null ? "rgba(17,17,17,0.28)" : on ? "#e23636" : "rgba(17,17,17,0.04)"; }}
              linkWidth={(l) => (linkOn(l) ? 2.5 : 1)}
              linkDirectionalParticles={(l) => (linkOn(l) ? 3 : 0)}
              linkDirectionalParticleWidth={4}
              linkDirectionalParticleColor={() => "#ffd60a"}
              autoPauseRedraw={false}
              warmupTicks={220}
              cooldownTicks={60}
              onEngineStop={() => { if (!touched.current) fgRef.current?.zoomToFit(600, size.w < 500 ? 16 : 70); }}
            />
          )}

          <div className="absolute top-3 left-3 right-3 flex flex-nowrap md:flex-wrap items-start gap-2 pointer-events-none overflow-x-auto md:overflow-visible pb-2">
            <div className="relative w-40 md:w-56 shrink-0 pointer-events-auto">
              <input className="ink" placeholder="🔍 Find a hero…" value={query} onChange={(e) => setQuery(e.target.value)} />
              {matches.length > 0 && (
                <ul className="panel absolute mt-1 w-full z-10 overflow-hidden text-sm font-bold">
                  {matches.map((n) => (
                    <li key={n.id}>
                      <button className="w-full text-left px-3 py-1 hover:bg-yellow-300" onClick={() => { setQuery(""); select(n); }}>
                        {STYLE[n.label]?.icon} {display(n)} {n.alias && n.alias !== n.name && <span className="opacity-60">({n.name})</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <span className="bangers text-sm self-center shrink-0 hidden md:inline">Spotlight:</span>
            {SPOTS.map(([k, text]) => (
              <button key={k} className="btn text-sm pointer-events-auto shrink-0" aria-pressed={spot === k} onClick={() => spotlight(k)}>{text}</button>
            ))}
            {lit && <button className="btn text-sm pointer-events-auto shrink-0" onClick={() => select(null)}>↩ Reset</button>}
          </div>

          <div className="absolute bottom-2 right-3 flex items-center gap-2">
            <span className="bangers text-sm">Add:</span>
            {ADD.map(([k, text]) => (
              <button key={k} className="btn btn-small" aria-pressed={layers[k]} onClick={() => setLayers((s) => ({ ...s, [k]: !s[k] }))}>{text}</button>
            ))}
          </div>

          <ul className="absolute bottom-2 left-3 right-96 hidden md:flex flex-wrap gap-x-3 gap-y-0.5 text-xs font-bold pointer-events-none">
            {Object.entries(STYLE).filter(([k]) => view.nodes.some((n) => n.label === k)).map(([k, s]) => (
              <li key={k} className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full border-2 border-black" style={{ background: s.color }} /> {s.plural}
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- side: who is this + chat */}
        <aside className="min-h-0 flex flex-col gap-3 md:gap-4 h-[85dvh] md:h-auto">
          {sel && (
            <section className="panel p-3 max-h-[50%] overflow-y-auto shrink-0">
              <div className="flex gap-3 items-center">
                {sel.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sel.image} alt={display(sel)} className="w-20 h-20 rounded-full object-cover object-top border-4 border-black shrink-0" />
                ) : (
                  <div className="w-20 h-20 rounded-full border-4 border-black grid place-items-center text-4xl shrink-0" style={{ background: STYLE[sel.label]?.color }}>{STYLE[sel.label]?.icon}</div>
                )}
                <div className="min-w-0">
                  <h2 className="bangers text-3xl leading-none">{display(sel)}</h2>
                  <p className="font-bold text-sm">
                    {sel.alias && sel.alias !== sel.name ? `${sel.name} · ` : ""}{sel.label === "Work" ? `${sel.kind ?? "work"}${sel.year ? ` · ${sel.year}` : ""}` : STYLE[sel.label]?.plural}
                  </p>
                  {sel.playedBy && <p className="text-sm">Played by <b>{sel.playedBy}</b></p>}
                  {sel.image && (sel.wiki
                    ? <a className="text-xs underline opacity-70" href={`https://marvelcinematicuniverse.fandom.com/wiki/${encodeURIComponent(sel.wiki.replaceAll(" ", "_"))}`} target="_blank" rel="noreferrer">Image: MCU Wiki · © Marvel</a>
                    : <a className="text-xs underline opacity-70" href={creditUrl(sel.image)} target="_blank" rel="noreferrer">Photo: Wikimedia Commons</a>)}
                </div>
              </div>
              {groups.map(([type, list]) => (
                <div key={type} className="mt-2">
                  <h3 className="bangers text-lg leading-tight">{REL_TEXT[type] ?? type} <span className="opacity-50">{list.length}</span></h3>
                  <div className="flex flex-wrap gap-1">
                    {list.slice(0, 14).map((n, i) => <button key={`${n.id}-${i}`} className="chip" onClick={() => select(n)}>{STYLE[n.label]?.icon} {display(n)}</button>)}
                    {list.length > 14 && <span className="text-xs font-bold self-center">+{list.length - 14} more</span>}
                  </div>
                </div>
              ))}
              <button className="btn mt-3 text-sm" disabled={busy} onClick={() => ask({ question: `Tell me about ${display(sel)}: teams, powers and enemies.` }, `Tell me about ${display(sel)}.`)}>💬 Ask about {display(sel)}</button>
            </section>
          )}

          <section className="panel flex-1 min-h-0 flex flex-col p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h2 className="bangers text-2xl leading-none">{won ? "💥 Universe saved!" : "Mission control"}</h2>
              <div className="flex gap-1" aria-label="Mission steps">
                {MISSIONS.map((m, i) => (
                  <span key={m.id} className={`step-dot ${done.includes(m.id) ? "done" : ""}`} title={`${i + 1}. ${m.step}`}>{done.includes(m.id) ? "✓" : i + 1}</span>
                ))}
              </div>
            </div>
            <div className="shrink-0 mb-2">
              {reveal ? (
                <button className="btn w-full text-left !bg-green-300 leading-tight" disabled={busy} onClick={revealGraph}>
                  <span className="bangers text-lg">🕸️ Now ask the graph</span>
                </button>
              ) : next ? (
                <button className="btn w-full text-left !bg-yellow-300 leading-tight" disabled={busy} onClick={() => ask({ missionId: next.id }, next.question)}>
                  <span className="bangers text-lg">{next.emoji} Step {MISSIONS.indexOf(next) + 1} of {MISSIONS.length}: {next.step}</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold leading-tight flex-1">{won ? "5 graph questions. 0 guesses." : ""}</p>
                  <button className="btn text-sm shrink-0" disabled={busy} onClick={() => { setSkipped(false); if (won) { setDone([]); setTeam([]); } }}>{won ? "🔁 Play again" : "▶ Play the story"}</button>
                </div>
              )}
              {team.length > 0 && (
                <div className="flex items-center gap-1 mt-2 overflow-x-auto">
                  <span className="bangers text-sm shrink-0">Your team:</span>
                  {team.map((id) => { const n = byId.get(id); return n ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    n.image ? <img key={id} src={n.image} alt={display(n)} title={display(n)} onClick={() => select(n)} className="w-8 h-8 rounded-full object-cover object-top border-2 border-black shrink-0 cursor-pointer" />
                      : <span key={id} title={display(n)} className="w-8 h-8 rounded-full border-2 border-black grid place-items-center shrink-0 bg-red-500">🦸</span>
                  ) : null; })}
                </div>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 pr-1">
              {msgs.map((m, i) => (
                <div key={i} className={`bubble ${m.who}`}>
                  {m.who === "alone" && <b className="block text-xs">🧠 No graph {m.revealed && m.same && <span className="verdict ok">✓ same as the graph</span>}</b>}
                  {m.who === "bot" && i > 0 && msgs[i - 1].who === "alone" && <b className="block text-xs">🕸️ With graph</b>}
                  {m.who === "alone" ? <Marked text={m.text} wrong={m.revealed ? m.wrong ?? [] : []} /> : m.text}
                  {m.who === "alone" && m.revealed && m.same === false && (
                    <ul className="errors">
                      {(m.wrong ?? []).map((w) => <li key={w.label}>✗ <b>Wrong: {w.label}.</b> {w.why}</li>)}
                      {(m.missing ?? []).length > 0 && <li>✗ <b>Forgot: {(m.missing ?? []).join(", ")}.</b></li>}
                    </ul>
                  )}
                  {m.cypher && (
                    <details className="mt-1 text-xs font-normal">
                      <summary className="cursor-pointer opacity-70">Graph query</summary>
                      <code className="query">{m.cypher}</code>
                    </details>
                  )}
                </div>
              ))}
              {busy && !msgs.some((m) => m.pending) && <div className="bubble bot bangers">Thinking… 💭</div>}
              <div ref={chatEnd} />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs font-bold shrink-0">
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> 🧠 Compare with no graph
              </label>
              {!saved && <button className="underline opacity-60 hover:opacity-100" onClick={() => setSkipped(true)}>Skip the story</button>}
            </div>
            {/* one action at a time: the chat box comes after the story */}
            {saved && (
              <form className="flex gap-2 mt-1 shrink-0" onSubmit={(e) => { e.preventDefault(); const q = input.trim(); if (q) { setInput(""); ask({ question: q }, q); } }}>
                <input className="ink" placeholder="Ask your own question…" value={input} maxLength={200} onChange={(e) => setInput(e.target.value)} />
                <button className="btn !bg-red-600 !text-white text-lg" disabled={busy || !!reveal}>Ask!</button>
              </form>
            )}
          </section>
        </aside>
      </div>
      <footer className="text-[11px] font-bold opacity-70 leading-tight">
        Unofficial fan project. Not affiliated with Marvel or Disney. Data: Wikidata and curated facts. Images: © Marvel Studios via the MCU fan wiki, and Wikimedia Commons.
      </footer>
    </main>
  );
}
