// Tail Survivors - AdService
// The ONLY place that knows about ads. Right now it SIMULATES a rewarded video:
//   idle -> (tap) watching: 3 s countdown on the button -> reward -> cooldown 20 s -> idle
// To switch to real AdMob later, keep this public API and replace the internals:
//   AdService.status(placement) -> { state: 'idle' | 'watching' | 'cooldown', t: secondsLeft }
//   AdService.show(placement, onReward) -> true if started
//   AdService.update(dt)             -> called every frame by the UI
// Placements used: 'reroll', 'revive', 'double', 'bonus'.
(function (root) {
  'use strict';
  var TS = root.TS = root.TS || {};
  var WATCH = 3, COOLDOWN = 20;
  var slots = {};

  function slot(p) { return slots[p] || (slots[p] = { state: 'idle', t: 0, cb: null }); }

  TS.AdService = {
    status: function (p) { var s = slot(p); return { state: s.state, t: s.t }; },
    anyWatching: function () { for (var k in slots) if (slots[k].state === 'watching') return true; return false; },
    show: function (p, onReward) {
      var s = slot(p);
      if (s.state !== 'idle') return false;
      s.state = 'watching'; s.t = WATCH; s.cb = onReward;
      return true;
    },
    update: function (dt) {
      for (var k in slots) {
        var s = slots[k];
        if (s.state === 'idle') continue;
        s.t -= dt;
        if (s.t > 0) continue;
        if (s.state === 'watching') {
          var cb = s.cb; s.cb = null;
          s.state = 'cooldown'; s.t = COOLDOWN;
          if (cb) cb();
        } else { s.state = 'idle'; s.t = 0; }
      }
    },
    reset: function (p) { delete slots[p]; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
