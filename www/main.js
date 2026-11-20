// Tail Survivors - screens, input, rendering and the main loop.
(function () {
  'use strict';
  var TS = window.TS, D = TS.D, T = TS.T, Save = TS.Save, Ad = TS.AdService, Au = TS.Audio, fmt = TS.fmt;
  var SP, PI2 = Math.PI * 2;

  var cv = document.getElementById('c'), ctx = cv.getContext('2d', { alpha: false });
  var W = 360, H = 640, dpr = 1, S = 1, safeT = 10, safeB = 10;
  var screen = 'menu', backTo = 'menu';
  var G = null, summary = null, credited = 0, newBest = false, doubled = false, endTimer = 0, time = 0, hintAcc = 0;
  var tilePat = null, luT = 0, dprMax = 1.5, slowT = 0, slowN = 0;
  var joy = { active: false, id: -1, ax: 0, ay: 0, x: 0, y: 0, ang: 0, has: false };
  var pressed = null, btns = [], nb = 0;

  // ============ layout ============
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, dprMax);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    S = W / D.VIEW_W;
    var el = document.getElementById('safe');
    if (el) { var cs = getComputedStyle(el); safeT = Math.max(10, parseFloat(cs.paddingTop) || 0); safeB = Math.max(10, parseFloat(cs.paddingBottom) || 0); }
  }

  // ============ drawing helpers ============
  function rr(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  }
  function txt(s, x, y, size, col, align, weight) {
    ctx.font = (weight || '700') + ' ' + size + 'px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.fillStyle = col || '#fff'; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }
  function fit(s, maxW, size, weight) {
    ctx.font = (weight || '700') + ' ' + size + 'px "Trebuchet MS", "Segoe UI", sans-serif';
    var w = ctx.measureText(s).width; return w > maxW ? Math.max(9, Math.floor(size * maxW / w)) : size;
  }
  function img(c, x, y, w, h) { ctx.drawImage(c, x - w / 2, y - h / 2, w, h); }
  function mmss(t) { t = Math.floor(t); var m = Math.floor(t / 60), s = t % 60; return m + ':' + (s < 10 ? '0' : '') + s; }
  function shade(hex, k) {
    var n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return 'rgb(' + Math.round(r * k) + ',' + Math.round(g * k) + ',' + Math.round(b * k) + ')';
  }

  // buttons are registered while drawing; hit-tested on pointer events
  function button(id, x, y, w, h, label, o) {
    o = o || {};
    var b = btns[nb] || (btns[nb] = {}); nb++;
    b.id = id; b.x = x; b.y = y; b.w = w; b.h = h; b.fn = o.fn; b.disabled = !!o.disabled;
    var col = o.col || '#2fbf7f', down = pressed === id && !o.disabled, off = down ? 2 : 0;
    ctx.fillStyle = shade(col, 0.55); rr(x, y + 4, w, h, 14); ctx.fill();
    ctx.fillStyle = o.disabled ? shade(col, 0.7) : col; rr(x, y + off, w, h, 14); ctx.fill();
    if (!o.flat) { ctx.fillStyle = 'rgba(255,255,255,0.16)'; rr(x + 3, y + off + 3, w - 6, h * 0.42, 11); ctx.fill(); }
    if (label) {
      var tx = x + w / 2 + (o.icon ? 12 : 0), sz = fit(label, w - 28 - (o.icon ? 24 : 0), o.size || 20);
      txt(label, tx, y + off + h / 2 + 1, sz, o.tc || '#fff');
      if (o.icon === 'video') { // play-triangle in a rounded box
        var ix = x + 20 + Math.max(0, (w - 28 - ctx.measureText(label).width) / 2 - 22) * 0 + 6; ix = Math.max(x + 16, tx - ctx.measureText(label).width / 2 - 22);
        ctx.fillStyle = o.tc || '#fff'; ctx.beginPath(); ctx.moveTo(ix - 5, y + off + h / 2 - 7); ctx.lineTo(ix + 8, y + off + h / 2); ctx.lineTo(ix - 5, y + off + h / 2 + 7); ctx.closePath(); ctx.fill();
      }
    }
    return b;
  }
  function adButton(p, x, y, w, h, label, onReward) {
    var st = Ad.status(p), s, dis = false, col = '#f5b82e';
    if (st.state === 'watching') { s = fmt(T.adWatching, { s: Math.ceil(st.t) }); dis = true; col = '#a88a2a'; }
    else if (st.state === 'cooldown') { s = fmt(T.adCooldown, { s: Math.ceil(st.t) }); dis = true; col = '#5a5a66'; }
    else s = label;
    button('ad_' + p, x, y, w, h, s, { col: col, tc: dis ? '#e9e9e9' : '#2a1d00', icon: dis ? null : 'video', size: 19, disabled: dis,
      fn: function () { Ad.show(p, function () { Au.sfx('reward'); Au.vibe(25); onReward(); }); } });
  }
  function hitBtn(x, y) {
    for (var i = nb - 1; i >= 0; i--) { var b = btns[i]; if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b; }
    return null;
  }

  // ============ game flow ============
  function startRun() {
    G = TS.createGame({ perm: Save.data.perm, snake: Save.data.snake });
    G.spawnR = Math.sqrt(D.VIEW_W * D.VIEW_W / 4 + (H / S) * (H / S) / 4) + 40;  // spawn just outside the screen
    credited = 0; doubled = false; endTimer = 0; summary = null; newBest = false;
    Save.data.runs++; Save.save();
    joy.active = false; screen = 'play';
    Au.setMode('play');
  }
  function creditRun() {
    if (!G) return;
    var c = G.coinsEarned(), d = c - credited;
    if (d > 0) { Save.data.coins += d; credited = c; }
    var sc = G.score();
    if (sc > Save.data.bestScore) { Save.data.bestScore = sc; newBest = true; }
    if (G.t > Save.data.bestTime) Save.data.bestTime = G.t;
    if (G.level > Save.data.bestLevel) Save.data.bestLevel = G.level;
    Save.save();
  }
  function showOver() {
    creditRun();
    summary = { time: G.t, kills: G.kills, level: G.level, score: G.score(), coins: credited, won: G.state === 'won' };
    screen = 'over'; Au.setMode('menu');
  }
  function toMenu() { if (G && screen !== 'menu') creditRun(); G = null; screen = 'menu'; Au.setMode('menu'); }
  function pauseGame() { if (screen === 'play' && G && G.state === 'run') { screen = 'pause'; joy.active = false; } }

  // ============ input ============
  function pt(e) { return { x: e.clientX, y: e.clientY }; }
  function onDown(e) {
    e.preventDefault(); Au.init();
    var p = pt(e), b = hitBtn(p.x, p.y);
    if (b && !b.disabled) { pressed = b.id; return; }
    if (screen === 'play' && G && G.state === 'run' && !joy.active) {
      joy.active = true; joy.id = e.pointerId; joy.ax = joy.x = p.x; joy.ay = joy.y = p.y; joy.has = false;
      try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
    }
  }
  function onMove(e) {
    if (!joy.active || e.pointerId !== joy.id) return;
    var p = pt(e); joy.x = p.x; joy.y = p.y;
    var dx = p.x - joy.ax, dy = p.y - joy.ay, d = Math.sqrt(dx * dx + dy * dy);
    if (d > 56) { joy.ax = p.x - dx / d * 56; joy.ay = p.y - dy / d * 56; d = 56; dx = p.x - joy.ax; dy = p.y - joy.ay; }  // anchor follows the finger
    if (d > 8) { joy.has = true; joy.ang = Math.atan2(dy, dx); }
  }
  function onUp(e) {
    if (joy.active && e.pointerId === joy.id) { joy.active = false; }
    if (pressed) {
      var p = pt(e), b = hitBtn(p.x, p.y), id = pressed; pressed = null;
      if (b && b.id === id && !b.disabled && b.fn) { Au.sfx('click'); b.fn(); }
    }
  }
  function onCancel(e) { if (joy.active && e.pointerId === joy.id) joy.active = false; pressed = null; }

  // ============ world rendering ============
  function drawWorld() {
    var A = D.ARENA, vw = D.VIEW_W, vh = H / S, h = G.head;
    var cx = h.x - vw / 2, cy = h.y - vh / 2;
    cx = Math.max(-50, Math.min(A + 50 - vw, cx)); cy = Math.max(-50, Math.min(A + 50 - vh, cy));
    var sx = G.shake ? (Math.random() - 0.5) * G.shake : 0, sy = G.shake ? (Math.random() - 0.5) * G.shake : 0;
    var k = dpr * S;
    ctx.setTransform(k, 0, 0, k, (-cx + sx) * k, (-cy + sy) * k);
    ctx.fillStyle = '#070d12'; ctx.fillRect(cx - 10, cy - 10, vw + 20, vh + 20);
    var x0 = Math.max(0, cx), y0 = Math.max(0, cy), x1 = Math.min(A, cx + vw), y1 = Math.min(A, cy + vh);
    ctx.fillStyle = tilePat; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.strokeStyle = 'rgba(255,90,110,0.55)'; ctx.lineWidth = 4; ctx.strokeRect(0, 0, A, A);

    var i, n;
    // puddles
    for (i = 0; i < G.P.length; i++) {
      var p = G.P[i]; if (!p.alive) continue;
      ctx.globalAlpha = Math.min(1, p.t * 1.5) * 0.45; ctx.fillStyle = '#7fd13a'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, PI2); ctx.fill();
      ctx.globalAlpha = Math.min(1, p.t * 1.5) * 0.6; ctx.strokeStyle = '#b6f26a'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // aegis auras
    for (i = 0; i < G.segs.length; i++) {
      var sg = G.segs[i]; if (sg.type !== D.W.AEGIS) continue;
      var ar = D.WS[sg.type][sg.lvl].r;
      ctx.fillStyle = 'rgba(77,139,255,0.10)'; ctx.beginPath(); ctx.arc(sg.x, sg.y, ar, 0, PI2); ctx.fill();
      ctx.strokeStyle = 'rgba(120,170,255,0.55)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // mines
    for (i = 0; i < G.M.length; i++) {
      var m = G.M[i]; if (!m.alive) continue;
      var blink = (Math.floor(m.t * 8) & 1) ? '#ff5d73' : '#ffd0d8';
      ctx.fillStyle = '#2a1f2b'; ctx.beginPath(); ctx.arc(m.x, m.y, 6, 0, PI2); ctx.fill();
      ctx.fillStyle = blink; ctx.beginPath(); ctx.arc(m.x, m.y, 3, 0, PI2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,93,115,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(m.x, m.y, m.r * (1 - m.t / m.fuse), 0, PI2); ctx.stroke();
    }
    // rings
    ctx.lineWidth = 2;
    for (i = 0; i < G.RG.length; i++) {
      var g = G.RG[i]; if (g.t <= 0) continue;
      var f = 1 - g.t / g.dur; ctx.globalAlpha = 1 - f; ctx.strokeStyle = g.col;
      ctx.beginPath(); ctx.arc(g.x, g.y, g.r * (0.25 + 0.75 * f), 0, PI2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // food + crystals
    for (i = 0; i < G.F.length; i++) { var fo = G.F[i]; if (fo.on && fo.x > cx - 20 && fo.x < cx + vw + 20 && fo.y > cy - 20 && fo.y < cy + vh + 20) img(SP.food, fo.x, fo.y + Math.sin(time * 3 + i) * 1.2, 20, 20); }
    for (i = 0; i < G.C.length; i++) { var c = G.C[i]; if (c.alive && c.x > cx - 10 && c.x < cx + vw + 10 && c.y > cy - 10 && c.y < cy + vh + 10) img(SP.crystal, c.x, c.y, 14, 14); }
    // boss telegraph
    var bo = G.boss;
    if (bo && bo.alive && bo.m === 1) {
      ctx.save(); ctx.translate(bo.x, bo.y); ctx.rotate(Math.atan2(bo.dy, bo.dx));
      ctx.globalAlpha = 0.18 + 0.18 * Math.sin(time * 30); ctx.fillStyle = '#ff3b5c'; ctx.fillRect(0, -bo.r, 320, bo.r * 2); ctx.restore(); ctx.globalAlpha = 1;
    }
    // enemies
    for (i = 0; i < G.E.length; i++) {
      var e = G.E[i]; if (!e.alive) continue;
      if (e.x < cx - 60 || e.x > cx + vw + 60 || e.y < cy - 60 || e.y > cy + vh + 60) continue;
      var spr = e.flash > 0 ? SP.enemyF[e.type] : SP.enemy[e.type];
      img(spr, e.x, e.y, spr.uw, spr.uh);
      if (e.type === D.E.BOSS) { /* hp bar is in the HUD */ }
    }
    // enemy bullets
    for (i = 0; i < G.EB.length; i++) { var q = G.EB[i]; if (q.alive) img(SP.ebullet, q.x, q.y, 12, 12); }
    // lightning
    ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 2;
    for (i = 0; i < G.BO.length; i++) {
      var b = G.BO[i]; if (b.t <= 0) continue;
      var mx = (b.x1 + b.x2) / 2 + (Math.random() - 0.5) * 14, my = (b.y1 + b.y2) / 2 + (Math.random() - 0.5) * 14;
      ctx.globalAlpha = Math.min(1, b.t * 8); ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(mx, my); ctx.lineTo(b.x2, b.y2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // bullets
    for (i = 0; i < G.B.length; i++) { var bl = G.B[i]; if (bl.alive) img(SP.bullet, bl.x, bl.y, 10, 10); }
    // tail links
    n = G.segs.length;
    if (n) {
      ctx.strokeStyle = '#27a766'; ctx.lineWidth = 11; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(h.x, h.y); for (i = 0; i < n; i++) ctx.lineTo(G.segs[i].x, G.segs[i].y); ctx.stroke();
      ctx.strokeStyle = '#37cf88'; ctx.lineWidth = 7; ctx.stroke();
    }
    for (i = n - 1; i >= 0; i--) {
      var s = G.segs[i];
      if (s.inv > 0 && (Math.floor(s.inv * 20) & 1)) ctx.globalAlpha = 0.45;
      img(SP.seg[s.type], s.x, s.y, 26, 26); ctx.globalAlpha = 1;
      for (var L = 0; L < s.lvl; L++) { ctx.fillStyle = '#fff'; ctx.fillRect(s.x - (s.lvl * 3 - 1) / 2 + L * 3, s.y - 14, 2, 2); }
      if (s.hp < s.maxHp) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(s.x - 9, s.y + 12, 18, 3);
        ctx.fillStyle = s.hp / s.maxHp > 0.35 ? '#5df2a0' : '#ff5d73'; ctx.fillRect(s.x - 9, s.y + 12, 18 * Math.max(0, s.hp / s.maxHp), 3);
      }
    }
    // head
    ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.ang);
    if (h.inv > 0 && (Math.floor(h.inv * 20) & 1)) ctx.globalAlpha = 0.5;
    ctx.drawImage(SP.head, -17, -17, 34, 34); ctx.restore(); ctx.globalAlpha = 1;
    // particles
    for (i = 0; i < G.PT.length; i++) {
      var pa = G.PT[i]; if (pa.t <= 0) continue;
      ctx.globalAlpha = pa.t / pa.dur; ctx.fillStyle = pa.col; ctx.fillRect(pa.x - pa.size / 2, pa.y - pa.size / 2, pa.size, pa.size);
    }
    ctx.globalAlpha = 1;

    // hint: arrow toward the nearest crystal during the very first run
    var hintOn = !Save.data.hintDone && G.state === 'run' && G.t < 45;
    if (hintOn) {
      var ci = G.nearestCrystal();
      if (ci >= 0) {
        var cr = G.C[ci], ang = Math.atan2(cr.y - h.y, cr.x - h.x), pul = 1 + 0.15 * Math.sin(time * 8);
        ctx.save(); ctx.translate(h.x + Math.cos(ang) * 46, h.y + Math.sin(ang) * 46); ctx.rotate(ang); ctx.scale(pul, pul);
        ctx.fillStyle = 'rgba(77,225,255,0.85)'; ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-5, -8); ctx.lineTo(-2, 0); ctx.lineTo(-5, 8); ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }
    // boss off-screen arrow (screen space)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (bo && bo.alive) {
      var bx = (bo.x - cx) * S, by = (bo.y - cy) * S;
      if (bx < 0 || bx > W || by < 0 || by > H) {
        var ba = Math.atan2(by - H / 2, bx - W / 2), ex = W / 2 + Math.cos(ba) * (W / 2 - 22), ey = H / 2 + Math.sin(ba) * (H / 2 - 60);
        ctx.save(); ctx.translate(Math.max(20, Math.min(W - 20, ex)), Math.max(safeT + 60, Math.min(H - 30, ey))); ctx.rotate(ba);
        ctx.fillStyle = '#ff3b5c'; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -10); ctx.lineTo(-4, 0); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }
  }

  // ============ HUD + overlays ============
  function drawHud() {
    var h = G.head, y = safeT;
    // xp bar
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, y, W, 8);
    ctx.fillStyle = '#4de1ff'; ctx.fillRect(0, y, W * Math.min(1, G.xp / G.xpNeed), 8);
    txt(T.level + ' ' + G.level, 12, y + 24, 13, '#bfefff', 'left');
    // head hp
    var bw = Math.min(150, W * 0.4), by = y + 38;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; rr(10, by, bw, 14, 7); ctx.fill();
    var r = Math.max(0, h.hp / h.maxHp); ctx.fillStyle = r > 0.35 ? '#5df2a0' : '#ff5d73'; if (r > 0) { rr(10, by, Math.max(8, bw * r), 14, 7); ctx.fill(); }
    txt(Math.ceil(h.hp) + '', 10 + bw / 2, by + 8, 11, '#08140e');
    // timer + kills
    txt(mmss(G.t), W / 2, y + 26, 22, '#ffffff');
    txt(T.kills + ' ' + G.kills, W - 62, y + 26, 13, '#ffd2d2', 'right');
    // pause
    button('pause', W - 50, y + 12, 40, 40, '', { col: '#33495a', fn: pauseGame });
    ctx.fillStyle = '#fff'; ctx.fillRect(W - 38, y + 24, 5, 16); ctx.fillRect(W - 27, y + 24, 5, 16);
    // boss bar
    var bo = G.boss;
    if (bo && bo.alive) {
      var bw2 = W * 0.7, bx = (W - bw2) / 2, byy = y + 62;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; rr(bx, byy, bw2, 12, 6); ctx.fill();
      ctx.fillStyle = '#ff3b5c'; rr(bx, byy, Math.max(8, bw2 * Math.max(0, bo.hp / bo.maxHp)), 12, 6); ctx.fill();
    }
    // banner
    if (G.bannerT > 0) {
      var a = Math.min(1, G.bannerT), isBoss = G.banner === 'bossIncoming';
      ctx.globalAlpha = a; txt(T[G.banner], W / 2, H * 0.28, 30, isBoss ? '#ff5d73' : '#ffd24d'); ctx.globalAlpha = 1;
    }
    // joystick
    if (joy.active) {
      ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(joy.ax, joy.ay, 40, 0, PI2); ctx.stroke();
      var dx = joy.x - joy.ax, dy = joy.y - joy.ay, d = Math.min(40, Math.sqrt(dx * dx + dy * dy)), a2 = Math.atan2(dy, dx);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(joy.ax + Math.cos(a2) * d, joy.ay + Math.sin(a2) * d, 17, 0, PI2); ctx.fill();
    }
    // first-run hint: animated finger drag, no text
    if (!Save.data.hintDone && G.state === 'run' && G.t < 45 && hintAcc < 1.8) {
      var ax = W / 2, ay = H * 0.78, fx = ax + Math.sin(time * 2.4) * 46;
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ax, ay, 44, 0, PI2); ctx.stroke();
      var rp = (time * 1.6) % 1; ctx.globalAlpha = 0.5 * (1 - rp); ctx.beginPath(); ctx.arc(fx, ay, 16 + rp * 20, 0, PI2); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(fx, ay, 15, 0, PI2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (var sd = -1; sd <= 1; sd += 2) { ctx.beginPath(); ctx.moveTo(ax + sd * 66, ay - 9); ctx.lineTo(ax + sd * 76, ay); ctx.lineTo(ax + sd * 66, ay + 9); ctx.stroke(); }
    }
  }

  function dim(a) { ctx.fillStyle = 'rgba(4,9,14,' + a + ')'; ctx.fillRect(0, 0, W, H); }

  function cardInfo(c) { // -> {icon, icon2, title, desc, tag, col}
    var segs = G.segs;
    if (c.k === 'add') return { icon: SP.icon[c.type], title: T.weapon[c.type].name, desc: T.weapon[c.type].desc, tag: T.newSegment, col: D.WEAPONS[c.type].color, tcol: '#2fbf7f' };
    if (c.k === 'up') { var s = segs[c.i]; return { icon: SP.icon[s.type], title: fmt(T.upTitle, { name: T.weapon[s.type].name, to: s.lvl + 1 }), desc: fmt(T.upDesc, { slot: c.i + 1, text: T.weapon[s.type].up }), tag: T.upgrade, col: D.WEAPONS[s.type].color, tcol: '#f5b82e' }; }
    if (c.k === 'swap') return { icon: SP.icon[segs[c.a].type], icon2: SP.icon[segs[c.b].type], title: T.swapTitle, desc: fmt(T.swapDesc, { a: c.a + 1, b: c.b + 1 }), tag: '', col: '#8fb4ff', tcol: '#4d8bff' };
    if (c.k === 'heal') return { icon: null, title: T.healTitle, desc: T.healDesc, tag: '', col: '#ff8a8a', tcol: '#ff5d73' };
    return { icon: SP.coin, title: T.coinsTitle, desc: fmt(T.coinsDesc, { n: c.n }), tag: '', col: '#ffd24d', tcol: '#f5b82e' };
  }
  function drawLevelUp() {
    dim(0.74);
    txt(T.levelUp, W / 2, safeT + 44, 34, '#ffe27a');
    txt(T.chooseOne, W / 2, safeT + 74, 14, '#9db4c4');
    // current tail strip
    var n = G.segs.length, sw = Math.min(34, (W - 40) / (D.MAX_SEG + 1)), sx0 = W / 2 - (n * sw) / 2 - sw / 2;
    img(SP.head, sx0 + sw / 2, safeT + 108, sw, sw);
    for (var i = 0; i < n; i++) {
      img(SP.seg[G.segs[i].type], sx0 + sw * (i + 1) + sw / 2, safeT + 108, sw * 0.9, sw * 0.9);
      txt(G.segs[i].lvl + '', sx0 + sw * (i + 1) + sw / 2, safeT + 108 + sw * 0.72, 10, '#cfe');
    }
    var y0 = safeT + 142, gap = 10, ch = Math.max(80, Math.min(112, (H - y0 - safeB - 74 - gap * 2) / 3));
    for (i = 0; i < G.choices.length; i++) {
      var c = G.choices[i], info = cardInfo(c), x = 14, w = W - 28, y = y0 + i * (ch + gap);
      var b = button('card' + i, x, y, w, ch, '', { col: '#1f3446', flat: true, disabled: luT < 0.4, fn: (function (k) { return function () { Save.data.lvlHintDone = true; Save.save(); G.choose(k); }; })(i) });
      ctx.strokeStyle = info.col; ctx.globalAlpha = 0.8; ctx.lineWidth = 2; rr(x + 1, y + 1, w - 2, ch - 2, 14); ctx.stroke(); ctx.globalAlpha = 1;
      var ix = x + 14 + 30;
      if (info.icon2) { img(info.icon, x + 40, y + ch / 2, 46, 46); img(info.icon2, x + 40 + 44, y + ch / 2, 46, 46); ix = x + 40 + 44 + 34; }
      else if (info.icon) img(info.icon, x + 44, y + ch / 2, 56, 56);
      else { ctx.fillStyle = '#ff5d73'; ctx.beginPath(); ctx.arc(x + 44, y + ch / 2, 22, 0, PI2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(x + 36, y + ch / 2 - 3, 16, 6); ctx.fillRect(x + 41, y + ch / 2 - 8, 6, 16); }
      var tx = info.icon2 ? ix + 4 : x + 84, tw = x + w - 12 - tx - (info.tag ? 0 : 0);
      txt(info.title, tx, y + ch * 0.36, fit(info.title, tw, 20), '#fff', 'left');
      txt(info.desc, tx, y + ch * 0.66, fit(info.desc, tw, 13, '600'), '#a9c1d1', 'left', '600');
      if (info.tag) {
        ctx.font = '800 11px "Trebuchet MS", sans-serif'; var tgw = ctx.measureText(info.tag).width + 14;
        ctx.fillStyle = info.tcol; rr(x + w - tgw - 8, y + 8, tgw, 19, 9); ctx.fill(); txt(info.tag, x + w - tgw / 2 - 8, y + 18, 11, '#0c1a14', 'center', '800');
      }
    }
    adButton('reroll', 30, y0 + 3 * (ch + gap) + 2, W - 60, 54, T.adReroll, function () { G.reroll(); });
    // first-time hint: pulsing tap ripple on the first card
    if (!Save.data.lvlHintDone) {
      var p = (time * 1.4) % 1, hx = W - 70, hy = y0 + ch * 0.62;
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.8 * (1 - p)) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(hx, hy, 10 + p * 26, 0, PI2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(hx, hy, 10, 0, PI2); ctx.fill();
    }
  }

  function toggle(id, label, y, key) {
    var on = Save.data.settings[key], x = 26, w = W - 52, h = 58;
    button(id, x, y, w, h, '', { col: '#243746', flat: true, fn: function () { Save.data.settings[key] = !Save.data.settings[key]; Save.save(); Au.apply(); Au.sfx('click'); if (key === 'vibe' && Save.data.settings.vibe) Au.vibe(40); } });
    txt(label, x + 18, y + h / 2 + 1, 19, '#fff', 'left');
    var sx = x + w - 70, sy = y + h / 2 - 14;
    ctx.fillStyle = on ? '#2fbf7f' : '#4a5560'; rr(sx, sy, 52, 28, 14); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx + (on ? 38 : 14), sy + 14, 11, 0, PI2); ctx.fill();
  }
  function drawSettings() {
    drawMenuBg(); dim(0.5);
    txt(T.settings, W / 2, safeT + 60, 32, '#fff');
    toggle('t_music', T.music, safeT + 110, 'music');
    toggle('t_sfx', T.sfx, safeT + 178, 'sfx');
    toggle('t_vibe', T.vibration, safeT + 246, 'vibe');
    button('back', 26, H - safeB - 74, W - 52, 58, T.back, { col: '#3b6ea8', fn: function () { screen = backTo; } });
  }

  function drawPause() {
    dim(0.7);
    txt(T.paused, W / 2, H * 0.24, 34, '#fff');
    var y = H * 0.33;
    toggle('p_music', T.music, y, 'music'); toggle('p_sfx', T.sfx, y + 66, 'sfx'); toggle('p_vibe', T.vibration, y + 132, 'vibe');
    button('resume', 26, y + 210, W - 52, 60, T.resume, { fn: function () { screen = 'play'; } });
    button('quit', 26, y + 282, W - 52, 52, T.quit, { col: '#7a3b4a', size: 17, fn: toMenu });
  }

  function drawOver() {
    dim(0.78);
    var s = summary, y = safeT + 20;
    txt(s.won ? T.victory : T.gameOver, W / 2, y + 40, 36, s.won ? '#ffe27a' : '#ff7b8c');
    if (newBest) txt(T.newBest, W / 2, y + 72, 15, '#ffd24d');
    var rows = [[T.time, mmss(s.time)], [T.kills, s.kills], [T.level, s.level], [T.score, s.score]], ry = y + 100;
    for (var i = 0; i < rows.length; i++) { txt(rows[i][0], 40, ry + i * 32, 17, '#9db4c4', 'left', '600'); txt(rows[i][1] + '', W - 40, ry + i * 32, 21, '#fff', 'right'); }
    ry += 4 * 32 + 8;
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(40, ry - 14, W - 80, 1);
    img(SP.coin, 52, ry + 18, 28, 28); txt(T.earned, 74, ry + 18, 16, '#ffe27a', 'left'); txt('+' + s.coins, W - 40, ry + 18, 26, '#ffd24d', 'right');
    txt(T.bestScore + ': ' + Save.data.bestScore, W / 2, ry + 56, 14, '#8fa5b5', 'center', '600');
    var bw = W - 52, hh = 54, yMenu = H - safeB - 50, yAgain = yMenu - 66, yy = yAgain - 62;
    button('toMenu', 26, yMenu, bw, 42, T.menu, { col: '#33495a', size: 16, fn: toMenu });
    button('again', 26, yAgain, bw, 58, T.playAgain, { fn: startRun });
    if (!doubled && s.coins > 0) { adButton('double', 26, yy, bw, hh, T.adDouble, function () { Save.data.coins += s.coins; s.coins *= 2; credited *= 2; doubled = true; Save.save(); }); yy -= 62; }
    if (G && G.canRevive && !s.won) { adButton('revive', 26, yy, bw, hh, T.adRevive, function () { if (G.revive()) { screen = 'play'; endTimer = 0; Au.setMode('play'); } }); }
  }

  // ============ menu + shop ============
  function drawMenuBg() {
    var k = dpr * S, off = (time * 14) % 64;
    ctx.setTransform(k, 0, 0, k, off * k, off * k * 0.6);
    ctx.fillStyle = tilePat; ctx.fillRect(-64, -64, W / S + 128, H / S + 128);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(7,13,18,0.55)'); g.addColorStop(1, 'rgba(7,13,18,0.9)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  function drawMenu() {
    drawMenuBg();
    txt('TAIL', W / 2, H * 0.14, Math.min(58, W * 0.16), '#6cf2b0');
    txt('SURVIVORS', W / 2, H * 0.14 + Math.min(54, W * 0.15), Math.min(40, W * 0.11), '#ffffff');
    // animated snake
    var n = 9, sy = H * 0.36, sw = Math.min(38, W / 11);
    for (var i = n; i >= 0; i--) {
      var x = W * 0.12 + i * (W * 0.76 / n), y = sy + Math.sin(time * 2.2 - i * 0.6) * 20;
      if (i === n) { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.cos(time * 2.2 - i * 0.6) * 0.5); ctx.drawImage(SP.head, -sw * 0.6, -sw * 0.6, sw * 1.2, sw * 1.2); ctx.restore(); }
      else img(SP.seg[(i + 1) % 6 === 0 ? 0 : (i * 5) % 6], x, y, sw, sw);
    }
    var bw = Math.min(300, W - 60), bx = (W - bw) / 2, y0 = H * 0.5;
    button('play', bx, y0, bw, 72, T.play, { size: 30, fn: startRun });
    button('shop', bx, y0 + 90, bw, 58, T.upgrades, { col: '#f5b82e', tc: '#2a1d00', size: 21, fn: function () { screen = 'shop'; } });
    button('settings', bx, y0 + 160, bw, 50, T.settings, { col: '#3b6ea8', size: 17, fn: function () { backTo = 'menu'; screen = 'settings'; } });
    img(SP.coin, W / 2 - 38, H - safeB - 62, 26, 26); txt(Save.data.coins + '', W / 2 - 18, H - safeB - 61, 22, '#ffd24d', 'left');
    txt(T.bestScore + ': ' + Save.data.bestScore + '   ' + T.bestTime + ': ' + mmss(Save.data.bestTime), W / 2, H - safeB - 22, 13, '#8fa5b5', 'center', '600');
  }
  function drawShop() {
    drawMenuBg(); dim(0.35);
    txt(T.upgrades, W / 2, safeT + 36, 30, '#fff');
    img(SP.coin, W / 2 - 34, safeT + 74, 26, 26); txt(Save.data.coins + '', W / 2 - 14, safeT + 74, 24, '#ffd24d', 'left');
    var y = safeT + 106, rh = Math.min(78, (H - y - safeB - 150) / 5 - 6);
    for (var i = 0; i < D.PERMS.length; i++) {
      (function (def) {
        var lvl = Save.data.perm[def.id] | 0, max = lvl >= def.max, cost = D.permCost(def, lvl), can = !max && Save.data.coins >= cost, x = 14, w = W - 28;
        ctx.fillStyle = '#1b2d3b'; rr(x, y, w, rh, 14); ctx.fill();
        var bwid = 92;
        txt(T.perm[def.id].name, x + 14, y + rh * 0.3, 18, '#fff', 'left');
        txt(T.perm[def.id].desc, x + 14, y + rh * 0.58, fit(T.perm[def.id].desc, w - bwid - 34, 12, '600'), '#9db4c4', 'left', '600');
        for (var p = 0; p < def.max; p++) { ctx.fillStyle = p < lvl ? '#5df2a0' : '#33495a'; ctx.fillRect(x + 14 + p * 14, y + rh * 0.8 - 3, 11, 6); }
        button('buy_' + def.id, x + w - bwid - 8, y + (rh - 46) / 2, bwid, 46, max ? T.max : cost + '', { col: max ? '#4a5560' : (can ? '#f5b82e' : '#5a5a66'), tc: can ? '#2a1d00' : '#d8d8d8', size: 18, disabled: !can,
          fn: function () { Save.data.coins -= cost; Save.data.perm[def.id] = lvl + 1; Save.save(); Au.sfx('pick'); } });
        y += rh + 6;
      })(D.PERMS[i]);
    }
    adButton('bonus', 26, y + 2, W - 52, 50, fmt(T.adBonus, { n: 60 }), function () { Save.data.coins += 60; Save.save(); });
    button('back', 26, H - safeB - 58, W - 52, 50, T.back, { col: '#3b6ea8', size: 18, fn: function () { screen = 'menu'; } });
  }

  // ============ main loop ============
  var last = 0, acc = 0;
  function drainEvents() {
    var ev = G.ev;
    for (var i = 0; i < ev.length; i++) {
      var n = ev[i]; Au.sfx(n);
      if (n === 'hurt') Au.vibe(30); else if (n === 'detach') Au.vibe(70); else if (n === 'level') Au.vibe(20); else if (n === 'dead') Au.vibe(150); else if (n === 'bossWarn') Au.vibe(90);
      if (n === 'bossWarn') Au.setMode('boss'); else if (n === 'bossDie') Au.setMode('play');
    }
    ev.length = 0;
  }
  function frame(now) {
    requestAnimationFrame(frame);
    var raw = (now - last) / 1000, dt = Math.min(0.05, raw); last = now; if (!(dt > 0)) return; time += dt;
    // adaptive resolution: if a weak device averages worse than ~40 fps while playing, lower the render scale
    if (screen === 'play' && G && G.state === 'run') {
      slowT += Math.min(raw, 0.2); slowN++;
      if (slowN >= 90) { if (slowT / slowN > 0.025 && dprMax > 1) { dprMax = Math.max(1, dprMax - 0.25); resize(); } slowT = 0; slowN = 0; }
    }
    Ad.update(dt);
    nb = 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (G && (screen === 'play' || screen === 'pause' || screen === 'over')) {
      if (screen === 'play' && G.state === 'run') {
        var steps = dt > 1 / 30 ? 2 : 1, sd = dt / steps;
        for (var i = 0; i < steps; i++) G.update(sd, joy);
        if (joy.active && joy.has) hintAcc += dt;
        if (!Save.data.hintDone && hintAcc >= 1.8) { Save.data.hintDone = true; Save.save(); }
      }
      if (G.ev.length) drainEvents();
      if (screen === 'play' && (G.state === 'dead' || G.state === 'won')) { endTimer += dt; if (endTimer > 1) showOver(); }
      drawWorld();
      if (screen === 'play') { if (G.state === 'levelup') { luT += dt; drawLevelUp(); } else { luT = 0; drawHud(); } }
      else if (screen === 'pause') { drawHud(); drawPause(); }
      else drawOver();
    } else {
      if (screen === 'menu') drawMenu(); else if (screen === 'shop') drawShop(); else if (screen === 'settings') drawSettings();
      else { screen = 'menu'; }
    }
  }

  function boot() {
    Save.load();
    TS.buildSprites(); SP = TS.Sprites;
    tilePat = ctx.createPattern(SP.tile, 'repeat');
    resize();
    window.addEventListener('resize', resize);
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onCancel);
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) { pauseGame(); Au.setMode('off'); } else { Au.setMode(screen === 'play' || screen === 'pause' ? 'play' : 'menu'); Au.resume(); } });
    Au.setMode('menu');
    if (window.__TS_TEST) window.__TS_TEST.hooks = { startRun: startRun, state: function () { return { screen: screen, G: G }; }, setScreen: function (s) { screen = s; }, frame: frame };
    requestAnimationFrame(frame);
  }
  boot();
})();
