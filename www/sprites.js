// Tail Survivors - all art is drawn with code into small offscreen canvases once at startup.
// During play the game only blits these sprites (cheap draw calls, no gradients per frame).
(function (root) {
  'use strict';
  var TS = root.TS = root.TS || {};
  var D = TS.D, SC = 3; // sprite pixel density (px per world unit)

  function mk(w, h, fn) {
    var c = document.createElement('canvas');
    c.width = Math.ceil(w * SC); c.height = Math.ceil(h * SC);
    var g = c.getContext('2d'); g.scale(SC, SC); g.translate(w / 2, h / 2);
    fn(g); c.uw = w; c.uh = h; return c;
  }
  function ball(g, x, y, r, c1, c2) {
    var gr = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  function eye(g, x, y, r, px) {
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1b1020'; g.beginPath(); g.arc(x + (px || 0), y, r * 0.5, 0, Math.PI * 2); g.fill();
  }
  function flashOf(src) {
    var c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    var g = c.getContext('2d'); g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(0, 0, c.width, c.height);
    c.uw = src.uw; c.uh = src.uh; return c;
  }

  function emblem(g, type, col) {
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.3; g.lineCap = 'round'; g.lineJoin = 'round';
    var k, W = D.W;
    if (type === W.SPIKE) {
      for (k = 0; k < 8; k++) { var a = k * Math.PI / 4; g.beginPath(); g.moveTo(Math.cos(a) * 1.6, Math.sin(a) * 1.6); g.lineTo(Math.cos(a) * 5.2, Math.sin(a) * 5.2); g.stroke(); }
      g.beginPath(); g.arc(0, 0, 1.8, 0, 7); g.fill();
    } else if (type === W.BLASTER) {
      g.fillRect(-1.3, -5.2, 2.6, 6); g.beginPath(); g.arc(0, 2, 2.6, 0, 7); g.fill();
    } else if (type === W.TOXIN) {
      g.beginPath(); g.moveTo(0, -5); g.quadraticCurveTo(4.6, 0.5, 0, 4.4); g.quadraticCurveTo(-4.6, 0.5, 0, -5); g.fill();
    } else if (type === W.AEGIS) {
      g.beginPath(); g.moveTo(-4, -4); g.lineTo(4, -4); g.lineTo(4, 0.5); g.quadraticCurveTo(4, 4, 0, 5.4); g.quadraticCurveTo(-4, 4, -4, 0.5); g.closePath(); g.fill();
    } else if (type === W.ARC) {
      g.beginPath(); g.moveTo(1.5, -5.4); g.lineTo(-3, 0.6); g.lineTo(0, 0.6); g.lineTo(-1.5, 5.4); g.lineTo(3.2, -1); g.lineTo(0.2, -1); g.closePath(); g.fill();
    } else if (type === W.MORTAR) {
      g.beginPath(); g.arc(0, 1, 3.8, 0, 7); g.fill(); g.beginPath(); g.moveTo(1.5, -2.2); g.lineTo(3.4, -4.6); g.stroke();
    }
  }

  var sp = TS.Sprites = { enemy: [], enemyF: [], seg: [], icon: [] };

  TS.buildSprites = function () {
    var E = D.E;
    // ----- enemies -----
    sp.enemy[E.GRUB] = mk(30, 30, function (g) {
      g.strokeStyle = '#7a1f33'; g.lineWidth = 1.6; g.lineCap = 'round';
      for (var s = -1; s <= 1; s += 2) for (var k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(s * 6, k * 4); g.lineTo(s * 11, k * 6 + 1); g.stroke(); }
      ball(g, 0, 0, 9.2, '#ff8b8b', '#c23a52'); eye(g, -3.2, -2, 2.4, 0.6); eye(g, 3.2, -2, 2.4, 0.6);
      g.strokeStyle = '#5b1424'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-5.5, -5); g.lineTo(-1.5, -3.6); g.moveTo(5.5, -5); g.lineTo(1.5, -3.6); g.stroke();
    });
    sp.enemy[E.DASHER] = mk(26, 26, function (g) {
      g.fillStyle = '#ff9f43'; g.beginPath();
      for (var k = 0; k < 12; k++) { var a = k * Math.PI / 6, r = k % 2 ? 5 : 11; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.closePath(); g.fill(); ball(g, 0, 0, 6, '#ffd28a', '#e8741c'); eye(g, -2, -1, 1.8, 0.5); eye(g, 2, -1, 1.8, 0.5);
    });
    sp.enemy[E.BRUTE] = mk(44, 44, function (g) {
      g.fillStyle = '#6c3fb0'; g.beginPath(); g.moveTo(-9, -11); g.lineTo(-13, -19); g.lineTo(-4, -13); g.moveTo(9, -11); g.lineTo(13, -19); g.lineTo(4, -13); g.fill();
      ball(g, 0, 0, 15, '#c08bff', '#5b2ea0'); g.strokeStyle = 'rgba(30,10,60,.5)'; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, 11, 0.3, 2.8); g.stroke();
      eye(g, -5, -3, 3, 0.8); eye(g, 5, -3, 3, 0.8);
      g.strokeStyle = '#2b1050'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(-8.5, -8); g.lineTo(-2.5, -5); g.moveTo(8.5, -8); g.lineTo(2.5, -5); g.stroke();
    });
    sp.enemy[E.SWARM] = mk(16, 16, function (g) { ball(g, 0, 0, 5.4, '#ffb3dc', '#d6559c'); eye(g, 0, -0.5, 2, 0.4); });
    sp.enemy[E.BOSS] = mk(108, 108, function (g) {
      g.fillStyle = '#7d1226';
      for (var k = 0; k < 9; k++) { var a = -Math.PI * 0.95 + k * Math.PI * 0.9 / 8; g.beginPath(); g.moveTo(Math.cos(a - 0.1) * 34, Math.sin(a - 0.1) * 34); g.lineTo(Math.cos(a) * 49, Math.sin(a) * 49); g.lineTo(Math.cos(a + 0.1) * 34, Math.sin(a + 0.1) * 34); g.fill(); }
      ball(g, 0, 0, 36, '#ff6b6b', '#8f1630');
      g.fillStyle = 'rgba(60,5,20,.35)'; g.beginPath(); g.arc(0, 8, 24, 0.2, 2.9); g.fill();
      eye(g, -12, -6, 8, 2); eye(g, 12, -6, 8, 2);
      g.strokeStyle = '#3a0612'; g.lineWidth = 3.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(-23, -18); g.lineTo(-5, -10); g.moveTo(23, -18); g.lineTo(5, -10); g.stroke();
      g.fillStyle = '#3a0612'; g.beginPath(); g.moveTo(-14, 14); for (k = 0; k < 6; k++) g.lineTo(-14 + k * 5.6 + 2.8, k % 2 ? 14 : 20); g.lineTo(14, 14); g.fill();
    });
    for (var k = 0; k < 5; k++) sp.enemyF[k] = flashOf(sp.enemy[k]);

    // ----- snake segments (one per weapon type) + head -----
    for (var t = 0; t < D.WEAPONS.length; t++) {
      (function (t) {
        sp.seg[t] = mk(26, 26, function (g) {
          ball(g, 0, 0, 10.2, '#6cf2b0', '#1f9a63');
          g.fillStyle = '#10281f'; g.beginPath(); g.arc(0, 0, 7.2, 0, 7); g.fill();
          emblem(g, t, D.WEAPONS[t].color);
        });
        sp.icon[t] = mk(40, 40, function (g) {
          g.scale(1.45, 1.45);
          ball(g, 0, 0, 10.2, '#6cf2b0', '#1f9a63');
          g.fillStyle = '#10281f'; g.beginPath(); g.arc(0, 0, 7.2, 0, 7); g.fill();
          emblem(g, t, D.WEAPONS[t].color);
        });
      })(t);
    }
    sp.head = mk(34, 34, function (g) {
      ball(g, 0, 0, 12.4, '#8affc8', '#22a86c');
      g.fillStyle = '#2bbf7a'; g.beginPath(); g.moveTo(9, -5); g.lineTo(15, 0); g.lineTo(9, 5); g.fill();
      eye(g, 4.5, -5, 3.2, 1.1); eye(g, 4.5, 5, 3.2, 1.1);
    });
    sp.crystal = mk(14, 14, function (g) {
      g.fillStyle = '#4de1ff'; g.beginPath(); g.moveTo(0, -5.5); g.lineTo(4, 0); g.lineTo(0, 5.5); g.lineTo(-4, 0); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.moveTo(0, -5.5); g.lineTo(-4, 0); g.lineTo(0, 0); g.closePath(); g.fill();
    });
    sp.food = mk(20, 20, function (g) {
      ball(g, 0, 1, 6.5, '#ffe27a', '#ff9f2e');
      g.fillStyle = '#7bd34a'; g.beginPath(); g.ellipse(2.5, -6, 3.2, 1.6, -0.6, 0, 7); g.fill();
    });
    sp.bullet = mk(10, 10, function (g) { ball(g, 0, 0, 3.4, '#ffffff', '#4dc6ff'); });
    sp.ebullet = mk(12, 12, function (g) { ball(g, 0, 0, 4.2, '#ffd0d0', '#ff3b5c'); });
    sp.coin = mk(20, 20, function (g) { ball(g, 0, 0, 8, '#fff0a0', '#e6a800'); g.strokeStyle = '#b87a00'; g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, 5, 0, 7); g.stroke(); });
    // background tile (one grid cell, 64 world units)
    sp.tile = mk(64, 64, function (g) {
      g.translate(-32, -32);
      g.fillStyle = '#0f1d26'; g.fillRect(0, 0, 64, 64);
      g.fillStyle = 'rgba(255,255,255,0.035)'; g.fillRect(0, 0, 64, 1); g.fillRect(0, 0, 1, 64);
      g.fillStyle = 'rgba(90,255,190,0.05)'; g.beginPath(); g.arc(32, 32, 1.4, 0, 7); g.fill();
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
