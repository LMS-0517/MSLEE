// KPP N11 pallet: an interactive isometric figure.
// node build.mjs            -> kpp-n11.html (dark)
// node build.mjs --light    -> kpp-n11-light.html
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const kitScript = () => readFileSync(join(HERE, "kit", "iso-kit.mjs"), "utf8").replace(/^export /gm, "");

// ---------------------------------------------------------------- the model
// 1 world unit = 5 mm. Published KPP figures for N11: HDPE, 1100 x 1100 x 150 mm, 19.5 kg.
const MM = 5;
const SPEC = { w: 1100, d: 1100, h: 150, kg: 19.5, material: "HDPE" };
const HALF = SPEC.w / MM / 2; // 110
const RUNNER_H = 4; //  20 mm
const BLOCK_TOP = 22; // runner + 90 mm block
const DECK_TOP = SPEC.h / MM; // 30
const GRID = [-95, 0, 95]; // block centres, 9 blocks
const BLOCK = 30; // 150 mm square blocks

const TINE = { b: 47.5, w: 20, z0: 8, z1: 15, a0: -48, a1: 112 }; // 800 mm forks, 475 mm centres
const TRAVEL = 162; // inserted (0) .. retracted (tips 20 mm outside the deck)
const GAP = DECK_TOP - 8 - TINE.z1; // tine top to deck underside: 7 units = 35 mm
const LIFT = 32; // carriage rise, so the pallet rises LIFT - GAP = 25 units = 125 mm
const EXPLODE = { block: 18, deck: 40 };

const SIDES = [
  { name: "오른쪽 앞면", mark: "①", map: ([a, b]) => [a, b], n: [1, 0] },
  { name: "왼쪽 앞면", mark: "②", map: ([a, b]) => [-b, a], n: [0, 1] },
  { name: "왼쪽 뒷면", mark: "③", map: ([a, b]) => [-a, -b], n: [-1, 0] },
  { name: "오른쪽 뒷면", mark: "④", map: ([a, b]) => [b, -a], n: [0, -1] },
];

const WIDTH = 600;
const HEIGHT = 380;
const AZIMUTH = 40;

// ---------------------------------------------------------------- camera
const fitPoints = [];
for (const side of SIDES) {
  for (const b of [-92, 92]) {
    fitPoints.push([...side.map([326, b]), -4]);
    fitPoints.push([...side.map([134 + TRAVEL, b]), 120]);
  }
}
for (const x of [-HALF, HALF]) for (const y of [-HALF, HALF]) fitPoints.push([x, y, DECK_TOP + EXPLODE.deck]);
const P = k.fitProjection(fitPoints, WIDTH, HEIGHT, { pad: 12, azimuth: AZIMUTH });
const VIEW = k.towardViewer(P);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const closed = (points) => k.pathOf(points.map(at), true);
const facing = (normal) => normal[0] * VIEW[0] + normal[1] * VIEW[1] > 1e-6;

// ---------------------------------------------------------------- items
// Every drawn part is an item with a world box. Items are ordered by separating axes,
// checked in every pose the figure can reach, so one order holds for the whole motion.
const items = [];
const put = (item) => (items.push(item), item);

function rectOf(side, a0, a1, b0, b1) {
  const pts = [side.map([a0, b0]), side.map([a1, b1])];
  const x0 = Math.min(pts[0][0], pts[1][0]);
  const y0 = Math.min(pts[0][1], pts[1][1]);
  return { x: x0, y: y0, w: Math.abs(pts[1][0] - pts[0][0]), d: Math.abs(pts[1][1] - pts[0][1]) };
}
const boxOf = (plan, z0, z1) => [plan.x, plan.x + plan.w, plan.y, plan.y + plan.d, z0, z1];

// --- pallet (shared by every side)
const PAL = { x: -HALF, y: -HALF, w: HALF * 2, d: HALF * 2, r: 6 };

function runners() {
  for (const c of GRID) {
    const plan = { x: -HALF, y: c - BLOCK / 2, w: HALF * 2, d: BLOCK, r: 2 };
    const inner = facing([0, 1]) && c === GRID[2] ? L(k.lineOnTop([-HALF + 2, c + 15], [HALF - 2, c + 15], 0, P), { tone: "faint" }) : "";
    put({ id: `runner${c}`, role: "runner", box: boxOf(plan, 0, RUNNER_H), svg: S(k.slabOf(plan, 0, RUNNER_H, P, 3, 0.5), { tone: "hi", crease: "lo", inner }) });
  }
}

