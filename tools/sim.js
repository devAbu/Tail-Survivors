// Headless balance/sanity test: a simple bot plays full runs with the real game core.
//   node tools/sim.js [runs]      (CI runs it with 3)
const path = require('path');
require(path.join('..', 'www', 'data.js'));
require(path.join('..', 'www', 'game.js'));
const TS = globalThis.TS, D = TS.D;

function playRun(seed, perm) {
  const G = TS.createGame({ seed, perm });
  if (process.argv.includes('--god')) { G.head.maxHp = G.head.hp = 1e7; }
  const dt = 1 / 30;
  let steps = 0, rr = seed * 7919 + 13;
  const rnd = () => { rr = (rr * 1664525 + 1013904223) >>> 0; return rr / 4294967296; };
  let maxEnemies = 0, wall = Date.now();
  while ((G.state === 'run' || G.state === 'levelup') && G.t < D.RUN_TIME + 90 && steps < 40000) {
    steps++;
    if (G.state === 'levelup') {
      // prefer add > up > swap(rarely) > others
      let best = 0, bs = -1;
      G.choices.forEach((c, i) => { const s = (c.k === 'add' ? 3 : c.k === 'up' ? 2.5 : c.k === 'heal' ? 1.5 : 0.5) + rnd(); if (s > bs) { bs = s; best = i; } });
      G.choose(best); continue;
    }
    const h = G.head;
    let vx = 0, vy = 0;
    // flee from enemies
    for (const e of G.E) {
      if (!e.alive) continue;
      const dx = h.x - e.x, dy = h.y - e.y, d2 = dx * dx + dy * dy;
      if (d2 < 130 * 130) { const d = Math.sqrt(d2) || 1, w = (e.type === 4 ? 3 : 1) * (130 - d) / 130; vx += dx / d * w * 2.2; vy += dy / d * w * 2.2; }
    }
    // go for crystals, or food when hurt
    let bd = 1e9, tx = 0, ty = 0;
    for (const c of G.C) { if (!c.alive) continue; const d = (c.x - h.x) ** 2 + (c.y - h.y) ** 2; if (d < bd) { bd = d; tx = c.x; ty = c.y; } }
    if (h.hp < h.maxHp * 0.6) for (const f of G.F) { if (!f.on) continue; const d = (f.x - h.x) ** 2 + (f.y - h.y) ** 2; if (d < bd * 4) { bd = d; tx = f.x; ty = f.y; } }
    if (bd < 1e9) { const d = Math.sqrt(bd) || 1; vx += (tx - h.x) / d * 0.8; vy += (ty - h.y) / d * 0.8; }
    // stay away from walls
    const M = 220, A = D.ARENA;
    if (h.x < M) vx += (M - h.x) / M * 2; if (h.x > A - M) vx -= (h.x - (A - M)) / M * 2;
    if (h.y < M) vy += (M - h.y) / M * 2; if (h.y > A - M) vy -= (h.y - (A - M)) / M * 2;
    G.update(dt, { has: true, ang: Math.atan2(vy, vx) });
    G.ev.length = 0;
    if (G.alive > maxEnemies) maxEnemies = G.alive;
  }
  return { seed, state: G.state, time: Math.round(G.t), level: G.level, kills: G.kills, segs: G.segs.length, lost: G.lost, bosses: G.bossKills, maxEnemies, ms: Date.now() - wall, score: G.score() };
}

const runs = parseInt(process.argv[2] || '5', 10);
let bad = 0;
for (let i = 1; i <= runs; i++) {
  const r = playRun(i, {});
  console.log(JSON.stringify(r));
  if (!isFinite(r.time) || r.time < 5) bad++;
}
if (bad) { console.error('FAILED: ' + bad + ' run(s) ended abnormally'); process.exit(1); }
console.log('OK');
