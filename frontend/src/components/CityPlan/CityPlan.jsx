import './CityPlan.css';

// A street plan drawn from the case's `city` data: a 7 x 5 grid of blocks with slightly crooked
// streets, water along one edge, parks, and walled sites. Everything random is seeded by the case id,
// so a case's town looks the same every time.
export const W = 1000;
export const H = 625;
const COLS = 7;
const ROWS = 5;
const SHORE = 90;

function rng(seedText) {
  let a = [...seedText].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 2654435761), 1779033703) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cross = (v, h) => {
  const [p, q] = v;
  const [r, s] = h;
  const d1 = [q[0] - p[0], q[1] - p[1]];
  const d2 = [s[0] - r[0], s[1] - r[1]];
  const den = d1[0] * d2[1] - d1[1] * d2[0];
  const t = ((r[0] - p[0]) * d2[1] - (r[1] - p[1]) * d2[0]) / den;
  return [p[0] + t * d1[0], p[1] + t * d1[1]];
};

const covers = (cells, c, r) => c >= cells[0] && c <= cells[2] && r >= cells[1] && r <= cells[3];

/** The town's geometry for one case. `at(gx, gy)` turns grid units (as in locations' `map`) into map points. */
export function buildPlan(caseId, city = {}, pins = []) {
  const rand = rng(`ridgeway-${caseId}`);
  const edge = city.water?.edge;
  const box = {
    x0: edge === 'west' ? SHORE : -30, x1: edge === 'east' ? W - SHORE : W + 30,
    y0: edge === 'north' ? SHORE : -30, y1: edge === 'south' ? H - SHORE : H + 30,
  };
  const jitter = (i, n) => (i === 0 || i === n ? 0 : (rand() - 0.5) * 26);
  const vLines = Array.from({ length: COLS + 1 }, (_, i) => {
    const x = box.x0 + ((box.x1 - box.x0) * i) / COLS;
    return [[x + jitter(i, COLS), -60], [x + jitter(i, COLS), H + 60]];
  });
  const hLines = Array.from({ length: ROWS + 1 }, (_, j) => {
    const y = box.y0 + ((box.y1 - box.y0) * j) / ROWS;
    return [[-60, y + jitter(j, ROWS)], [W + 60, y + jitter(j, ROWS)]];
  });
  const corner = (i, j) => cross(vLines[i], hLines[j]);

  const at = (gx, gy) => {
    const c = Math.min(COLS - 1, Math.max(0, Math.floor(gx)));
    const r = Math.min(ROWS - 1, Math.max(0, Math.floor(gy)));
    const u = gx - c;
    const v = gy - r;
    const [a, b, d, e] = [corner(c, r), corner(c + 1, r), corner(c, r + 1), corner(c + 1, r + 1)];
    return [
      a[0] * (1 - u) * (1 - v) + b[0] * u * (1 - v) + d[0] * (1 - u) * v + e[0] * u * v,
      a[1] * (1 - u) * (1 - v) + b[1] * u * (1 - v) + d[1] * (1 - u) * v + e[1] * u * v,
    ];
  };

  // A rectangle in grid units as a polygon that bends with the streets it crosses.
  const rect = (x0, y0, x1, y1) => {
    const steps = (a, b) => [a, ...Array.from({ length: Math.ceil(b) - Math.floor(a) + 1 }, (_, k) => Math.floor(a) + k).filter((n) => n > a && n < b), b];
    const xs = steps(x0, x1);
    const ys = steps(y0, y1);
    const pts = [...xs.map((x) => at(x, y0)), ...ys.slice(1).map((y) => at(x1, y)), ...xs.slice(0, -1).reverse().map((x) => at(x, y1)), ...ys.slice(1, -1).reverse().map((y) => at(x0, y))];
    return pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ');
  };

  const parks = city.parks ?? [];
  const sites = city.sites ?? [];
  const covered = (c, r) => parks.some((p) => covers(p.cells, c, r)) || sites.some((s) => covers(s.cells, c, r));

  const blocks = [];
  for (let c = 0; c < COLS; c += 1) {
    for (let r = 0; r < ROWS; r += 1) {
      if (covered(c, r)) continue;
      const nu = rand() < 0.5 ? 2 : 3;
      const nv = rand() < 0.7 ? 2 : 1;
      const cut = (n) => [0, ...Array.from({ length: n - 1 }, (_, k) => (k + 1) / n + (rand() - 0.5) * 0.12), 1];
      const us = cut(nu).map((u) => 0.08 + u * 0.84);
      const vs = cut(nv).map((v) => 0.09 + v * 0.82);
      for (let i = 0; i < nu; i += 1) {
        for (let k = 0; k < nv; k += 1) {
          if (rand() < 0.12) continue;
          blocks.push(rect(c + us[i] + 0.012, r + vs[k] + 0.015, c + us[i + 1] - 0.012, r + vs[k + 1] - 0.015));
        }
      }
    }
  }

  const trees = parks.flatMap((p) => {
    const [c0, r0, c1, r1] = p.cells;
    const n = (c1 - c0 + 1) * (r1 - r0 + 1) * 14;
    return Array.from({ length: n }, () => ({ p: at(c0 + 0.14 + rand() * (c1 - c0 + 0.72), r0 + 0.16 + rand() * (r1 - r0 + 0.68)), r: 4 + rand() * 5 }));
  });

  // Site names sit at the top of their site; street names keep clear of them as they do of markers.
  const marks = [...pins, ...sites.map((s) => [(s.cells[0] + s.cells[2] + 1) / 2, s.cells[1] + 0.2])];

  // The compass goes in whichever corner is emptiest.
  const corners = [[COLS - 1, 0, W - 44, 44], [0, 0, 44, 44], [COLS - 1, ROWS - 1, W - 44, H - 44], [0, ROWS - 1, 44, H - 44]];
  const crowd = ([c, r]) => (covered(c, r) ? 10 : 0) + marks.filter(([x, y]) => Math.abs(x - (c + 0.5)) < 1.2 && Math.abs(y - (r + 0.5)) < 1.2).length;
  const compass = corners.reduce((best, k) => (crowd(k) < crowd(best) ? k : best)).slice(2);

  const major = new Set(city.major ?? []);
  const roads = [
    ...vLines.map((l, i) => ({ l, name: city.streets?.v?.[i - 1] ?? null, axis: 'v', i })),
    ...hLines.map((l, j) => ({ l, name: city.streets?.h?.[j - 1] ?? null, axis: 'h', i: j })),
  ].map((r) => ({ ...r, major: r.name ? major.has(r.name) : false }));

  // Street names go on a stretch of road that is visible and not under a place's marker.
  const labels = roads.filter((r) => r.name && r.i > 0 && r.i < (r.axis === 'v' ? COLS : ROWS)).map((r) => {
    const n = r.axis === 'v' ? ROWS : COLS;
    const mid = (n - 1) / 2;
    const candidates = Array.from({ length: n }, (_, k) => k).filter((k) => {
      const [left, right] = r.axis === 'v' ? [[r.i - 1, k], [r.i, k]] : [[k, r.i - 1], [k, r.i]];
      if (covered(...left) && covered(...right)) return false;
      // A marker's name tag hangs about half a block below it and is most of a block wide.
      return !marks.some(([px, py]) => (r.axis === 'v'
        ? Math.abs(px - r.i) < 0.7 && py > k - 0.7 && py < k + 1.2
        : py > r.i - 0.8 && py < r.i + 0.3 && px > k - 0.5 && px < k + 1.5));
    }).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
    if (!candidates.length) return null;
    const k = candidates[0];
    const [a, b] = r.axis === 'v' ? [at(r.i, k), at(r.i, k + 1)] : [at(k, r.i), at(k + 1, r.i)];
    let angle = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
    if (angle > 45) angle -= 180;
    return { name: r.name, major: r.major, x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, angle };
  }).filter(Boolean);

  let water = null;
  if (edge) {
    const wave = (n) => Array.from({ length: n + 1 }, (_, k) => k / n);
    const bank = 14;
    const shore = wave(10).map((t) => {
      const wob = (rand() - 0.5) * 16;
      if (edge === 'south') return [t * (W + 40) - 20, box.y1 + bank + wob];
      if (edge === 'north') return [t * (W + 40) - 20, box.y0 - bank + wob];
      if (edge === 'east') return [box.x1 + bank + wob, t * (H + 40) - 20];
      return [box.x0 - bank + wob, t * (H + 40) - 20];
    });
    const far = { south: [[W + 40, H + 40], [-40, H + 40]], north: [[W + 40, -40], [-40, -40]], east: [[W + 40, H + 40], [W + 40, -40]], west: [[-40, H + 40], [-40, -40]] }[edge];
    const pts = [...shore, ...far];
    const centre = { south: [W / 2, H - SHORE / 2 + 12], north: [W / 2, SHORE / 2 - 4], east: [W - SHORE / 2 + 8, H / 2], west: [SHORE / 2 - 8, H / 2] }[edge];
    const ripples = Array.from({ length: 16 }, () => {
      const along = rand();
      const depth = 0.35 + rand() * 0.5;
      const [x, y] = edge === 'south' || edge === 'north'
        ? [along * W, edge === 'south' ? box.y1 + bank + depth * (SHORE - bank) : box.y0 - bank - depth * (SHORE - bank)]
        : [edge === 'east' ? box.x1 + bank + depth * (SHORE - bank) : box.x0 - bank - depth * (SHORE - bank), along * H];
      return { x, y };
    });
    water = { name: city.water.name, points: pts.map((p) => p.join(',')).join(' '), centre, vertical: edge === 'east' || edge === 'west', ripples };
  }

  return {
    at, roads, blocks, labels, water, trees, compass,
    parks: parks.map((p) => ({ name: p.name, poly: rect(p.cells[0] + 0.07, p.cells[1] + 0.08, p.cells[2] + 0.93, p.cells[3] + 0.92), label: at((p.cells[0] + p.cells[2] + 1) / 2, (p.cells[1] + p.cells[3] + 1) / 2) })),
    sites: sites.map((s) => ({
      name: s.name,
      poly: rect(s.cells[0] + 0.06, s.cells[1] + 0.07, s.cells[2] + 0.94, s.cells[3] + 0.93),
      building: s.building ? rect(...s.building) : null,
      label: (([x, y]) => [x, Math.max(y, 26)])(at((s.cells[0] + s.cells[2] + 1) / 2, s.cells[1] + 0.2)),
    })),
  };
}