function blockFaces(x0, x1, y0, y1) {
  const out = [];
  const z0 = RUNNER_H + 3;
  const z1 = BLOCK_TOP - 3;
  if (facing([1, 0])) {
    out.push(closed([[x1, y0 + 5, z0], [x1, y1 - 5, z0], [x1, y1 - 5, z1], [x1, y0 + 5, z1]]));
    out.push(k.segment([x1, (y0 + y1) / 2, z0], [x1, (y0 + y1) / 2, z1], P));
  }
  if (facing([0, 1])) {
    out.push(closed([[x0 + 5, y1, z0], [x1 - 5, y1, z0], [x1 - 5, y1, z1], [x0 + 5, y1, z1]]));
    out.push(k.segment([(x0 + x1) / 2, y1, z0], [(x0 + x1) / 2, y1, z1], P));
  }
  return out.join("");
}

function blocks() {
  for (const bx of GRID) {
    for (const by of GRID) {
      const plan = { x: bx - BLOCK / 2, y: by - BLOCK / 2, w: BLOCK, d: BLOCK, r: 2 };
      const faces = L(blockFaces(plan.x, plan.x + BLOCK, plan.y, plan.y + BLOCK), { tone: "lo" });
      put({ id: `block${bx}_${by}`, role: "block", box: boxOf(plan, RUNNER_H, BLOCK_TOP), svg: S(k.slabOf(plan, RUNNER_H, BLOCK_TOP - RUNNER_H, P, 3, 0.5), { tone: "hi", crease: "lo", inner: faces }) });
    }
  }
}

function deck() {
  const h = DECK_TOP - BLOCK_TOP;
  const out = [S(k.slabOf(PAL, BLOCK_TOP, h, P, 8, 1.2), { tone: "hi", crease: "lo" })];
  // top: rim groove, a 10 x 10 grid of ribs that end on it, and a vent slot in every cell
  const panel = k.insetPlan(PAL, 7);
  out.push(L(k.planOutline(panel, DECK_TOP, P), { tone: "lo" }));
  const cell = panel.w / 10;
  const ribs = [];
  for (let i = 1; i < 10; i++) {
    const u = panel.x + cell * i;
    ribs.push(k.lineOnTop([u, panel.y], [u, panel.y + panel.d], DECK_TOP, P));
    ribs.push(k.lineOnTop([panel.x, u], [panel.x + panel.w, u], DECK_TOP, P));
  }
  out.push(L(ribs.join(""), { tone: "faint" }));
  const slots = [];
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 10; j++) {
      const cx = panel.x + cell * (i + 0.5);
      const cy = panel.y + cell * (j + 0.5);
      const long = (i + j) % 2 === 0;
      const plan = long ? { x: cx - 5, y: cy - 1.5, w: 10, d: 3, r: 1.5 } : { x: cx - 1.5, y: cy - 5, w: 3, d: 10, r: 1.5 };
      slots.push(k.planOutline(plan, DECK_TOP, P, 4));
    }
  }
  out.push(L(slots.join(""), { tone: "faint" }));
  // edge band: recessed panels over each fork opening, the label plate over the middle block
  const z0 = BLOCK_TOP + 1.6;
  const z1 = DECK_TOP - 1.6;
  const panels = [];
  const spans = [[-80, -15], [15, 80]];
  if (facing([1, 0])) {
    for (const [y0, y1] of spans) panels.push(closed([[HALF, y0 + 3, z0], [HALF, y1 - 3, z0], [HALF, y1 - 3, z1], [HALF, y0 + 3, z1]]));
    panels.push(closed([[HALF, -14, z0], [HALF, 14, z0], [HALF, 14, z1], [HALF, -14, z1]]));
  }
  if (facing([0, 1])) {
    for (const [x0, x1] of [...spans, [-14, 14]]) panels.push(closed([[x0 + (x1 - x0 > 30 ? 3 : 0), HALF, z0], [x1 - (x1 - x0 > 30 ? 3 : 0), HALF, z0], [x1 - (x1 - x0 > 30 ? 3 : 0), HALF, z1], [x0 + (x1 - x0 > 30 ? 3 : 0), HALF, z1]]));
  }
  out.push(L(panels.join(""), { tone: "lo" }));
  if (facing([1, 0])) out.push(k.faceTextSvg(k.sideMatrix([HALF, 0], BLOCK_TOP + 2.6, P, "right"), "KPP N11", { size: 3.6, tone: "mid", anchor: "middle" }));
  put({ id: "deck", role: "deck", box: boxOf(PAL, BLOCK_TOP, DECK_TOP), svg: out.join("") });
}

