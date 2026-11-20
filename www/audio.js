// Tail Survivors - sound effects + music, all synthesized with Web Audio (no files, works offline).
// Separate switches for music and effects (Save.data.settings.music / .sfx) plus vibration (.vibe).
(function (root) {
  'use strict';
  var TS = root.TS = root.TS || {};
  var ctx = null, master = null, sfxBus = null, musBus = null, noiseBuf = null;
  var mode = 'off', timer = null, nextT = 0, step = 0, voices = 0;
  var lastPlay = {};
  var MIN_GAP = { shoot: 0.07, hit: 0.05, kill: 0.04, crystal: 0.04, spike: 0.1, zap: 0.1, toxin: 0.15, mortar: 0.15, boom: 0.08, hurtSeg: 0.1 };

  function S() { return (TS.Save && TS.Save.data.settings) || { music: true, sfx: true, vibe: true }; }
  var midi = function (n) { return 440 * Math.pow(2, (n - 69) / 12); };

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    musBus = ctx.createGain(); musBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    apply();
    if (mode !== 'off') startMusic();
    return true;
  }
  function apply() {
    if (!ctx) return;
    sfxBus.gain.value = S().sfx ? 1 : 0;
    musBus.gain.value = S().music ? 0.5 : 0;
  }

  // ---------- synth primitives ----------
  function tone(type, f0, f1, dur, gain, t, dest) {
    t = t === undefined ? ctx.currentTime : t;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || sfxBus); o.start(t); o.stop(t + dur + 0.03);
    voices++; o.onended = function () { voices--; };
  }
  function noise(dur, gain, f0, f1, t, dest) {
    t = t === undefined ? ctx.currentTime : t;
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.setValueAtTime(f0, t); f.Q.value = 0.9;
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || sfxBus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
    voices++; s.onended = function () { voices--; };
  }

  var SFX = {
    shoot:   function () { tone('square', 720, 300, 0.07, 0.05); },
    hit:     function () { tone('triangle', 260, 120, 0.05, 0.06); },
    kill:    function () { tone('sine', 520 + Math.random() * 120, 160, 0.09, 0.08); },
    crystal: function () { tone('sine', 880 + Math.random() * 200, 1320, 0.08, 0.05); },
    eat:     function () { tone('sine', 400, 800, 0.12, 0.09); tone('sine', 600, 1000, 0.1, 0.06, ctx.currentTime + 0.07); },
    spike:   function () { noise(0.12, 0.12, 2400, 600); tone('sawtooth', 200, 90, 0.1, 0.05); },
    zap:     function () { tone('sawtooth', 1600, 200, 0.12, 0.05); noise(0.1, 0.08, 4000, 1200); },
    toxin:   function () { tone('sine', 220, 110, 0.18, 0.05); noise(0.14, 0.05, 900, 400); },
    mortar:  function () { tone('triangle', 300, 600, 0.1, 0.05); },
    boom:    function () { noise(0.3, 0.2, 700, 90); tone('sine', 140, 40, 0.28, 0.16); },
    hurt:    function () { tone('sawtooth', 220, 70, 0.22, 0.14); noise(0.12, 0.08, 500, 200); },
    hurtSeg: function () { tone('square', 180, 100, 0.08, 0.06); },
    detach:  function () { tone('sawtooth', 300, 60, 0.35, 0.14); noise(0.25, 0.14, 1200, 200); },
    level:   function () { var t = ctx.currentTime; [523, 659, 784, 1047].forEach(function (f, i) { tone('triangle', f, 0, 0.18, 0.12, t + i * 0.07); }); },
    pick:    function () { tone('sine', 660, 990, 0.12, 0.1); },
    swap:    function () { tone('sine', 500, 900, 0.1, 0.08); tone('sine', 900, 500, 0.1, 0.08, ctx.currentTime + 0.09); },
    click:   function () { tone('triangle', 520, 380, 0.05, 0.08); },
    bossWarn: function () { var t = ctx.currentTime; for (var i = 0; i < 3; i++) tone('sawtooth', 140, 120, 0.22, 0.14, t + i * 0.3); },
    bossShot: function () { tone('square', 500, 250, 0.15, 0.06); },
    bossDie: function () { noise(0.6, 0.25, 900, 70); tone('sine', 220, 40, 0.6, 0.2); },
    dead:    function () { var t = ctx.currentTime; [392, 330, 262, 196].forEach(function (f, i) { tone('triangle', f, f * 0.97, 0.3, 0.14, t + i * 0.18); }); },
    win:     function () { var t = ctx.currentTime; [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone('triangle', f, 0, 0.3, 0.14, t + i * 0.1); }); },
    reward:  function () { var t = ctx.currentTime; [784, 988, 1175].forEach(function (f, i) { tone('sine', f, 0, 0.16, 0.12, t + i * 0.08); }); }
  };

  // ---------- music: simple looping arpeggio + bass (+ drums in play/boss) ----------
  var CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  var ARP = [0, 1, 2, 1, 0, 2, 1, 2];
  function bpmFor() { return mode === 'boss' ? 138 : (mode === 'play' ? 116 : 84); }
  function schedule() {
    if (!ctx || mode === 'off') return;
    while (nextT < ctx.currentTime + 0.35) {
      var bar = Math.floor(step / 8) % 4, k = step % 8, ch = CHORDS[bar], t = nextT, spb = 60 / bpmFor() / 2;
      if (mode === 'boss' && bar % 2) ch = [ch[0] - 2, ch[1] - 2, ch[2] - 2];
      tone('triangle', midi(ch[ARP[k]] + 12), 0, spb * 1.6, 0.05, t, musBus);
      if (k === 0 || k === 4) tone('sine', midi(ch[0] - 12), 0, spb * 3, 0.16, t, musBus);
      if (mode !== 'menu') {
        if (k === 0 || k === 4) tone('sine', 130, 45, 0.12, 0.2, t, musBus);
        if (k % 2) noise(0.04, 0.05, 7000, 7000, t, musBus);
        if (mode === 'boss' && k === 6) tone('sawtooth', midi(ch[0]), 0, spb, 0.03, t, musBus);
      }
      nextT += spb; step++;
    }
  }
  function startMusic() {
    if (!ctx || timer) return;
    nextT = ctx.currentTime + 0.05; step = 0;
    timer = setInterval(schedule, 90);
  }
  function stopMusic() { if (timer) { clearInterval(timer); timer = null; } }

  TS.Audio = {
    init: init,
    apply: apply,
    resume: function () { if (ctx && ctx.state === 'suspended') ctx.resume(); },
    sfx: function (name) {
      if (!ctx || !S().sfx || voices > 14) return;
      var f = SFX[name]; if (!f) return;
      var now = ctx.currentTime, gap = MIN_GAP[name] || 0;
      if (gap && lastPlay[name] && now - lastPlay[name] < gap) return;
      lastPlay[name] = now;
      try { f(); } catch (e) { /* ignore */ }
    },
    setMode: function (m) {
      if (m === mode) return;
      mode = m;
      if (m === 'off') stopMusic(); else if (ctx) { startMusic(); }
    },
    vibe: function (ms) {
      if (!S().vibe) return;
      try { if (root.navigator && root.navigator.vibrate) root.navigator.vibrate(ms); } catch (e) { /* ignore */ }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