const line = ([a, b]) => `M${a[0].toFixed(1)} ${a[1].toFixed(1)} L${b[0].toFixed(1)} ${b[1].toFixed(1)}`;

/** The printed plan itself. Places, pins and routes are laid over it by the caller. */
export default function CityPlan({ plan, children }) {
  const width = (r) => (r.major ? 24 : 16);
  return (
    <svg className="plan" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Street map">
      <rect width={W} height={H} className="plan__ground" />
      {plan.blocks.map((b, i) => <polygon key={`s${i}`} points={b} className="plan__shadow" transform="translate(2.5 3)" />)}
      {plan.blocks.map((b, i) => <polygon key={`b${i}`} points={b} className="plan__block" />)}
      {plan.roads.map((r, i) => <path key={`c${i}`} d={line(r.l)} className="plan__casing" strokeWidth={width(r) + 3} />)}
      {plan.roads.map((r, i) => <path key={`r${i}`} d={line(r.l)} className="plan__road" strokeWidth={width(r)} />)}
      {plan.parks.map((p) => <polygon key={p.name} points={p.poly} className="plan__park" />)}
      {plan.trees.map((t, i) => <circle key={`t${i}`} cx={t.p[0]} cy={t.p[1]} r={t.r} className="plan__tree" />)}
      {plan.sites.map((s) => (
        <g key={s.name}>
          <polygon points={s.poly} className="plan__site" />
          {s.building && <polygon points={s.building} className="plan__building" />}
        </g>
      ))}
      {plan.water && (
        <g>
          <polygon points={plan.water.points} className="plan__water" />
          {plan.water.ripples.map((r, i) => <path key={i} d={plan.water.vertical ? `M${r.x} ${r.y - 9} q4 4.5 0 9 q-4 4.5 0 9` : `M${r.x - 9} ${r.y} q4.5 -4 9 0 q4.5 4 9 0`} className="plan__ripple" />)}
          <text className="plan__water-name" x={plan.water.centre[0]} y={plan.water.centre[1]} textAnchor="middle"
            transform={plan.water.vertical ? `rotate(-90 ${plan.water.centre[0]} ${plan.water.centre[1]})` : undefined}>{plan.water.name}</text>
        </g>
      )}
      {plan.parks.map((p) => <text key={p.name} className="plan__park-name" x={p.label[0]} y={p.label[1]} textAnchor="middle">{p.name}</text>)}
      {plan.sites.map((s) => <text key={s.name} className="plan__site-name" x={s.label[0]} y={s.label[1]} textAnchor="middle">{s.name}</text>)}
      {plan.labels.map((l) => (
        <text key={l.name} className={l.major ? 'plan__street plan__street--major' : 'plan__street'} x={l.x} y={l.y} dy="3.4" textAnchor="middle" transform={`rotate(${l.angle.toFixed(1)} ${l.x.toFixed(1)} ${l.y.toFixed(1)})`}>{l.name}</text>
      ))}
      <g className="plan__compass" transform={`translate(${plan.compass[0]} ${plan.compass[1]})`}>
        <circle r="24" />
        <path d="M0 -20 L6 0 L0 20 L-6 0 Z" />
        <path d="M0 -20 L6 0 L-6 0 Z" className="plan__compass-n" />
        <text y="-28" textAnchor="middle">N</text>
      </g>
      {children}
    </svg>
  );
}