// --- the fork stand, one per side, built at the inserted pose (t = 0)
function fork(sideIndex) {
  const side = SIDES[sideIndex];
  const id = (name) => `s${sideIndex}.${name}`;
  const nW = side.n;
  const rel = (va) => side.map(va); // local direction -> world direction
  const world = ([a, b, z]) => [...side.map([a, b]), z];
  const slab = (name, role, a0, a1, b0, b1, z0, z1, style, extra = {}) => {
    const plan = { ...rectOf(side, a0, a1, b0, b1), r: extra.r ?? 1 };
    const paths = extra.cyl ? null : k.slabOf(plan, z0, z1 - z0, P, extra.steps ?? 3, extra.bevel ?? 0.4);
    return put({ id: id(name), role, side: sideIndex, box: boxOf(plan, z0, z1), svg: S(paths, style) + (extra.after ? extra.after(plan) : ""), ...extra.item });
  };

  // forks: tine, tapered tip, heel and the positioning pin
  for (const b0 of [TINE.b - TINE.w / 2, -TINE.b - TINE.w / 2]) {
    const b1 = b0 + TINE.w;
    const tag = b0 > 0 ? "R" : "L";
    slab(`tip${tag}`, "carriage", TINE.a0, TINE.a0 + 8, b0 + 1, b1 - 1, TINE.z0, TINE.z0 + 4, { tone: "hi", lit: true }, { bevel: 0.3 });
    slab(`tine${tag}`, "carriage", TINE.a0 + 8, TINE.a1, b0, b1, TINE.z0, TINE.z1, { tone: "hi", lit: true }, { bevel: 0.6 });
    const pin = side.map([115.5, (b0 + b1) / 2]);
    slab(`heel${tag}`, "carriage", TINE.a1, TINE.a1 + 7, b0, b1, TINE.z0, 64, { tone: "hi", lit: true }, {
      bevel: 0.4,
      after: () => S(k.cylinder(pin[0], pin[1], 2.6, 64, 3.4, P, 20), { tone: "mid" }) + L(k.knurl(pin[0], pin[1], 2.6, 64, 67.4, 16, P), { tone: "lo" }),
      item: { box: (() => { const p = rectOf(side, TINE.a1, TINE.a1 + 7, b0, b1); return boxOf(p, TINE.z0, 67.4); })() },
    });
  }
  // carriage: two hook bars with bolt heads
  for (const [z0, z1, name] of [[16, 24, "barLow"], [52, 60, "barHigh"]]) {
    slab(name, "carriage", 119, 124, -72, 72, z0, z1, { tone: "mid" }, {
      bevel: 0.4,
      after: () => D([-66, -20, 20, 66].map((b) => at(world([121.5, b, z1]))), { size: 0.45 }),
    });
  }
  // load backrest: five uprights, two rails split between them
  const posts = [-72, -38, -3, 32, 67];
  posts.forEach((b, index) => slab(`post${index}`, "carriage", 120, 123, b, b + 5, 60, 96, { tone: "mid" }, { bevel: 0.3 }));
  for (let index = 0; index < posts.length - 1; index++) {
    const b0 = posts[index] + 5;
    const b1 = posts[index + 1];
    slab(`railTop${index}`, "carriage", 120.5, 122.5, b0, b1, 91, 95, { tone: "mid" }, { bevel: 0.2 });
    slab(`railMid${index}`, "carriage", 120.5, 122.5, b0, b1, 74, 77, { tone: "mid" }, { bevel: 0.2 });
  }
  // mast: two channel uprights and a head beam
  for (const [b0, b1, name] of [[78, 88, "mastR"], [-88, -78, "mastL"]]) {
    slab(name, "mast", 124, 134, b0, b1, 10, 120, { tone: "mid" }, {
      bevel: 0.4,
      after: () => {
        const n = rel([-1, 0]);
        if (!facing(n)) return "";
        return L([b0 + 2.5, b1 - 2.5].map((b) => k.segment(world([124, b, 10]), world([124, b, 120]), P)).join(""), { tone: "faint" });
      },
    });
  }
  slab("head", "mast", 124, 134, -78, 78, 112, 120, { tone: "mid" }, { bevel: 0.4, after: () => D([-60, -30, 30, 60].map((b) => at(world([129, b, 120]))), { size: 0.45 }) });
  // lift chains from the head beam to the top hook bar (rebuilt live as the carriage rises)
  for (const b of [-30, 30]) {
    const plan = rectOf(side, 124, 125, b - 1.5, b + 1.5);
    put({ id: id(`chain${b}`), role: "chain", side: sideIndex, chain: { a: 124.5, b }, box: boxOf(plan, 60, 112), svg: chainSvg(world, 124.5, b, 0) });
  }
  // base, casters, counterweight with a grille, control box with a knurled knob
  slab("base", "mast", 126, 166, -92, 92, 2, 10, { tone: "mid" }, { steps: 6, bevel: 0.8, item: {}, after: () => "", r: 3 });
    for (const [a, b] of [[133, 84], [133, -84], [159, 84], [159, -84]]) {
    const [x, y] = side.map([a, b]);
    put({ id: id(`caster${a}_${b}`), role: "mast", side: sideIndex, box: [x - 5, x + 5, y - 5, y + 5, -3.6, 2], svg: S(k.cylinder(x, y, 5, -3.6, 5.6, P, 28), { tone: "lo" }) + L(k.sideArc(x, y, 5, -0.8, P, 20), { tone: "faint" }) });
  }
  const cwPlan = { ...rectOf(side, 138, 164, -62, 62), r: 2.5 };
  const grille = [];
  for (const z of [18, 25, 32]) {
    const out = rel([1, 0]);
    if (facing(out)) grille.push(closed([world([164, -46, z]), world([164, 46, z]), world([164, 46, z + 3]), world([164, -46, z + 3])]));
    for (const sgn of [1, -1]) {
      if (facing(rel([0, sgn]))) grille.push(closed([world([142, 62 * sgn, z]), world([160, 62 * sgn, z]), world([160, 62 * sgn, z + 3]), world([142, 62 * sgn, z + 3])]));
    }
  }
  const knob = side.map([151, 8]);
  const box = { ...rectOf(side, 143, 159, -18, 18), r: 1.5 };
  const cwSvg =
    S(k.slabOf(cwPlan, 10, 36, P, 4, 1), { tone: "mid", inner: L(grille.join(""), { tone: "lo" }) }) +
    S(k.slabOf(box, 46, 8, P, 3, 0.5), { tone: "mid" }) +
    L(k.planOutline(k.insetPlan(box, 2), 54, P, 3), { tone: "faint" }) +
    S(k.cylinder(knob[0], knob[1], 4, 54, 4, P, 28), { tone: "mid" }) +
    L(k.knurl(knob[0], knob[1], 4, 54, 58, 22, P), { tone: "lo" }) +
    L(k.lineOnTop(side.map([151, 5]), side.map([151, 11]), 58, P), { tone: "hi" }) +
    D([at(world([151, -10, 54]))], { size: 0.9, tone: "lo" });
  put({ id: id("weight"), role: "mast", side: sideIndex, box: [...boxOf(cwPlan, 10, 46).slice(0, 4), 10, 58], svg: cwSvg });

  return { halo: `<path class="iso-halo" d="${k.haloOf(rectOf(side, 128, 166, -90, 90), -4, 1, P)}" style="filter:blur(5px)"/>`, n: nW };
}

