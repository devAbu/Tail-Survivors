// Tail Survivors - core simulation (no DOM, no drawing). Loaded by the game and by tools/sim.js.
// All entities live in preallocated pools: nothing is allocated inside update().
(function (root) {
  'use strict';
  var TS = root.TS = root.TS || {};
  var D = TS.D;
  var PI = Math.PI, PI2 = Math.PI * 2;
  var W = D.W, EN = D.E;
  var MAXE = 240, MAXC = 150, MAXB = 96, MAXEB = 64, MAXP = 40, MAXM = 30, MAXBO = 28, MAXRG = 28, MAXPT = 260, MAXF = 10;
  var CELL = 48;

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function angDiff(a, b) { var d = (b - a) % PI2; if (d > PI) d -= PI2; if (d < -PI) d += PI2; return d; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  TS.createGame = function (opts) {
    opts = opts || {};
    var rnd = opts.rng || mulberry32(opts.seed || ((Math.random() * 1e9) | 0));
    var perm = opts.perm || {};
    var pHp = 1 + 0.10 * (perm.hp | 0), pDmg = 1 + 0.06 * (perm.dmg | 0), pMag = 1 + 0.15 * (perm.magnet | 0),
        pXp = 1 + 0.08 * (perm.xp | 0), pSpd = 1 + 0.03 * (perm.spd | 0);
    var A = D.ARENA, GAP = D.SEG_GAP, GN = Math.ceil(A / CELL) + 1;
    var i;

    // ---------- pools ----------
    var E = [], C = [], B = [], EB = [], P = [], M = [], BO = [], RG = [], PT = [], F = [];
    for (i = 0; i < MAXE; i++) E.push({ alive: false, type: 0, x: 0, y: 0, hp: 0, maxHp: 1, r: 8, kx: 0, ky: 0, cd: 0, flash: 0, a: 0, b: 0, c: 0, m: 0, dx: 0, dy: 0, v: 0 });
    for (i = 0; i < MAXC; i++) C.push({ alive: false, x: 0, y: 0, v: 1, m: false, s: 0 });
    for (i = 0; i < MAXB; i++) B.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, dmg: 0, life: 0, pierce: 0, h0: -1, h1: -1, h2: -1 });
    for (i = 0; i < MAXEB; i++) EB.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, dmg: 0, life: 0 });
    for (i = 0; i < MAXP; i++) P.push({ alive: false, x: 0, y: 0, r: 0, t: 0, dur: 1, dps: 0, tick: 0 });
    for (i = 0; i < MAXM; i++) M.push({ alive: false, x: 0, y: 0, t: 0, fuse: 1, r: 0, dmg: 0 });
    for (i = 0; i < MAXBO; i++) BO.push({ t: 0, x1: 0, y1: 0, x2: 0, y2: 0 });
    for (i = 0; i < MAXRG; i++) RG.push({ t: 0, dur: 1, x: 0, y: 0, r: 0, col: '#fff' });
    for (i = 0; i < MAXPT; i++) PT.push({ t: 0, dur: 1, x: 0, y: 0, vx: 0, vy: 0, size: 2, col: '#fff' });
    for (i = 0; i < MAXF; i++) F.push({ on: false, x: 0, y: 0 });
    var cur = { e: 0, c: 0, b: 0, eb: 0, p: 0, m: 0, bo: 0, rg: 0, pt: 0 };

    var gridHead = new Int16Array(GN * GN), gridNext = new Int16Array(MAXE), qbuf = new Int16Array(256);
    var hitBuf = new Int16Array(12);

    // ---------- state ----------
    var head = { x: A / 2, y: A / 2, ang: -PI / 2, hp: 0, maxHp: Math.round(140 * pHp), inv: 0, r: D.HEAD_R };
    head.hp = head.maxHp;
    var segs = [];
    var G = {
      state: 'run',          // 'run' | 'levelup' | 'dead' | 'won'
      t: 0, kills: 0, bossKills: 0, level: 1, xp: 0, xpNeed: D.xpNeed(1), pending: 0,
      bonusCoins: 0, shake: 0, alive: 0, lost: 0,
      head: head, segs: segs,
      E: E, C: C, B: B, EB: EB, P: P, M: M, BO: BO, RG: RG, PT: PT, F: F,
      ev: [], choices: [], rerolls: 0,
      banner: '', bannerT: 0, boss: null, canRevive: true, endT: 0, spawnR: 480
    };
    var frame = 0, spawnAcc = 0, ringT = 120, bossIdx = 0, warned = 0;

    function rr(a, b) { return a + (b - a) * rnd(); }
    function ev(n) { G.ev.push(n); }

    // ---------- helpers ----------
    function segMaxHp(s) { return Math.round((50 + 14 * s.lvl) * (s.type === W.AEGIS ? 1.5 : 1) * pHp); }
    function newSeg(type) {
      var s = { type: type, lvl: 1, hp: 0, maxHp: 0, cd: 0.4, inv: 0, x: 0, y: 0, dead: false };
      s.maxHp = segMaxHp(s); s.hp = s.maxHp; return s;
    }
    function addSeg(type) {
      var s = newSeg(type), last = segs.length ? segs[segs.length - 1] : head;
      s.x = last.x - Math.cos(head.ang) * GAP; s.y = last.y - Math.sin(head.ang) * GAP;
      segs.push(s);
    }
    function buildGrid() {
      gridHead.fill(-1);
      for (var k = 0; k < MAXE; k++) {
        var e = E[k]; if (!e.alive) continue;
        var cx = clamp((e.x / CELL) | 0, 0, GN - 1), cy = clamp((e.y / CELL) | 0, 0, GN - 1), c = cy * GN + cx;
        gridNext[k] = gridHead[c]; gridHead[c] = k;
      }
    }
    // fills qbuf with enemy indices touching circle (x,y,r); returns count
    function query(x, y, r) {
      var x0 = clamp(((x - r - 20) / CELL) | 0, 0, GN - 1), x1 = clamp(((x + r + 20) / CELL) | 0, 0, GN - 1);
      var y0 = clamp(((y - r - 20) / CELL) | 0, 0, GN - 1), y1 = clamp(((y + r + 20) / CELL) | 0, 0, GN - 1);
      var n = 0;
      for (var cy = y0; cy <= y1; cy++) for (var cx = x0; cx <= x1; cx++) {
        var k = gridHead[cy * GN + cx];
        while (k >= 0) {
          var e = E[k];
          if (e.alive) {
            var dx = e.x - x, dy = e.y - y, rr2 = r + e.r;
            if (dx * dx + dy * dy <= rr2 * rr2 && n < 256) qbuf[n++] = k;
          }
          k = gridNext[k];
        }
      }
      return n;
    }
    function nearest(x, y, range) {
      var best = -1, bd = range * range;
      for (var k = 0; k < MAXE; k++) {
        var e = E[k]; if (!e.alive) continue;
        var dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = k; }
      }
      return best;
    }

    // ---------- fx ----------
    function particle(x, y, vx, vy, dur, size, col) {
      var p = PT[cur.pt]; cur.pt = (cur.pt + 1) % MAXPT;
      p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.t = dur; p.dur = dur; p.size = size; p.col = col;
    }
    function burst(x, y, n, spd, col, size) {
      for (var k = 0; k < n; k++) { var a = rnd() * PI2, s = spd * (0.4 + rnd() * 0.6); particle(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.35 + rnd() * 0.3, size, col); }
    }
    function ring(x, y, r, dur, col) {
      var g = RG[cur.rg]; cur.rg = (cur.rg + 1) % MAXRG;
      g.x = x; g.y = y; g.r = r; g.t = dur; g.dur = dur; g.col = col;
    }

    // ---------- enemies ----------
    function hpMul() { return 1 + G.t / 110; }
    function spawnEnemy(type, x, y, variant) {
      var e = null;
      for (var k = 0; k < MAXE; k++) { var j = (cur.e + k) % MAXE; if (!E[j].alive) { e = E[j]; cur.e = (j + 1) % MAXE; break; } }
      if (!e) return null;
      var def = D.ENEMIES[type];
      e.alive = true; e.type = type; e.x = clamp(x, 16, A - 16); e.y = clamp(y, 16, A - 16);
      e.r = def.r; e.kx = 0; e.ky = 0; e.cd = 0.6; e.flash = 0; e.m = 0; e.v = variant | 0;
      e.hp = e.maxHp = type === EN.BOSS ? D.BOSS_HP[e.v] : def.hp * hpMul();
      e.a = 2.5 + rnd() * 2; e.b = 3; e.c = 3.5;
      G.alive++;
      return e;
    }
    function spawnCrystal(x, y, v) {
      for (var k = 0; k < MAXC; k++) {
        var j = (cur.c + k) % MAXC;
        if (!C[j].alive) { var c = C[j]; c.alive = true; c.x = x + rr(-6, 6); c.y = y + rr(-6, 6); c.v = v; c.m = false; c.s = 0; cur.c = (j + 1) % MAXC; return; }
      }
      addXp(v);
    }
    function killEnemy(e) {
      e.alive = false; G.alive--; G.kills++;
      var def = D.ENEMIES[e.type];
      if (e.type === EN.BOSS) {
        for (var k = 0; k < 10; k++) spawnCrystal(e.x + rr(-30, 30), e.y + rr(-30, 30), def.xp);
        burst(e.x, e.y, 40, 220, '#ff6b6b', 4); ring(e.x, e.y, 120, 0.6, '#ffd24d');
        G.bossKills++; G.boss = null; G.banner = 'bossDown'; G.bannerT = 3; ev('bossDie');
        if (e.v === 1) { G.state = 'won'; G.endT = G.t; ev('win'); }
      } else {
        spawnCrystal(e.x, e.y, def.xp);
        burst(e.x, e.y, e.type === EN.BRUTE ? 9 : 5, 90, e.type === EN.BRUTE ? '#b36bff' : '#ff8a8a', 2.2);
        ev('kill');
      }
    }
    function hurtEnemy(e, dmg, kx, ky, silent) {
      if (!e.alive) return;
      e.hp -= dmg;
      if (!silent) {
        e.flash = 0.07;
        var m = e.type === EN.BOSS ? 0.08 : 1;
        e.kx = clamp(e.kx + kx * m, -220, 220); e.ky = clamp(e.ky + ky * m, -220, 220);
      }
      if (e.hp <= 0) killEnemy(e);
    }

    // ---------- snake damage ----------
    function aegisRed(i) {
      var red = 0, s;
      if (i >= 0 && segs[i] && segs[i].type === W.AEGIS) red += 0.15;
      s = segs[i - 1]; if (i - 1 >= 0 && s && s.type === W.AEGIS) red += D.WS[W.AEGIS][s.lvl].red;
      s = segs[i + 1]; if (s && s.type === W.AEGIS) red += D.WS[W.AEGIS][s.lvl].red;
      return Math.min(0.75, red);
    }
    function hurtHead(d) {
      if (head.inv > 0 || G.state !== 'run') return;
      head.hp -= d * (1 - aegisRed(-1 + 0)) * 1; // head counts as slot -1; only segs[0] (index i+1 = 0) shields it
      head.inv = 0.4; G.shake = Math.max(G.shake, 6); ev('hurt');
      burst(head.x, head.y, 6, 100, '#ff6b6b', 2.4);
      if (head.hp <= 0) { head.hp = 0; G.state = 'dead'; G.endT = G.t; ev('dead'); }
    }
    function hurtSeg(i, d) {
      var s = segs[i]; if (s.inv > 0 || s.dead) return;
      s.hp -= d * 0.65 * (1 - aegisRed(i)); s.inv = 0.4; ev('hurtSeg');
      if (s.hp <= 0) s.dead = true;
    }
    function cleanSegs() {
      for (var k = segs.length - 1; k >= 0; k--) {
        if (segs[k].dead) {
          var s = segs[k];
          burst(s.x, s.y, 16, 150, D.WEAPONS[s.type].color, 3); ring(s.x, s.y, 40, 0.4, D.WEAPONS[s.type].color);
          segs.splice(k, 1); G.lost++; ev('detach'); G.shake = Math.max(G.shake, 9);
        }
      }
    }
    function healSnake(v) {
      head.hp = Math.min(head.maxHp, head.hp + v);
      var worst = -1, wr = 1;
      for (var k = 0; k < segs.length; k++) { var r = segs[k].hp / segs[k].maxHp; if (r < wr) { wr = r; worst = k; } }
      if (worst >= 0) segs[worst].hp = Math.min(segs[worst].maxHp, segs[worst].hp + v);
    }

    // ---------- xp / level up ----------
    function addXp(v) {
      G.xp += v * pXp;
      while (G.xp >= G.xpNeed) { G.xp -= G.xpNeed; G.level++; G.xpNeed = D.xpNeed(G.level); G.pending++; }
      if (G.pending > 0 && G.state === 'run') openLevelUp();
    }
    function openLevelUp() {
      G.pending--; G.state = 'levelup'; G.rerolls = 0; G.choices = genChoices(); ev('level');
    }
    function genChoices() {
      var cand = [], k, t, n = segs.length, tries;
      if (n < D.MAX_SEG) {
        var types = [0, 1, 2, 3, 4, 5];
        for (k = types.length - 1; k > 0; k--) { var j = (rnd() * (k + 1)) | 0; t = types[k]; types[k] = types[j]; types[j] = t; }
        for (k = 0; k < 3; k++) cand.push({ k: 'add', type: types[k] });
      }
      var ups = [];
      for (k = 0; k < n; k++) if (segs[k].lvl < D.MAX_LVL) ups.push(k);
      for (k = ups.length - 1; k > 0; k--) { var j2 = (rnd() * (k + 1)) | 0; t = ups[k]; ups[k] = ups[j2]; ups[j2] = t; }
      for (k = 0; k < Math.min(2, ups.length); k++) cand.push({ k: 'up', i: ups[k] });
      if (n >= 2) {
        for (tries = 0; tries < 8; tries++) {
          var a = (rnd() * n) | 0, b = (rnd() * n) | 0;
          if (a !== b && (segs[a].type !== segs[b].type || segs[a].lvl !== segs[b].lvl)) { cand.push({ k: 'swap', a: Math.min(a, b), b: Math.max(a, b) }); break; }
        }
      }
      for (k = cand.length - 1; k > 0; k--) { var j3 = (rnd() * (k + 1)) | 0; t = cand[k]; cand[k] = cand[j3]; cand[j3] = t; }
      var out = cand.slice(0, 3);
      if (out.length < 3) out.push({ k: 'heal' });
      if (out.length < 3) out.push({ k: 'coins', n: 25 });
      return out;
    }

    // ---------- weapons ----------
    function spawnBullet(x, y, a, spd, dmg, pierce) {
      var b = B[cur.b]; cur.b = (cur.b + 1) % MAXB;
      b.alive = true; b.x = x; b.y = y; b.vx = Math.cos(a) * spd; b.vy = Math.sin(a) * spd; b.dmg = dmg; b.life = 0.9; b.pierce = pierce; b.h0 = b.h1 = b.h2 = -1;
    }
    function fireBlaster(s, w) {
      var k = nearest(s.x, s.y, w.range); if (k < 0) return false;
      var e = E[k], a = Math.atan2(e.y - s.y, e.x - s.x);
      for (var j = 0; j < w.n; j++) spawnBullet(s.x, s.y, a + (j - (w.n - 1) / 2) * 0.17, w.spd, w.dmg * pDmg, w.pierce);
      ev('shoot'); return true;
    }
    function fireSpike(s, w) {
      var n = query(s.x, s.y, w.r); if (!n) return false;
      for (var k = 0; k < n; k++) {
        var e = E[qbuf[k]]; if (!e.alive) continue;
        var dx = e.x - s.x, dy = e.y - s.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        hurtEnemy(e, w.dmg * pDmg, dx / d * w.kb, dy / d * w.kb);
      }
      ring(s.x, s.y, w.r, 0.25, D.WEAPONS[W.SPIKE].color); ev('spike'); return true;
    }
    function fireToxin(s, w) {
      if (nearest(s.x, s.y, 320) < 0) return false;
      var p = P[cur.p]; cur.p = (cur.p + 1) % MAXP;
      p.alive = true; p.x = s.x; p.y = s.y; p.r = w.r; p.t = w.dur; p.dur = w.dur; p.dps = w.dps * pDmg; p.tick = 0.1;
      ev('toxin'); return true;
    }
    function fireMortar(s, w) {
      if (nearest(s.x, s.y, 320) < 0) return false;
      var m = M[cur.m]; cur.m = (cur.m + 1) % MAXM;
      m.alive = true; m.x = s.x; m.y = s.y; m.t = w.fuse; m.fuse = w.fuse; m.r = w.r; m.dmg = w.dmg * pDmg;
      ev('mortar'); return true;
    }
    function fireArc(s, w) {
      var first = nearest(s.x, s.y, w.range); if (first < 0) return false;
      var n = 0, px = s.x, py = s.y, k = first;
      while (k >= 0 && n < w.n && n < 12) {
        var e = E[k]; hitBuf[n++] = k;
        var bo = BO[cur.bo]; cur.bo = (cur.bo + 1) % MAXBO;
        bo.t = 0.14; bo.x1 = px; bo.y1 = py; bo.x2 = e.x; bo.y2 = e.y;
        px = e.x; py = e.y;
        hurtEnemy(e, w.dmg * pDmg, 0, 0);
        // next target: nearest alive enemy not yet hit, within jump range
        var best = -1, bd = w.jump * w.jump;
        for (var j = 0; j < MAXE; j++) {
          var o = E[j]; if (!o.alive) continue;
          var dup = false; for (var q = 0; q < n; q++) if (hitBuf[q] === j) { dup = true; break; }
          if (dup) continue;
          var dx = o.x - px, dy = o.y - py, d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = j; }
        }
        k = best;
      }
      ev('zap'); return true;
    }
    function aegisTick(s, w, dt) {
      var n = query(s.x, s.y, w.r); if (!n) return;
      for (var k = 0; k < n; k++) {
        var e = E[qbuf[k]]; if (!e.alive) continue;
        var dx = e.x - s.x, dy = e.y - s.y, d = Math.sqrt(dx * dx + dy * dy) || 1, push = w.push * dt * (e.type === EN.BOSS ? 0.15 : 1);
        e.x += dx / d * push; e.y += dy / d * push;
        hurtEnemy(e, w.dps * pDmg * dt, 0, 0, true);
      }
    }
    function updateWeapons(dt) {
      for (var k = 0; k < segs.length; k++) {
        var s = segs[k];
        if (s.inv > 0) s.inv -= dt;
        if (s.hp < s.maxHp) s.hp = Math.min(s.maxHp, s.hp + 0.7 * dt);
        var w = D.WS[s.type][s.lvl];
        if (s.type === W.AEGIS) { aegisTick(s, w, dt); continue; }
        s.cd -= dt; if (s.cd > 0) continue;
        var fired = false;
        switch (s.type) {
          case W.SPIKE: fired = fireSpike(s, w); break;
          case W.BLASTER: fired = fireBlaster(s, w); break;
          case W.TOXIN: fired = fireToxin(s, w); break;
          case W.ARC: fired = fireArc(s, w); break;
          case W.MORTAR: fired = fireMortar(s, w); break;
        }
        s.cd = fired ? w.cd : 0.1;
      }
    }

    // ---------- projectiles & area effects ----------
    function updateProjectiles(dt) {
      var k, j, n;
      for (k = 0; k < MAXB; k++) {
        var b = B[k]; if (!b.alive) continue;
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > A || b.y > A) { b.alive = false; continue; }
        n = query(b.x, b.y, 4);
        for (j = 0; j < n; j++) {
          var id = qbuf[j];
          if (id === b.h0 || id === b.h1 || id === b.h2) continue;
          var e = E[id]; if (!e.alive) continue;
          var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1;
          hurtEnemy(e, b.dmg, b.vx / sp * 40, b.vy / sp * 40);
          ev('hit');
          if (b.pierce > 0) { b.pierce--; if (b.h0 < 0) b.h0 = id; else if (b.h1 < 0) b.h1 = id; else b.h2 = id; }
          else { b.alive = false; break; }
        }
      }
      for (k = 0; k < MAXP; k++) {
        var p = P[k]; if (!p.alive) continue;
        p.t -= dt; if (p.t <= 0) { p.alive = false; continue; }
        p.tick -= dt;
        if (p.tick <= 0) {
          p.tick = 0.25; n = query(p.x, p.y, p.r);
          for (j = 0; j < n; j++) { var pe = E[qbuf[j]]; if (pe.alive) hurtEnemy(pe, p.dps * 0.25, 0, 0, true); }
        }
      }
      for (k = 0; k < MAXM; k++) {
        var m = M[k]; if (!m.alive) continue;
        m.t -= dt; if (m.t > 0) continue;
        m.alive = false; n = query(m.x, m.y, m.r);
        for (j = 0; j < n; j++) {
          var me = E[qbuf[j]]; if (!me.alive) continue;
          var dx = me.x - m.x, dy = me.y - m.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
          hurtEnemy(me, m.dmg, dx / d * 160, dy / d * 160);
        }
        ring(m.x, m.y, m.r, 0.35, '#ff9f43'); burst(m.x, m.y, 10, 130, '#ffb35c', 2.6); ev('boom'); G.shake = Math.max(G.shake, 3);
      }
      for (k = 0; k < MAXEB; k++) {
        var q = EB[k]; if (!q.alive) continue;
        q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
        if (q.life <= 0) { q.alive = false; continue; }
        var hx = q.x - head.x, hy = q.y - head.y;
        if (hx * hx + hy * hy < (head.r + 5) * (head.r + 5)) { hurtHead(q.dmg); q.alive = false; continue; }
        for (j = 0; j < segs.length; j++) {
          var s = segs[j], sx = q.x - s.x, sy = q.y - s.y;
          if (sx * sx + sy * sy < (D.SEG_R + 5) * (D.SEG_R + 5)) { hurtSeg(j, q.dmg); q.alive = false; break; }
        }
      }
    }
    function spawnEB(x, y, a, spd, dmg) {
      var q = EB[cur.eb]; cur.eb = (cur.eb + 1) % MAXEB;
      q.alive = true; q.x = x; q.y = y; q.vx = Math.cos(a) * spd; q.vy = Math.sin(a) * spd; q.dmg = dmg; q.life = 4;
    }

    // ---------- enemy AI ----------
    function updateEnemies(dt) {
      frame++;
      var hx = head.x, hy = head.y;
      var reach = segs.length * GAP + 50, reach2 = reach * reach;
      var dmgMul = 1 + G.t / 400, par = frame & 1;
      for (var k = 0; k < MAXE; k++) {
        var e = E[k]; if (!e.alive) continue;
        var def = D.ENEMIES[e.type];
        if (e.flash > 0) e.flash -= dt;
        if (e.cd > 0) e.cd -= dt;
        var dx = hx - e.x, dy = hy - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        var mx = dx / d, my = dy / d, sp = def.spd;
        if (e.type === EN.DASHER) {
          e.a -= dt;
          if (e.a < 0) { e.m = e.m ? 0 : 1; e.a = e.m ? 0.45 : 2.2; }
          if (e.m) sp *= 2.4;
        } else if (e.type === EN.BOSS) {
          e.b -= dt;
          if (e.b <= 0) { e.b = e.v ? 3.2 : 4; if (G.alive < 190) for (var g = 0; g < 3; g++) spawnEnemy(EN.GRUB, e.x + rr(-40, 40), e.y + rr(-40, 40)); }
          if (e.v === 1) {
            e.c -= dt;
            if (e.c <= 0) { e.c = 4.5; var off = rnd() * PI2; for (var z = 0; z < 12; z++) spawnEB(e.x, e.y, off + z * PI2 / 12, 120, 10); ev('bossShot'); }
          }
          if (e.m === 0) { e.a -= dt; if (e.a <= 0) { e.m = 1; e.a = 0.9; } }
          else if (e.m === 1) { sp = 0; e.a -= dt; e.dx = mx; e.dy = my; if (e.a <= 0) { e.m = 2; e.a = 0.7; } }
          else { sp = 330; mx = e.dx; my = e.dy; e.a -= dt; if (e.a <= 0) { e.m = 0; e.a = e.v ? 3.5 : 5; } }
        }
        e.x += (mx * sp + e.kx) * dt; e.y += (my * sp + e.ky) * dt;
        var kd = Math.max(0, 1 - 7 * dt); e.kx *= kd; e.ky *= kd;
        // soft separation (half of the enemies per frame)
        if (e.type !== EN.BOSS && (k & 1) === par) {
          var n = query(e.x, e.y, e.r + 2);
          for (var j = 0; j < n; j++) {
            var o = E[qbuf[j]]; if (o === e) continue;
            var ox = e.x - o.x, oy = e.y - o.y, od = Math.sqrt(ox * ox + oy * oy) || 0.01, min = e.r + o.r;
            if (od < min) { var ov = (min - od) * 0.45; e.x += ox / od * ov; e.y += oy / od * ov; }
          }
        }
        if (e.x < 8) e.x = 8; else if (e.x > A - 8) e.x = A - 8;
        if (e.y < 8) e.y = 8; else if (e.y > A - 8) e.y = A - 8;
        // contact with head
        dx = hx - e.x; dy = hy - e.y; d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (e.cd <= 0 && d < e.r + head.r && head.inv <= 0) {
          hurtHead(def.dmg * dmgMul); e.cd = 0.7; e.kx -= dx / d * 140; e.ky -= dy / d * 140;
        } else if (d * d < reach2 + e.r * e.r && e.cd <= 0) {
          for (var s = 0; s < segs.length; s++) {
            var sg = segs[s]; if (sg.inv > 0) continue;
            var sx = sg.x - e.x, sy = sg.y - e.y, rad = e.r + D.SEG_R;
            if (sx * sx + sy * sy < rad * rad) { hurtSeg(s, def.dmg * dmgMul); e.cd = 0.7; break; }
          }
        }
      }
    }

    // ---------- director ----------
    function spawnPos(dist) {
      var a = rnd() * PI2;
      return [head.x + Math.cos(a) * dist, head.y + Math.sin(a) * dist];
    }
    function director(dt) {
      var t = G.t;
      var boss = D.BOSS_TIMES;
      if (bossIdx < boss.length && t >= boss[bossIdx] - 3 && warned <= bossIdx) { warned = bossIdx + 1; G.banner = 'bossIncoming'; G.bannerT = 3; ev('bossWarn'); }
      if (bossIdx < boss.length && t >= boss[bossIdx]) {
        var p = spawnPos(G.spawnR + 40), e = spawnEnemy(EN.BOSS, p[0], p[1], bossIdx);
        if (e) { G.boss = e; bossIdx++; }
      }
      if (t < 6) return;
      var rate = (1.0 + t / 60) * (G.boss ? 0.55 : 1);
      spawnAcc += dt * rate;
      while (spawnAcc >= 1) {
        spawnAcc -= 1;
        if (G.alive >= 190) continue;
        var w0 = 10, w1 = t > 45 ? 4 + t / 60 : 0, w2 = t > 120 ? 2 + t / 120 : 0, w3 = t > 75 ? 3 : 0, tot = w0 + w1 + w2 + w3, r = rnd() * tot, pp;
        if (r < w0) { pp = spawnPos(G.spawnR + rr(0, 50)); spawnEnemy(EN.GRUB, pp[0], pp[1]); }
        else if (r < w0 + w1) { pp = spawnPos(G.spawnR + rr(0, 50)); spawnEnemy(EN.DASHER, pp[0], pp[1]); }
        else if (r < w0 + w1 + w2) { pp = spawnPos(G.spawnR + rr(0, 50)); spawnEnemy(EN.BRUTE, pp[0], pp[1]); }
        else { pp = spawnPos(G.spawnR + rr(0, 50)); for (var k = 0; k < 6; k++) spawnEnemy(EN.SWARM, pp[0] + rr(-18, 18), pp[1] + rr(-18, 18)); }
      }
      if (t >= ringT) {
        ringT += 50;
        for (var z = 0; z < 12; z++) { var a = z * PI2 / 12; spawnEnemy(EN.GRUB, head.x + Math.cos(a) * (G.spawnR + 20), head.y + Math.sin(a) * (G.spawnR + 20)); }
      }
    }

    // ---------- pickups ----------
    function placeFood(f, near) {
      var p = near ? spawnPos(rr(70, 130)) : spawnPos(rr(200, 520));
      f.x = clamp(p[0], 30, A - 30); f.y = clamp(p[1], 30, A - 30); f.on = true;
    }
    function updatePickups(dt) {
      var k, magR = 40 * pMag, mr2 = magR * magR, hr = head.r + 7;
      for (k = 0; k < MAXC; k++) {
        var c = C[k]; if (!c.alive) continue;
        var dx = head.x - c.x, dy = head.y - c.y, d2 = dx * dx + dy * dy;
        if (d2 < mr2) c.m = true;
        if (c.m) {
          c.s = Math.min(c.s + dt * 500, 520); var d = Math.sqrt(d2) || 1;
          c.x += dx / d * (c.s + 120) * dt; c.y += dy / d * (c.s + 120) * dt;
        }
        if (d2 < hr * hr) { c.alive = false; ev('crystal'); addXp(c.v); if (G.state !== 'run') return; }
      }
      for (k = 0; k < MAXF; k++) {
        var f = F[k]; if (!f.on) continue;
        var fx = head.x - f.x, fy = head.y - f.y;
        if (fx * fx + fy * fy < 20 * 20) { healSnake(12); f.on = false; placeFood(f, false); ev('eat'); burst(f.x, f.y, 6, 70, '#ffd24d', 2); }
      }
    }

    function updateFx(dt) {
      var k;
      for (k = 0; k < MAXPT; k++) { var p = PT[k]; if (p.t > 0) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; } }
      for (k = 0; k < MAXRG; k++) if (RG[k].t > 0) RG[k].t -= dt;
      for (k = 0; k < MAXBO; k++) if (BO[k].t > 0) BO[k].t -= dt;
      if (G.shake > 0) G.shake = Math.max(0, G.shake - 30 * dt);
      if (G.bannerT > 0) G.bannerT -= dt;
    }

    // ---------- public API ----------
    // inp: { has: bool, ang: radians }
    G.update = function (dt, inp) {
      if (G.state !== 'run') return;
      G.t += dt;
      if (head.inv > 0) head.inv -= dt;
      if (head.hp < head.maxHp) head.hp = Math.min(head.maxHp, head.hp + 0.6 * dt);
      // steering: smooth, limited turn rate, constant speed
      if (inp && inp.has) {
        var diff = angDiff(head.ang, inp.ang), turn = 5.2 * dt;
        head.ang += clamp(diff, -turn, turn);
      }
      var sp = 105 * pSpd;
      head.x += Math.cos(head.ang) * sp * dt; head.y += Math.sin(head.ang) * sp * dt;
      if (head.x < 14) head.x = 14; else if (head.x > A - 14) head.x = A - 14;
      if (head.y < 14) head.y = 14; else if (head.y > A - 14) head.y = A - 14;
      var px = head.x, py = head.y, k;
      for (k = 0; k < segs.length; k++) {
        var s = segs[k], dx = s.x - px, dy = s.y - py, d = Math.sqrt(dx * dx + dy * dy);
        if (d > GAP) { var f = GAP / d; s.x = px + dx * f; s.y = py + dy * f; }
        else if (d < 0.001) { s.x = px - Math.cos(head.ang) * GAP; s.y = py - Math.sin(head.ang) * GAP; }
        px = s.x; py = s.y;
      }
      director(dt);
      buildGrid();
      updateEnemies(dt);
      updateWeapons(dt);
      updateProjectiles(dt);
      updatePickups(dt);
      cleanSegs();
      updateFx(dt);
      if (G.state === 'run' && G.t >= D.RUN_TIME + 120) { G.state = 'dead'; G.endT = G.t; }
    };

    G.choose = function (idx) {
      if (G.state !== 'levelup') return;
      var c = G.choices[idx]; if (!c) return;
      if (c.k === 'add') addSeg(c.type);
      else if (c.k === 'up') { var s = segs[c.i]; if (s && s.lvl < D.MAX_LVL) { s.lvl++; var ratio = 1; s.maxHp = segMaxHp(s); s.hp = s.maxHp * ratio; } }
      else if (c.k === 'swap') {
        var a = segs[c.a], b = segs[c.b];
        if (a && b) { var t1 = a.type, l1 = a.lvl, h1 = a.hp, m1 = a.maxHp, c1 = a.cd; a.type = b.type; a.lvl = b.lvl; a.hp = b.hp; a.maxHp = b.maxHp; a.cd = b.cd; b.type = t1; b.lvl = l1; b.hp = h1; b.maxHp = m1; b.cd = c1; ring(a.x, a.y, 30, 0.3, '#ffffff'); ring(b.x, b.y, 30, 0.3, '#ffffff'); ev('swap'); }
      }
      else if (c.k === 'heal') { head.hp = head.maxHp; for (var k = 0; k < segs.length; k++) segs[k].hp = segs[k].maxHp; }
      else if (c.k === 'coins') G.bonusCoins += c.n;
      ev('pick');
      if (G.pending > 0) openLevelUp(); else G.state = 'run';
    };
    G.reroll = function () { if (G.state === 'levelup') { G.choices = genChoices(); G.rerolls++; ev('pick'); } };
    G.revive = function () {
      if (G.state !== 'dead' || !G.canRevive) return false;
      G.canRevive = false; G.state = 'run';
      head.hp = head.maxHp * 0.6; head.inv = 2;
      for (var k = 0; k < MAXE; k++) {
        var e = E[k]; if (!e.alive) continue;
        var dx = e.x - head.x, dy = e.y - head.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (d < 220) { if (e.type === EN.BOSS) { e.kx += dx / d * 200; e.ky += dy / d * 200; } else { e.alive = false; G.alive--; } }
      }
      ring(head.x, head.y, 220, 0.5, '#ffffff'); burst(head.x, head.y, 24, 200, '#ffffff', 3);
      for (k = 0; k < segs.length; k++) segs[k].hp = Math.max(segs[k].hp, segs[k].maxHp * 0.5);
      return true;
    };
    G.nearestCrystal = function () {
      var best = -1, bd = 1e12;
      for (var k = 0; k < MAXC; k++) { var c = C[k]; if (!c.alive) continue; var dx = c.x - head.x, dy = c.y - head.y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = k; } }
      return best;
    };
    G.score = function () { return G.kills * 10 + Math.floor(G.t) * 2 + G.bossKills * 500 + (G.state === 'won' ? 1000 : 0); };
    G.coinsEarned = function () { return Math.floor(G.kills / 8) + Math.floor(G.t / 12) + G.bossKills * 40 + (G.state === 'won' ? 100 : 0) + G.bonusCoins; };

    // ---------- initial setup ----------
    var snake = D.SNAKES[0];
    if (opts.snake) for (i = 0; i < D.SNAKES.length; i++) if (D.SNAKES[i].id === opts.snake) snake = D.SNAKES[i];
    for (i = 0; i < snake.start.length; i++) addSeg(snake.start[i]);
    for (i = 0; i < MAXF; i++) placeFood(F[i], i < 3);
    for (i = 0; i < 6; i++) { // a few crystals ahead so the first seconds are obvious
      var a0 = head.ang + (i - 2.5) * 0.28, r0 = 70 + (i % 2) * 28;
      spawnCrystal(head.x + Math.cos(a0) * r0, head.y + Math.sin(a0) * r0, 1);
    }
    G.query = query; G.spawnEnemy = spawnEnemy; // exposed for tests
    return G;
  };
})(typeof window !== 'undefined' ? window : globalThis);
