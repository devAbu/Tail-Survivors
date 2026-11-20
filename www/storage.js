// Tail Survivors - local save (coins, best results, settings, permanent upgrades, hint flags)
(function (root) {
  'use strict';
  var TS = root.TS = root.TS || {};
  var KEY = 'ts_save_v1';

  function defaults() {
    return {
      coins: 0,
      bestScore: 0,
      bestTime: 0,
      bestLevel: 1,
      runs: 0,
      perm: { hp: 0, dmg: 0, magnet: 0, xp: 0, spd: 0 },
      snake: 'viper',
      snakes: ['viper'],
      settings: { music: true, sfx: true, vibe: true },
      hintDone: false,
      lvlHintDone: false
    };
  }

  function merge(base, src) {
    for (var k in src) {
      if (!Object.prototype.hasOwnProperty.call(src, k) || !(k in base)) continue;
      if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) merge(base[k], src[k] || {});
      else base[k] = src[k];
    }
    return base;
  }

  var Save = TS.Save = {
    data: defaults(),
    load: function () {
      try {
        var raw = root.localStorage && root.localStorage.getItem(KEY);
        if (raw) Save.data = merge(defaults(), JSON.parse(raw));
      } catch (e) { Save.data = defaults(); }
      return Save.data;
    },
    save: function () {
      try { root.localStorage && root.localStorage.setItem(KEY, JSON.stringify(Save.data)); } catch (e) { /* ignore */ }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