function chainSvg(world, a, b, lift) {
  const top = 112;
  const low = 60 + lift;
  const strands = [-1.1, 1.1].map((o) => k.segment(world([a, b + o, low]), world([a, b + o, top]), P)).join("");
  const pins = [];
  for (let z = low + 1.5; z < top - 0.5; z += 3) pins.push(at(world([a, b, z])));
  return L(strands, { tone: "lo" }) + D(pins, { size: 0.5, tone: "mid" });
}

runners();
blocks();
deck();
const forks = SIDES.map((_, index) => fork(index));

// ---------------------------------------------------------------- order
const poses = [];
for (const c of [0, 3, 7, 12, 20, 26, LIFT]) poses.push({ t: 0, c, e: 0 });
for (let t = 0; t <= TRAVEL; t += TRAVEL / 14) poses.push({ t, c: 0, e: 0 });
for (const e of [0, 0.25, 0.5, 0.75, 1]) poses.push({ t: TRAVEL, c: 0, e });
const raised = (c) => Math.max(0, c - GAP);
function offsetOf(item, pose) {
  const lift = raised(pose.c);
  if (item.role === "runner") return [0, 0, lift];
  if (item.role === "block") return [0, 0, lift + EXPLODE.block * pose.e];
  if (item.role === "deck") return [0, 0, lift + EXPLODE.deck * pose.e];
  const n = SIDES[item.side].n;
  const along = [n[0] * pose.t, n[1] * pose.t];
  return item.role === "carriage" ? [...along, pose.c] : [...along, 0];
}
function boxAt(item, pose) {
  const [dx, dy, dz] = offsetOf(item, pose);
  const [x0, x1, y0, y1, z0, z1] = item.box;
  const extra = item.role === "chain" ? pose.c : 0;
  return [x0 + dx, x1 + dx, y0 + dy, y1 + dy, z0 + dz + extra, z1 + dz];
}
const { sinA, cosA, sinE, cosE } = k.cameraOf(P);
function screenBox([x0, x1, y0, y1, z0, z1]) {
  const sx = [x0 * sinA - y1 * cosA, x1 * sinA - y0 * cosA];
  const sy = [(x0 * cosA + y0 * sinA) * sinE - z1 * cosE, (x1 * cosA + y1 * sinA) * sinE - z0 * cosE];
  return [sx, sy];
}
const EPS = 0.05;
// -1: a is drawn first, 1: b first, 0: no constraint. Throws if no axis separates them in every pose.
function relation(a, b) {
  // Two disjoint boxes separated along two axes in opposite senses can't share a camera ray,
  // so such a pose sets no constraint; the screen-box test alone is only conservative.
  const verdicts = new Set();
  for (const pose of poses) {
    const A = boxAt(a, pose);
    const B = boxAt(b, pose);
    const [ax, ay] = screenBox(A);
    const [bx, by] = screenBox(B);
    if (ax[1] <= bx[0] + EPS || bx[1] <= ax[0] + EPS || ay[1] <= by[0] + EPS || by[1] <= ay[0] + EPS) continue;
    const here = new Set();
    for (let axis = 0; axis < 3; axis++) {
      if (A[axis * 2 + 1] <= B[axis * 2] + EPS) here.add(-1);
      if (B[axis * 2 + 1] <= A[axis * 2] + EPS) here.add(1);
    }
    if (!here.size) throw new Error(`${a.id} and ${b.id} intersect at ${JSON.stringify(pose)}`);
    if (here.size === 1) verdicts.add([...here][0]);
  }
  if (verdicts.size > 1) throw new Error(`${a.id} / ${b.id} swap order during the motion`);
  return verdicts.size ? [...verdicts][0] : 0;
}
function orderOf(list) {
  const n = list.length;
  const after = list.map(() => []);
  const need = list.map(() => 0);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const r = relation(list[i], list[j]);
      if (r < 0) (after[i].push(j), need[j]++);
      if (r > 0) (after[j].push(i), need[i]++);
    }
  }
  const depth = (item) => {
    const [x0, x1, y0, y1, z0, z1] = item.box;
    return k.depthOf([(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], P);
  };
  const ready = list.map((_, i) => i).filter((i) => !need[i]);
  const out = [];
  while (ready.length) {
    ready.sort((p, q) => depth(list[p]) - depth(list[q]));
    const i = ready.shift();
    out.push(list[i].id);
    for (const j of after[i]) if (!--need[j]) ready.push(j);
  }
  if (out.length !== n) throw new Error("painter's order has a cycle");
  return out;
}
const pallet = items.filter((item) => item.side === undefined);
const palletOrder = orderOf(pallet);
const inside = SIDES.map((_, s) => orderOf([...pallet, ...items.filter((item) => item.side === s)]));
const forkOrder = SIDES.map((_, s) => orderOf(items.filter((item) => item.side === s)));
// retracted: is the whole stand in front of the pallet (drawn after it)?
const front = SIDES.map((side) => side.n[0] * VIEW[0] + side.n[1] * VIEW[1] > 0);

