// Tail Survivors - static game data (weapons, enemies, upgrades). No DOM here, so tools/sim.js can load it.
(function (root) {
  'use strict';
  var TS = root.TS = root.TS || {};
  var D = TS.D = {};

  D.VIEW_W = 390;        // world units visible across the screen width
  D.ARENA = 2200;        // square arena, world units
  D.RUN_TIME = 600;      // 10 minutes
  D.BOSS_TIMES = [300, 600];
  D.MAX_SEG = 8;
  D.MAX_LVL = 5;
  D.SEG_GAP = 17;
  D.HEAD_R = 11;
  D.SEG_R = 9;

  // weapon type ids (index into D.WEAPONS / T.weapon)
  D.W = { SPIKE: 0, BLASTER: 1, TOXIN: 2, AEGIS: 3, ARC: 4, MORTAR: 5 };
  D.WEAPONS = [
    { id: 'spike',   color: '#ff9f43' },
    { id: 'blaster', color: '#66d9ff' },
    { id: 'toxin',   color: '#9be34a' },
    { id: 'aegis',   color: '#4d8bff' },
    { id: 'arc',     color: '#ffe14d' },
    { id: 'mortar',  color: '#ff5d73' }
  ];

  // Precomputed stats per weapon type and level (1..5): D.WS[type][lvl]
  function stats(fn) { var a = [null]; for (var L = 1; L <= 5; L++) a.push(fn(L)); return a; }
  D.WS = [];
  D.WS[D.W.SPIKE]   = stats(function (L) { return { r: 36 + 5 * L, dmg: 9 + 5 * L, cd: 0.95 - 0.07 * L, kb: 110 }; });
  D.WS[D.W.BLASTER] = stats(function (L) { return { dmg: 8 + 3 * L, cd: 0.62 - 0.06 * L, range: 240, n: L >= 5 ? 3 : (L >= 3 ? 2 : 1), pierce: L >= 4 ? 2 : 0, spd: 360 }; });
  D.WS[D.W.TOXIN]   = stats(function (L) { return { r: 24 + 3 * L, dur: 2.4 + 0.35 * L, dps: 6 + 4 * L, cd: 1.25 - 0.09 * L }; });
  D.WS[D.W.AEGIS]   = stats(function (L) { return { r: 32 + 4 * L, dps: 2 + 2 * L, push: 70 + 10 * L, red: 0.22 + 0.07 * L }; });
  D.WS[D.W.ARC]     = stats(function (L) { return { dmg: 11 + 4 * L, cd: 1.6 - 0.14 * L, range: 170, n: 2 + L, jump: 95 }; });
  D.WS[D.W.MORTAR]  = stats(function (L) { return { dmg: 24 + 11 * L, cd: 2.8 - 0.25 * L, r: 42 + 5 * L, fuse: 0.85 }; });

  // enemies
  D.E = { GRUB: 0, DASHER: 1, BRUTE: 2, SWARM: 3, BOSS: 4 };
  D.ENEMIES = [
    { id: 'grub',   r: 9,  hp: 14, spd: 40, dmg: 7,  xp: 1 },
    { id: 'dasher', r: 7,  hp: 9,  spd: 70, dmg: 5,  xp: 1 },
    { id: 'brute',  r: 14, hp: 60, spd: 27, dmg: 14, xp: 3 },
    { id: 'swarm',  r: 5,  hp: 5,  spd: 58, dmg: 3,  xp: 0.5 },
    { id: 'boss',   r: 34, hp: 1400, spd: 36, dmg: 22, xp: 3 }
  ];
  D.BOSS_HP = [1400, 4200];

  // snakes (MVP ships one; the meta layer picks start segments from here)
  D.SNAKES = [
    { id: 'viper', start: [D.W.BLASTER], cost: 0 }
  ];

  // permanent upgrades bought with coins
  D.PERMS = [
    { id: 'hp',     max: 8, base: 30, grow: 1.5 },
    { id: 'dmg',    max: 8, base: 40, grow: 1.5 },
    { id: 'magnet', max: 8, base: 25, grow: 1.5 },
    { id: 'xp',     max: 8, base: 35, grow: 1.5 },
    { id: 'spd',    max: 8, base: 30, grow: 1.5 }
  ];
  D.permCost = function (def, level) { return Math.round(def.base * Math.pow(def.grow, level) / 5) * 5; };

  D.xpNeed = function (L) { return 4 + 3 * (L - 1) + Math.floor(0.3 * (L - 1) * (L - 1)); };
})(typeof window !== 'undefined' ? window : globalThis);
