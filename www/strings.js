// Tail Survivors - ALL user-facing text lives here (translate this file only).
(function (root) {
  'use strict';
  var TS = root.TS = root.TS || {};

  TS.T = {
    title: 'TAIL SURVIVORS',
    play: 'PLAY',
    upgrades: 'UPGRADES',
    settings: 'SETTINGS',
    back: 'BACK',
    resume: 'RESUME',
    quit: 'QUIT TO MENU',
    paused: 'PAUSED',
    music: 'Music',
    sfx: 'Sound effects',
    vibration: 'Vibration',
    bestScore: 'Best score',
    bestTime: 'Best time',
    time: 'Time',
    kills: 'Kills',
    level: 'Level',
    score: 'Score',
    coins: 'Coins',
    earned: 'Coins earned',
    levelUp: 'LEVEL UP',
    chooseOne: 'Choose one',
    newSegment: 'NEW',
    upgrade: 'UPGRADE',
    swapTitle: 'Swap places',
    swapDesc: 'Slot {a} and slot {b} trade places',
    upTitle: '{name} Lv {to}',
    upDesc: 'Slot {slot} · {text}',
    healTitle: 'Regenerate',
    healDesc: 'Fully heal your whole snake',
    coinsTitle: 'Treasure',
    coinsDesc: '+{n} coins',
    bossIncoming: 'BOSS INCOMING',
    bossDown: 'BOSS DEFEATED',
    gameOver: 'GAME OVER',
    victory: 'VICTORY!',
    playAgain: 'PLAY AGAIN',
    menu: 'MENU',
    newBest: 'NEW BEST!',
    max: 'MAX',
    // rewarded video (AdService placeholder)
    adReroll: 'Reroll choices',
    adRevive: 'Revive',
    adDouble: 'Double coins',
    adBonus: '+{n} coins',
    adWatching: 'Watching... {s}',
    adCooldown: 'Ready in {s}s',
    adGot: 'Reward!',
    weapon: [
      { name: 'Spike',   desc: 'Pulses damage all around it',        up: 'Bigger, faster pulses' },
      { name: 'Blaster', desc: 'Shoots the nearest enemy',           up: 'More damage and more shots' },
      { name: 'Toxin',   desc: 'Leaves poison puddles on the trail', up: 'Bigger, deadlier puddles' },
      { name: 'Aegis',   desc: 'Pushes enemies away, shields neighbors', up: 'Stronger shield and push' },
      { name: 'Arc',     desc: 'Lightning jumps between enemies',    up: 'More jumps, more damage' },
      { name: 'Mortar',  desc: 'Drops bombs that explode',           up: 'Bigger, harder blasts' }
    ],
    perm: {
      hp:     { name: 'Vitality', desc: '+10% max health per level' },
      dmg:    { name: 'Power',    desc: '+6% damage per level' },
      magnet: { name: 'Magnet',   desc: '+15% pickup range per level' },
      xp:     { name: 'Wisdom',   desc: '+8% XP gain per level' },
      spd:    { name: 'Agility',  desc: '+3% speed per level' }
    }
  };

  // tiny template helper: TS.fmt('Hi {x}', {x: 1})
  TS.fmt = function (s, o) {
    return s.replace(/\{(\w+)\}/g, function (m, k) { return o && o[k] !== undefined ? o[k] : m; });
  };
})(typeof window !== 'undefined' ? window : globalThis);