// ---------------------------------------------------------------- floor
function floor() {
  const out = [];
  const plate = { x: -122, y: -122, w: 244, d: 244, r: 6 };
  out.push(`<path class="iso-halo" d="${k.haloOf(plate, -4, 4, P)}"/>`);
  for (const side of SIDES) {
    for (const [b0, b1] of [[78, 90], [-90, -78]]) {
      const lane = { ...rectOf(side, 124, 326, b0, b1), r: 1.5 };
      out.push(S(k.slabOf(lane, -4, 0.4, P, 3), { tone: "lo", crease: "none" }));
      out.push(D([at([...side.map([128, (b0 + b1) / 2]), -3.6]), at([...side.map([322, (b0 + b1) / 2]), -3.6])], { size: 0.45 }));
    }
    const index = SIDES.indexOf(side);
    const tag = { ...rectOf(side, 176, 192, -12, 12), r: 1.5 };
    out.push(S(k.slabOf(tag, -4, 0.6, P, 3), { tone: "lo", crease: "none" }));
    const dots = [];
    for (let i = 0; i <= index; i++) dots.push(at([...side.map([184, (i - index / 2) * 4.4]), -3.4]));
    out.push(D(dots, { size: 0.9, tone: "hi" }));
  }
  out.push(S(k.slabOf(plate, -4, 4, P, 8, 0.8), { tone: "lo" }));
  out.push(L(k.planOutline(k.insetPlan(plate, 3), 0, P), { tone: "faint" }));
  // 1100 mm rulers along the two near edges, major tick every 100 mm
  const stripX = { x: 111.5, y: -HALF, w: 7, d: HALF * 2, r: 1 };
  const stripY = { x: -HALF, y: 111.5, w: HALF * 2, d: 7, r: 1 };
  for (const [strip, axis] of [[stripX, "y"], [stripY, "x"]]) {
    out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
    const ticks = k.topTicks(-HALF, HALF, 4, 5, 111.5, 0.6, [2, 3.6], P, axis);
    out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  }
  out.push(`<path class="iso-halo" d="${k.haloOf(k.insetPlan(PAL, 4), 0, 1, P)}" style="filter:blur(4px)"/>`);
  return out.join("");
}

// ---------------------------------------------------------------- svg
const byId = Object.fromEntries(items.map((item) => [item.id, item]));
const node = (item) => `<g data-k="${item.id}" data-role="${item.role}">${item.svg}</g>`;
const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "KPP N11 플라스틱 파렛트(1100×1100×150 mm). 상판 아래 블록 9개가 3×3으로 서 있고, 블록 사이의 통로로 지게차 포크가 네 면 어디에서든 들어갑니다. 포크가 들어오면 상판 밑면에 닿은 뒤 파렛트를 들어 올립니다.",
  body: [
    `<g data-floor>${floor()}${forks.map((f, i) => `<g data-halo="${i}"${i ? ' opacity="0"' : ""}>${f.halo}</g>`).join("")}</g>`,
    `<g data-layer>${inside[0].map((id) => node(byId[id])).join("")}</g>`,
    `<g data-store style="display:none">${items.filter((item) => item.side > 0).map(node).join("")}</g>`,
  ],
});

// ---------------------------------------------------------------- live
const live = `
const P = ${JSON.stringify(P)};
const SIDES = ${JSON.stringify(SIDES.map(({ name, mark, n }) => ({ name, mark, n })))};
const TRAVEL = ${TRAVEL}, LIFT = ${LIFT}, GAP = ${GAP}, MM = ${MM}, TIP = ${TINE.a0}, HALF = ${HALF};
const EXPLODE = ${JSON.stringify(EXPLODE)};
const ORDER = ${JSON.stringify({ inside, palletOrder, forkOrder, front })};
const CHAINS = ${JSON.stringify(Object.fromEntries(items.filter((i) => i.role === "chain").map((i) => [i.id, i.chain])))};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const layer = svg.querySelector("[data-layer]");
const store = svg.querySelector("[data-store]");
const halos = [...svg.querySelectorAll("[data-halo]")];
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const nodes = {};
svg.querySelectorAll("[data-k]").forEach((el) => (nodes[el.dataset.k] = el));
const wrap = document.createElementNS("http://www.w3.org/2000/svg", "g");
const sideOf = (id) => (id[0] === "s" && id[2] === "." ? +id[1] : -1);
const mapOf = [([a, b]) => [a, b], ([a, b]) => [-b, a], ([a, b]) => [-a, -b], ([a, b]) => [b, -a]];
const chainPath = (s, a, b, lift) => {
  const w = ([p, q, z]) => [...mapOf[s]([p, q]), z];
  const low = 60 + lift, top = 112;
  const strands = [-1.1, 1.1].map((o) => segment(w([a, b + o, low]), w([a, b + o, top]), P)).join("");
  let pins = "";
  for (let z = low + 1.5; z < top - 0.5; z += 3) { const [x, y] = iso(w([a, b, z]), P); pins += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="0.5"/>'; }
  return [strands, pins];
};

// state: t travel (0 in, TRAVEL out), c carriage rise, f fork opacity, e explode share
const s = { side: 0, t: 0, c: 0, f: 1, e: 0 };
let want = { side: 0, explode: false };
let arranged = "";
function arrange() {
  const out = s.t >= TRAVEL - 0.5;
  const key = s.side + (out ? "out" : "in");
  if (key === arranged) return;
  arranged = key;
  if (out) {
    wrap.replaceChildren(...ORDER.forkOrder[s.side].map((id) => nodes[id]));
    const pallet = ORDER.palletOrder.map((id) => nodes[id]);
    layer.replaceChildren(...(ORDER.front[s.side] ? [...pallet, wrap] : [wrap, ...pallet]));
  } else {
    wrap.replaceChildren();
    layer.replaceChildren(...ORDER.inside[s.side].map((id) => nodes[id]));
  }
}
const moveTo = (el, v) => el.setAttribute("transform", translateAlong(P, v));
function draw() {
  arrange();
  const lift = Math.max(0, s.c - GAP);
  const n = SIDES[s.side].n;
  for (const el of layer.querySelectorAll("[data-k]")) {
    const role = el.dataset.role;
    if (role === "runner") moveTo(el, [0, 0, lift]);
    else if (role === "block") moveTo(el, [0, 0, lift + EXPLODE.block * s.e]);
    else if (role === "deck") moveTo(el, [0, 0, lift + EXPLODE.deck * s.e]);
    else if (role === "carriage") moveTo(el, [n[0] * s.t, n[1] * s.t, s.c]);
    else {
      moveTo(el, [n[0] * s.t, n[1] * s.t, 0]);
      if (role === "chain") {
        const { a, b } = CHAINS[el.dataset.k];
        const [strands, pins] = chainPath(s.side, a, b, s.c);
        el.querySelector("path").setAttribute("d", strands);
        el.querySelector(".iso-dots").innerHTML = pins;
      }
    }
  }
  wrap.setAttribute("opacity", s.f.toFixed(3));
  halos.forEach((h, i) => {
    h.setAttribute("opacity", i === s.side ? s.f.toFixed(3) : "0");
    if (i === s.side) h.setAttribute("transform", translateAlong(P, [n[0] * s.t, n[1] * s.t, 0]));
  });
  const side = SIDES[s.side];
  let text;
  if (s.e > 0.01) text = s.e > 0.98 ? "분해 · 상판 1 · 블록 9 · 런너 3" : (want.explode ? "분해 중" : "조립 중");
  else {
    const inMm = Math.round(Math.max(0, Math.min(HALF - TIP, HALF - (TIP + s.t))) * MM / 10) * 10;
    const upMm = Math.round(lift * MM);
    text = side.mark + " " + side.name + " · 삽입 " + inMm + " mm · 들림 " + upMm + " mm";
  }
  if (readout.textContent !== text) readout.textContent = text;
}
// exponential approach with a floor on speed, so a long travel has no slow tail
const ease = (v, to, dt, tau, least) => {
  const gap = to - v;
  const move = Math.max(Math.abs(gap) * (1 - Math.exp(-dt / tau)), least * dt);
  return Math.abs(gap) <= move ? to : v + Math.sign(gap) * move;
};
function step(dt) {
  const calm = still.matches;
  if (calm) {
    // reduced motion: jump straight to the end pose of the wanted state
    s.side = want.side; s.f = 1;
    if (want.explode) { s.c = 0; s.t = TRAVEL; s.e = 1; } else { s.e = 0; s.t = 0; s.c = LIFT; }
    return;
  }
  const leave = want.side !== s.side || want.explode;
  if (leave) {
    s.c = ease(s.c, 0, dt, 0.25, 18);
    if (s.c === 0) s.t = ease(s.t, TRAVEL, dt, 0.35, 70);
    if (!want.explode) s.e = ease(s.e, 0, dt, 0.3, 0.6);
    if (s.t >= TRAVEL - 0.5) {
      s.t = TRAVEL;
      if (want.side !== s.side) {
        s.f = ease(s.f, 0, dt, 0.12, 2.5);
        if (s.f === 0) { s.side = want.side; arranged = ""; }
      } else {
        s.f = ease(s.f, 1, dt, 0.12, 2.5);
        s.e = ease(s.e, 1, dt, 0.35, 0.6);
      }
    }
  } else {
    s.f = ease(s.f, 1, dt, 0.12, 2.5);
    s.e = ease(s.e, 0, dt, 0.3, 0.6);
    if (s.e === 0 && s.f === 1) s.t = ease(s.t, 0, dt, 0.4, 70);
    if (s.t === 0) s.c = ease(s.c, LIFT, dt, 0.35, 18);
  }
}
const settled = () => {
  if (want.explode) return s.side === want.side && s.e === 1 && s.t === TRAVEL;
  return s.side === want.side && s.e === 0 && s.t === 0 && s.c === LIFT && s.f === 1;
};
const TOUR = [{ side: 0, explode: false }, { side: 1, explode: false }, { side: 2, explode: false }, { side: 3, explode: false }, { side: 3, explode: true }];
let tourIndex = 0, tourClock = 0, touring = !still.matches, visible = false, frame = 0, last = 0, idle = 0;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  if (touring && settled()) {
    tourClock += dt;
    if (tourClock > (want.explode ? 2.6 : 1.8)) { tourClock = 0; tourIndex = (tourIndex + 1) % TOUR.length; want = { ...TOUR[tourIndex] }; }
  }
  step(dt);
  draw();
  frame = visible && (touring || !settled()) ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const describe = () => {
  stage.setAttribute("aria-valuenow", String(want.side + 1));
  stage.setAttribute("aria-valuetext", want.explode ? "분해해서 보기" : SIDES[want.side].mark + " " + SIDES[want.side].name + "에서 포크 진입");
};
const steer = (next) => {
  touring = false;
  clearTimeout(idle);
  idle = setTimeout(() => { touring = !still.matches; tourClock = 0; run(); }, 3600);
  if (next.side !== want.side || next.explode !== want.explode) { want = next; describe(); }
  run();
};
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
// pointer: the side of the pallet under the pointer is the side the fork comes in from
const centre = iso([0, 0, 0], P);
const { sinA, cosA, sinE, k: K } = cameraOf(P);
const sideAt = (event) => {
  const m = svg.getScreenCTM();
  if (!m) return want.side;
  const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(m.inverse());
  const u = (p.x - centre[0]) / K, w = (p.y - centre[1]) / (K * sinE);
  const x = sinA * u + cosA * w, y = -cosA * u + sinA * w;
  return Math.abs(x) > Math.abs(y) ? (x > 0 ? 0 : 2) : (y > 0 ? 1 : 3);
};
stage.addEventListener("pointermove", (event) => { if (event.pointerType === "mouse") steer({ side: sideAt(event), explode: want.explode && sideAt(event) === want.side }); });
stage.addEventListener("click", (event) => { const side = sideAt(event); steer({ side, explode: side === want.side ? !want.explode : false }); });
stage.addEventListener("keydown", (event) => {
  let next = null;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") next = { side: (want.side + 1) % 4, explode: false };
  if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = { side: (want.side + 3) % 4, explode: false };
  if (event.key === "Home") next = { side: 0, explode: false };
  if (event.key === "End") next = { side: 3, explode: false };
  if (event.key === "Enter" || event.key === " ") next = { side: want.side, explode: !want.explode };
  if (event.key === "Escape") next = { side: want.side, explode: false };
  if (!next) return;
  event.preventDefault();
  steer(next);
});
if (still.matches) { s.c = LIFT; }
describe();
draw();
`;

const body = k.plateHtml({
  fig: "Fig 1",
  title: "KPP N11 파렛트",
  hint: "면을 가리키면 그쪽에서 포크 진입 · 클릭하면 분해",
  readout: `${SIDES[0].mark} ${SIDES[0].name} · 삽입 790 mm · 들림 0 mm`,
  keys: [
    { mark: "lit", label: "지게차 포크: 네 면 어디서든 진입(4방향 차입)" },
    { mark: "raised", label: "상판 1100×1100 mm · 블록 9개 · 하부 런너 3줄" },
    { mark: "flat", label: "바닥 눈금: 큰 눈금 100 mm, 한 변 1100 mm" },
  ],
  caption:
    "KPP N11형 플라스틱 파렛트. KPP 제품 소개 기준 재질 HDPE, 규격 1100×1100×150 mm, 중량 19.5 kg, 주 용도는 의약품·식품·유통점입니다. 블록 사이 통로로 포크가 네 면 어디에서든 들어가고, 상판 밑면에 닿은 뒤 파렛트를 들어 올립니다. 블록·런너 배치와 통로 치수(그림에서 폭 약 325 mm, 높이 90 mm)는 4방향 차입식 파렛트의 대표 구조로 그린 것이며, 실제 금형 세부와 하중 등급은 KPP 사양서로 확인하세요.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="KPP N11 파렛트: 좌우 화살표로 포크가 들어오는 면을 바꾸고, Enter로 분해해서 봅니다" aria-valuemin="1" aria-valuemax="4" aria-valuenow="1" style="touch-action:pan-y;cursor:pointer">${svg}</div><style>.iso-stage:focus:not(:focus-visible){outline:none}@media (max-width:560px){.iso-plate{overflow:hidden}.iso-stage svg{width:122%;margin:0 -11%}}</style>`,
});

const file = theme === "light" ? "kpp-n11-light.html" : "kpp-n11.html";
writeFileSync(join(HERE, file), k.pageHtml({ title: "KPP N11 파렛트", theme, body, script: kitScript() + live }));
console.log("wrote", file, `· ${items.length} items · ${Math.round(svg.length / 1024)} KB svg`);
