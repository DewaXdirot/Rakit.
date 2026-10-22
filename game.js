'use strict';
// ====== Dasar ======
const cv = document.getElementById('game'), c = cv.getContext('2d');
const W = 480, H = 760, BY = 560, PX = 25, MAXHP = 175, GOAL = 222222, DAY = 200; // GOAL = meter menang per wilayah, DAY = detik 1 siklus hari
cv.width = W; cv.height = H;
const $ = id => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mod = (v, m) => ((v % m) + m) % m;
const lerp = (a, b, t) => a + (b - a) * t;

const EV = {
  river: [{ m: 120, t: 'storm', len: 220 }, { m: 380, t: 'current', len: 200 }, { m: 560, t: 'boss' }, { m: 760, t: 'climb' },
    { m: 900, t: 'boss' }, { m: 1050, t: 'drop' }, { m: 1200, t: 'boss' }],
  sea: [{ m: 120, t: 'storm', len: 240 }, { m: 350, t: 'current', len: 220 }, { m: 520, t: 'boss' }, { m: 800, t: 'storm', len: 240 },
    { m: 950, t: 'boss' }, { m: 1150, t: 'current', len: 220 }, { m: 1300, t: 'boss' }]
};
const LAPS = { river: 1400, sea: 1500 };
const BOSSES = {
  river: [{ n: 'Ikan Predator', s: 'fish', c: '#2d6a6e', d: '#1f4d51', l: '#a7d6c9' },
    { n: 'Buaya Raksasa', s: 'croc', c: '#3f6b2a', d: '#2a4a1c', l: '#b7c98a' },
    { n: 'Kuda Nil Murka', s: 'hippo', c: '#7a6a7d', d: '#574b5a', l: '#c9b8c4' }],
  sea: [{ n: 'Hiu Raksasa', s: 'shark', c: '#5b7388', d: '#3c4f60', l: '#e8eef2' },
    { n: 'Gurita Raksasa', s: 'octo', c: '#a8435a', d: '#7a2c40', l: '#e6a3b3' },
    { n: 'Paus Pembunuh', s: 'orca', c: '#1c2733', d: '#0f171f', l: '#f2f2f2' }]
};
let S, last = 0, pend = false, slot = 0, L = { h: 1, night: 0, warm: 0, glare: 0, sx: 240, sy: 60, day: true, dusk: 0 };
const sea = () => S.region === 'sea';
const bankL = wy => sea() ? 22 : 55 + 28 * Math.sin(wy / 230);
const bankR = wy => sea() ? W - 22 : W - 55 - 28 * Math.cos(wy / 270);
const keys = {}, joy = { x: 0, y: 0, id: null };

// ====== Suara & Musik (sintesis WebAudio, tanpa file) ======
let AC = null, muted = false;
const M = {}, MV = .5, mus = { step: 0, next: 0, mood: '', mi: 7 };
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const pn = x => clamp((x - W / 2) / (W / 2), -1, 1);
function audio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); initAudio(); } catch (e) { AC = null; return null; } }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function loopN(ft, f, q, white) {
  const a = AC, n = a.sampleRate * 2, b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0); let l = 0;
  for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; l = (l + .02 * w) / 1.02; d[i] = white ? w : l * 3.5; }
  const s = a.createBufferSource(), f1 = a.createBiquadFilter(), g = a.createGain();
  s.buffer = b; s.loop = true; f1.type = ft; f1.frequency.value = f; f1.Q.value = q || 1; g.gain.value = 0;
  s.connect(f1); f1.connect(g); g.connect(M.master); s.start(); return { g, f: f1 };
}
function initAudio() {
  const a = AC;
  M.out = a.createDynamicsCompressor(); M.master = a.createGain(); M.master.gain.value = muted ? 0 : .9; M.master.connect(M.out); M.out.connect(a.destination);
  M.sfx = a.createGain(); M.sfx.connect(M.master);
  M.mus = a.createGain(); M.mus.gain.value = MV; M.musF = a.createBiquadFilter(); M.musF.frequency.value = 5000; M.mus.connect(M.musF); M.musF.connect(M.master);
  const n = a.sampleRate * 1.8, ib = a.createBuffer(2, n, a.sampleRate); // reverb
  for (let ch = 0; ch < 2; ch++) { const d = ib.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
  M.rev = a.createConvolver(); M.rev.buffer = ib; M.revIn = a.createGain(); M.revIn.connect(M.rev); M.rev.connect(M.master);
  const d = a.createDelay(1); d.delayTime.value = .34; const fb = a.createGain(); fb.gain.value = .36; d.connect(fb); fb.connect(d); // echo melodi
  const dw = a.createGain(); dw.gain.value = .4; d.connect(dw); dw.connect(M.mus); M.dIn = a.createGain(); M.dIn.connect(d);
  M.water = loopN('lowpass', 700); M.wind = loopN('bandpass', 500, .7, 1); M.rain = loopN('highpass', 3500, .5, 1); M.fall = loopN('lowpass', 900);
}
function route(n, pan = 0, send = .25) {
  const a = AC; let o = n;
  if (pan) { const p = a.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); n.connect(p); o = p; }
  o.connect(M.sfx); if (send) { const s = a.createGain(); s.gain.value = send; o.connect(s); s.connect(M.revIn); }
}
function tone(f1, f2, d, type, v, delay = 0, pan = 0, send = .25) {
  const a = audio(); if (!a || muted) return;
  const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + d);
  g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(v, t + .008); g.gain.exponentialRampToValueAtTime(.001, t + d);
  o.connect(g); route(g, pan, send); o.start(t); o.stop(t + d + .02);
}
function noise(d, v, fc, o = {}) {
  const a = audio(); if (!a || muted) return;
  const n = Math.floor(a.sampleRate * d), buf = a.createBuffer(1, n, a.sampleRate), data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  const t = a.currentTime + (o.delay || 0), s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = buf; f.type = o.ft || 'lowpass'; f.Q.value = o.q || 1; f.frequency.setValueAtTime(fc, t); if (o.fc2) f.frequency.exponentialRampToValueAtTime(o.fc2, t + d);
  g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(v, t + (o.soft ? d * .25 : .006)); g.gain.exponentialRampToValueAtTime(.001, t + d);
  s.connect(f); f.connect(g); route(g, o.pan || 0, o.send === undefined ? .15 : o.send); s.start(t);
}
function duck(r = .6) { if (!AC || !M.mus) return; const g = M.mus.gain, t = AC.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(MV * .3, t); g.linearRampToValueAtTime(MV, t + r); }

const chirp = () => { const p = rnd(-1, 1), f = rnd(2200, 3800); for (let i = 0, n = 2 + (Math.random() * 3 | 0); i < n; i++) tone(f * rnd(.9, 1.15), f * rnd(1.1, 1.5), .07, 'sine', .02, i * .09, p, .3); };
const cricket = () => { const p = rnd(-1, 1); for (let i = 0; i < 3; i++) tone(4300, 4500, .03, 'sine', .008, i * .05, p, .2); };
const gull = () => { const p = rnd(-1, 1); tone(1400, 2200, .3, 'triangle', .02, 0, p, .5); tone(2200, 1300, .4, 'triangle', .02, .28, p, .5); };
const ROAR = { fish: [140, 60], croc: [80, 45], hippo: [110, 70], shark: [200, 50], octo: [70, 110], orca: [300, 150] };
const sfx = {
  click() { tone(700, 500, .05, 'triangle', .1); },
  row() { // dayungan lembut: desir air + kayu berderit + tetesan acak
    noise(.5, .07, 300, { soft: 1, fc2: 700 }); noise(.25, .05, 1800, { ft: 'bandpass', q: .8, fc2: 900, soft: 1 });
    tone(rnd(90, 120), 60, .2, 'sine', .03); tone(rnd(160, 220), rnd(120, 160), .12, 'sawtooth', .01, .05);
    tone(rnd(900, 1400), rnd(400, 600), .08, 'sine', .02, .18 + rnd(0, .1), rnd(-.4, .4), .4);
  },
  spear() { noise(.2, .1, 500, { ft: 'bandpass', q: 2, fc2: 3500 }); },
  hit(k, x = W / 2) {
    const p = pn(x);
    if (k === 'branch' || k === 'log' || k === 'wood') { noise(.1, .3, 1300, { ft: 'bandpass', q: 3, pan: p }); tone(190, 70, .18, 'triangle', .3, 0, p); tone(95, 50, .3, 'sine', .25, 0, p); }
    else if (k === 'fish') { noise(.22, .2, 1800, { ft: 'bandpass', fc2: 400, pan: p }); tone(520, 200, .1, 'sine', .12, 0, p); }
    else if (k === 'zap') { tone(1400, 150, .3, 'sawtooth', .1, 0, p); noise(.2, .15, 3000, { ft: 'highpass', pan: p }); }
    else { noise(.1, .28, 2500, { ft: 'highpass', pan: p }); tone(130, 45, .28, 'sine', .3, 0, p); tone(950, 320, .05, 'square', .08, 0, p); }
  },
  bite() { tone(110, 35, .5, 'sawtooth', .3); noise(.35, .35, 500); noise(.15, .3, 3000, { ft: 'highpass' }); tone(300, 60, .15, 'square', .15); },
  roar(s = 'fish') {
    const m = ROAR[s] || ROAR.fish; tone(m[0], m[1], 1, 'sawtooth', .18); tone(m[0] * 1.5, m[1] * 1.5, 1, 'sine', .1, .05); noise(.8, .15, 400, { soft: 1 });
    if (s === 'orca') { tone(600, 900, .8, 'sine', .08, .2, 0, .6); tone(900, 500, .8, 'sine', .08, .7, 0, .6); }
  },
  whack(x = W / 2) { const p = pn(x); tone(300, 90, .12, 'square', .13, 0, p); tone(rnd(700, 900), 500, .15, 'triangle', .08, .02, p, .4); noise(.1, .2, 1500, { ft: 'bandpass', pan: p }); },
  warn() { for (let i = 0; i < 2; i++) tone(880, 880, .12, 'square', .07, i * .2); },
  pick(x = W / 2) { [72, 76, 79, 84].forEach((n, i) => tone(mtof(n), mtof(n), .18, 'sine', .12, i * .07, pn(x), .4)); },
  loot() { [67, 72, 76, 79, 84, 88].forEach((n, i) => tone(mtof(n), mtof(n), .25, 'triangle', .12, i * .08, 0, .5)); noise(.5, .06, 6000, { ft: 'highpass', delay: .2 }); },
  thunder() { noise(.15, .4, 5000, { ft: 'highpass' }); noise(2.4, .5, 180, { soft: 1, delay: .1 }); tone(60, 35, 2, 'sine', .25, .1); },
  splash() { noise(.6, .3, 2500, { ft: 'bandpass', q: .7, fc2: 600 }); },
  shatter() {
    for (let i = 0; i < 6; i++) noise(.12, .3, 1500, { ft: 'bandpass', q: 2, delay: i * .07, pan: rnd(-.6, .6) });
    tone(90, 30, .9, 'sawtooth', .3); tone(60, 25, 1, 'sine', .35); noise(.9, .3, 1500, { fc2: 300, delay: .2 });
  },
  win() { [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone(mtof(n), mtof(n), .3, 'triangle', .14, i * .11, 0, .4)); },
  bossDown() { tone(100, 30, .8, 'sine', .35); [64, 68, 71, 76, 80].forEach((n, i) => tone(mtof(n), mtof(n), .3, 'triangle', .14, .15 + i * .1, 0, .5)); },
  over() { [64, 62, 60, 55, 52].forEach((n, i) => tone(mtof(n), mtof(n) * .98, .5, 'triangle', .18, i * .3, 0, .6)); },
  power(p, x = W / 2) {
    const q = pn(x);
    if (p === 'boost') { noise(.9, .22, 400, { ft: 'bandpass', q: 1.5, fc2: 4500, soft: 1, pan: q }); [64, 71, 76, 83].forEach((n, i) => tone(mtof(n), mtof(n), .2, 'sawtooth', .07, i * .06, q, .4)); }
    else if (p === 'shield') { [79, 84, 88, 91].forEach((n, i) => tone(mtof(n), mtof(n), .6, 'sine', .1, i * .08, q, .7)); noise(.5, .06, 6000, { ft: 'highpass', pan: q }); }
    else if (p === 'fury') { tone(70, 180, .5, 'sawtooth', .2, 0, q); noise(.6, .2, 2500, { ft: 'highpass', soft: 1, pan: q }); [57, 64, 69].forEach((n, i) => tone(mtof(n), mtof(n), .5, 'square', .06, i * .05, q)); }
    else sfx.pick(x);
  },
  shieldBreak() { noise(.35, .3, 4000, { ft: 'highpass' }); [96, 91, 84, 79].forEach((n, i) => tone(mtof(n), mtof(n) * .9, .25, 'triangle', .1, i * .04, 0, .6)); },
  region() { noise(1.5, .25, 300, { soft: 1, fc2: 1800 }); [57, 64, 69, 76].forEach((n, i) => tone(mtof(n), mtof(n), .8, 'sine', .12, i * .2, 0, .6)); }
};
$('mute').addEventListener('click', e => { muted = !muted; e.currentTarget.textContent = muted ? '🔇' : '🔊'; e.currentTarget.blur(); audio(); if (M.master) M.master.gain.value = muted ? 0 : .9; });

// ====== Musik prosedural (berubah sesuai situasi) ======
const MOODS = {
  menu: { bpm: 72, root: 55, sc: [0, 2, 4, 7, 9], prog: [0, 3, 0, 4], pad: 1, mel: .3, perc: 0, wave: 'sine' },
  day: { bpm: 84, root: 57, sc: [0, 2, 4, 7, 9], prog: [0, 3, 4, 2], pad: 1, mel: .5, perc: 1, wave: 'triangle' },
  night: { bpm: 66, root: 52, sc: [0, 3, 5, 7, 10], prog: [0, 2, 3, 2], pad: 1, mel: .28, perc: 0, wave: 'sine' },
  sea: { bpm: 76, root: 55, sc: [0, 2, 4, 7, 9], prog: [0, 4, 3, 4], pad: 1, mel: .4, perc: 1, wave: 'sine' },
  boss: { bpm: 132, root: 45, sc: [0, 1, 3, 5, 7, 8, 10], prog: [0, 0, 5, 4], pad: 0, mel: .35, perc: 3, wave: 'square' },
  fall: { bpm: 120, root: 50, sc: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 3, 4], pad: 0, mel: .7, perc: 2, wave: 'square' }
};
const noteOf = (P, d) => P.root + 12 * Math.floor(d / P.sc.length) + P.sc[mod(d, P.sc.length)];
function mt(f1, f2, d, type, v, t, dly = 0) {
  const a = AC, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f1, t); if (f2 !== f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + d);
  g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(v, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + d);
  o.connect(g); g.connect(M.mus); if (dly) { const s = a.createGain(); s.gain.value = dly; g.connect(s); s.connect(M.dIn); } o.start(t); o.stop(t + d + .02);
}
function mn(d, v, fc, t, ft = 'highpass') {
  const a = AC, n = Math.floor(a.sampleRate * d), b = a.createBuffer(1, n, a.sampleRate), dd = b.getChannelData(0);
  for (let i = 0; i < n; i++) dd[i] = Math.random() * 2 - 1;
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); s.buffer = b; f.type = ft; f.frequency.value = fc;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d); s.connect(f); f.connect(g); g.connect(M.mus); s.start(t);
}
function pad(f, d, v, t) {
  const a = AC, o = a.createOscillator(), g = a.createGain(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = rnd(-6, 6);
  g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(v, t + d * .4); g.gain.linearRampToValueAtTime(.0001, t + d); o.connect(g); g.connect(M.mus); o.start(t); o.stop(t + d + .05);
}
function pickMood() {
  if (!S.started || S.over) return 'menu';
  if (S.dying > 0) return null;
  if (S.boss) return 'boss'; if (S.mode !== 'river') return 'fall';
  if (L.night > .5) return 'night'; return sea() ? 'sea' : 'day';
}
function playStep(P, st, t, sd) {
  const s = st % 16, bar = Math.floor(st / 16), deg = P.prog[bar % P.prog.length], hot = P.perc === 3 && S.boss && S.boss.hp < S.boss.max * .35;
  if (s === 0 && P.pad) for (const k of [0, 2, 4]) pad(mtof(noteOf(P, deg + k)), sd * 16, .035, t);
  const be = P.perc >= 2 ? 2 : 8, bf = mtof(noteOf(P, deg) - 12);
  if (s % be === 0) mt(bf, bf, sd * (be > 2 ? 6 : 1.6), P.perc >= 2 ? 'sawtooth' : 'sine', P.perc >= 2 ? .05 : .1, t);
  if (P.perc === 1) { if (s === 4 || s === 12) mt(900, 700, .05, 'triangle', .05, t); if (s % 4 === 2) mn(.05, .03, 6000, t); }
  if (P.perc >= 2) {
    if (s % 4 === 0 || (P.perc === 3 && s === 10)) mt(150, 40, .16, 'sine', .22, t);
    if (P.perc === 3 && (s === 4 || s === 12)) { mn(.14, .12, 1800, t); mt(220, 120, .08, 'triangle', .1, t); }
    if (s % 2 === 0 || hot) mn(.04, .035, 7000, t);
  }
  if (S.started && !S.over && S.hp < MAXHP * .3 && s % 8 === 0) { mt(70, 40, .14, 'sine', .3, t); mt(60, 35, .14, 'sine', .22, t + sd * 1.5); } // detak jantung HP rendah
  if (Math.random() < P.mel * (s % 2 ? .22 : .7)) {
    const len = P.sc.length;
    if (s === 0) mus.mi = deg + [0, 2, 4][Math.random() * 3 | 0] + len;
    else mus.mi += [-2, -1, -1, 0, 1, 1, 2][Math.random() * 7 | 0];
    mus.mi = clamp(mus.mi, len - 1, len * 2 + 3);
    const f = mtof(noteOf(P, mus.mi)); mt(f, f, sd * (s % 2 ? 2 : 4), P.wave, P.wave === 'sine' ? .07 : .035, t, .5);
  }
}
function musicTick() {
  const a = AC; if (!a || muted) return;
  const mood = pickMood();
  if (!mood) { mus.next = a.currentTime; mus.mood = ''; return; }
  const P = MOODS[mood];
  if (mus.mood !== mood) { mus.mood = mood; mus.step = 0; if (mus.next < a.currentTime) mus.next = a.currentTime + .05; }
  if (mus.next < a.currentTime - .3) mus.next = a.currentTime;
  const sd = 60 / P.bpm / 4;
  while (mus.next < a.currentTime + .2) { playStep(P, mus.step, mus.next, sd); mus.next += sd; mus.step++; }
}
function ambience(dt) { // suara latar yang bereaksi pada kecepatan, cuaca, waktu, wilayah
  const a = AC; if (!a || !M.water) return;
  const t = a.currentTime, run = S.started && !S.over, fall = run && S.mode !== 'river', sp = run ? S.speed / 170 : 0, st = run ? S.storm : 0;
  M.water.g.gain.setTargetAtTime(fall ? .03 : (sea() ? .08 + .04 * Math.sin(S.t * .6) : .05) + sp * .14, t, .25); M.water.f.frequency.setTargetAtTime(500 + sp * 900, t, .3);
  M.wind.g.gain.setTargetAtTime(.02 + st * .12 + (sea() ? .03 : 0) + (fall ? .08 : 0), t, .4); M.wind.f.frequency.setTargetAtTime(600 + Math.sin(S.t * .9) * 200 * st, t, .3);
  M.rain.g.gain.setTargetAtTime(st * .06, t, .4);
  M.fall.g.gain.setTargetAtTime(fall ? (S.mode === 'drop' ? .1 + S.vy / 560 * .25 : .25) : 0, t, .2); M.fall.f.frequency.setTargetAtTime(500 + (S.mode === 'drop' ? S.vy * 2.5 : 400), t, .2);
  M.musF.frequency.setTargetAtTime(S.dying > 0 ? 300 : run && S.hp < MAXHP * .3 ? 1500 : 5000 - st * 2200, t, .4);
  if (!run || S.dying > 0 || S.mode !== 'river') return;
  const day = L.day && L.h > .05;
  if (!sea()) {
    if (day && Math.random() < dt * (.5 + 1.5 * L.warm)) chirp(); // burung, ramai di pagi hari
    if (!day && L.night > .3) { if (Math.random() < dt * 4) cricket(); if (Math.random() < dt * .25) tone(rnd(160, 240), rnd(90, 130), .1, 'square', .015, 0, rnd(-1, 1), .4); }
  } else {
    if (day && Math.random() < dt * .12) gull();
    if (!day && Math.random() < dt * .1) tone(rnd(200, 260), rnd(300, 420), 1.4, 'sine', .02, 0, rnd(-1, 1), .8);
  }
}

// ====== Input ======
const stick = $('stick'), knob = $('knob'), btn = $('dayung');
function moveJoy(e) {
  const r = stick.getBoundingClientRect(), max = r.width / 2 - 6;
  let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const l = Math.hypot(dx, dy);
  if (l > max) { dx = dx / l * max; dy = dy / l * max; }
  joy.x = Math.abs(dx / max) < .12 ? 0 : dx / max;
  joy.y = Math.abs(dy / max) < .12 ? 0 : dy / max;
  knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}
function endJoy(e) { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; knob.style.transform = 'translate(-50%,-50%)'; }
stick.addEventListener('pointerdown', e => { joy.id = e.pointerId; stick.setPointerCapture(e.pointerId); moveJoy(e); });
stick.addEventListener('pointermove', e => { if (e.pointerId === joy.id) moveJoy(e); });
stick.addEventListener('pointerup', endJoy); stick.addEventListener('pointercancel', endJoy);
function hit() { audio(); if (S.started && !S.over && !S.dying) pend = true; }
btn.addEventListener('pointerdown', e => { e.preventDefault(); btn.classList.add('down'); hit(); });
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, () => btn.classList.remove('down')));
addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code === 'Space') { if (!S.started || S.over) startGame(); else hit(); }
});
addEventListener('keyup', e => { keys[e.code] = false; });
function inp() {
  if (joy.id !== null) return joy;
  return { x: (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0), y: (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0) };
}

// ====== Save (3 slot) ======
const key = i => 'dayung_slot' + i;
const loadSlot = i => { try { return JSON.parse(localStorage.getItem(key(i))); } catch (e) { return null; } };
function save() {
  try { localStorage.setItem(key(slot), JSON.stringify({ region: S.region, hp: S.hp, dist: S.dist, bonus: S.bonus, evi: S.evi, bn: S.bn, clock: S.clock })); } catch (e) { }
}
function slots() {
  const el = $('slots'); el.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const d = loadSlot(i), r = document.createElement('div'), b = document.createElement('button');
    r.className = 'slot';
    b.textContent = d ? `Slot ${i + 1} • ${d.region === 'sea' ? 'Laut' : 'Sungai'} ${Math.floor(d.dist)} m • HP ${Math.ceil(d.hp)}` : `Slot ${i + 1} • Kosong (main baru)`;
    b.onclick = () => { audio(); sfx.click(); startGame(i); }; r.appendChild(b);
    if (d) { const x = document.createElement('button'); x.textContent = '✕'; x.className = 'del'; x.title = 'Hapus'; x.onclick = () => { sfx.click(); localStorage.removeItem(key(i)); slots(); }; r.appendChild(x); }
    el.appendChild(r);
  }
}
$('saveQuit').addEventListener('click', e => {
  e.currentTarget.blur();
  if (!S.started || S.over || S.dying) return;
  save(); S.started = false; showOv('Tersimpan', `Progres disimpan di slot ${slot + 1}.`);
});

// ====== State ======
function reset() {
  S = {
    mode: 'river', region: 'river', started: false, over: false, hp: MAXHP, dist: 0, scroll: 0, speed: 0,
    bx: W / 2, rot: 0, oar: 0, inv: 0, shake: 0, t: 0, p: false, bonus: 0, clock: .04, dying: 0, boost: 0, shield: 0, fury: 0, pieces: [], hitF: 0, bn: 0,
    obs: [], spawn: 100, evi: 0, stormEnd: -1, curEnd: -1, storm: 0, cur: 15, boss: null,
    msg: '', msgT: 0, flash: 0, flow: 0, warned: false,
    rain: Array.from({ length: 130 }, () => ({ x: rnd(0, W), y: rnd(0, H), v: rnd(500, 800) })),
    h: 0, deb: [], dsp: 0, fp: 0, vy: 0, wfo: 0, vx: 0, netS: 0, push: 0, bk: 0, hv: 0
  };
}
const diff = () => 1 + Math.floor(S.evi / EV[S.region].length) * .35 + (sea() ? .25 : 0);
const say = (m, t = 2.6) => { S.msg = m; S.msgT = t; };
function showOv(title, text) { $('ovTitle').textContent = title; $('ovText').innerHTML = text; slots(); $('overlay').style.display = 'flex'; $('saveQuit').style.display = 'none'; }
function startGame(i) {
  audio(); if (i !== undefined) slot = i; reset();
  const d = loadSlot(slot);
  if (d) Object.assign(S, { region: d.region, hp: d.hp, dist: d.dist, scroll: d.dist * PX, bonus: d.bonus, evi: d.evi, bn: d.bn, clock: d.clock });
  S.started = true; $('overlay').style.display = 'none'; $('saveQuit').style.display = 'block';
}
function gameOver() { S.over = true; sfx.over(); showOv('Rakit hancur', `Jarak: <b>${Math.floor(S.dist)} m</b><br>Skor: <b>${Math.floor(S.dist) + S.bonus}</b>`); }
function damage(d) {
  S.hp -= d; S.shake = Math.min(.7, .2 + d / 80); S.hitF = 1; duck(d >= 40 ? .9 : .5);
  try { navigator.vibrate && navigator.vibrate(Math.round(d * 4)); } catch (e) { }
  if (S.hp <= 0) { S.hp = 0; shatter(); }
}
function hurt(d, inv = .7, kind = 'rock', x = S.bx) { if (S.inv > 0 || S.dying > 0) return false;
  if (S.shield > 0) { S.shield--; S.inv = Math.max(inv, .8); S.shake = .25; sfx.shieldBreak(); say(S.shield ? `🛡 Perisai menahan! sisa ${S.shield}` : '🛡 Perisai pecah!', 1.6); return true; }
  S.inv = inv; damage(d); if (kind === 'bite') sfx.bite(); else sfx.hit(kind, x); return true; }
function shatter() {
  S.dying = 2; S.speed = 0; sfx.shatter(); duck(3); S.shake = .8; S.boss && (S.boss.st = 'recover');
  for (let i = 0; i < 16; i++) {
    const lg = i < 5, a = rnd(0, 6.28), v = rnd(60, 220);
    S.pieces.push({ x: S.bx + (lg ? (i - 2) * 9 : rnd(-20, 20)), y: BY + rnd(-25, 25), vx: Math.cos(a) * v + (lg ? (i - 2) * 40 : 0), vy: Math.sin(a) * v, r: rnd(0, 6), vr: rnd(-7, 7), w: lg ? 9 : rnd(3, 6), h: lg ? rnd(28, 60) : rnd(8, 20), lg });
  }
}
function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy, t = l ? clamp(((px - x1) * dx + (py - y1) * dy) / l, 0, 1) : 0;
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// ====== Rintangan & boss ======
function spawnObs() {
  const wy = S.scroll + BY + 70, Lx = bankL(wy) + 60, Rx = bankR(wy) - 60, x = rnd(Lx, Rx), r = Math.random(), sc = sea();
  if (r < .3) S.obs.push({ k: 'rock', x, wy, len: 0, r: rnd(18, 30), a: 0, d: 25 });
  else if (r < .5) S.obs.push({ k: 'branch', x, wy, len: sc ? rnd(60, 90) : rnd(100, 150), r: 6, a: Math.PI / 2 + rnd(-.8, .8), d: 25 });
  else if (r < .72) S.obs.push({ k: 'log', x, wy, len: sc ? rnd(36, 48) : rnd(90, 120), r: sc ? 16 : 13, a: rnd(0, 3), va: rnd(-.3, .3), vx: rnd(-20, 20), d: 25 });
  else for (let i = 0, n = 3 + (Math.random() * 3 | 0); i < n; i++)
    S.obs.push({ k: 'fish', x: clamp(x + rnd(-40, 40), Lx, Rx), wy: wy + i * 20, len: 0, r: 8, vx: rnd(-30, 30), a: 0, d: 25 });
  if (Math.random() < .25) S.obs.push({ k: 'pw', p: ['boost', 'shield', 'fury', 'gem'][Math.random() * 4 | 0], x: rnd(Lx, Rx), wy: wy + rnd(160, 260), len: 0, r: 16, a: 0 });
  if (Math.random() < .2) S.obs.push({ k: 'supply', x: rnd(Lx, Rx), wy: wy + rnd(40, 120), len: 0, r: 16, a: 0 });
}
function spawnBoss() {
  const t = BOSSES[S.region][S.bn++ % 3], hp = 100 + Math.round((diff() - 1) * 40);
  S.boss = { t, x: W / 2, y: -130, hp, max: hp, st: 'swim', tm: 0, life: 60, hurt: 0, stun: 0 };
  say(`⚠ BOSS: ${t.n}! Tusuk dengan tombak`, 3.5); sfx.roar(t.s);
}
function updBoss(dt) {
  const b = S.boss; if (!b) return;
  b.tm += dt; b.life -= dt; b.hurt = Math.max(0, b.hurt - dt);
  if (b.life <= 0) { S.boss = null; say(`${b.t.n} pergi...`); return; }
  if (b.st === 'swim') {
    b.x += clamp((S.bx - b.x) * 2, -110, 110) * dt; b.y += ((BY - 170) - b.y) * Math.min(1, dt * 1.5);
    if (b.tm > 2.2 && Math.abs(b.x - S.bx) < 55 && b.y > BY - 230) { b.st = 'warn'; b.tm = 0; sfx.warn(); }
  } else if (b.st === 'warn') {
    b.x += clamp((S.bx - b.x) * 2, -60, 60) * dt; if (b.tm > .8) { b.st = 'bite'; b.tm = 0; }
  } else if (b.st === 'bite') {
    b.y += 640 * dt;
    if (Math.abs(b.x - S.bx) < 48 && Math.abs(b.y - (BY - 10)) < 50) { hurt(45, 1.5, 'bite'); S.speed = 0; say('Rakit diserang!'); b.st = 'recover'; b.tm = 0; }
    else if (b.y > BY + 100) { b.st = 'recover'; b.tm = 0; b.stun = 1.4; }
  } else {
    b.stun = Math.max(0, b.stun - dt); b.y += ((BY - 220) - b.y) * Math.min(1, dt * 1.2); if (b.tm > 1.8) { b.st = 'swim'; b.tm = 0; }
  }
  b.x = clamp(b.x, bankL(S.scroll) + 55, bankR(S.scroll) - 55); // tidak keluar ke darat
}
const LIFESTEAL = .45; // HP yang pulih (persen dari HP maks) setiap membunuh 1 mob
function whack() {
  for (let n = S.obs.length - 1; n >= 0; n--) { // tombak membunuh ikan/ubur-ubur dekat rakit
    const o = S.obs[n]; if (o.k !== 'fish') continue;
    if (Math.hypot(o.x - S.bx, BY - (o.wy - S.scroll) - BY) < 100) {
      S.obs.splice(n, 1); S.bonus += 10; S.hp = Math.min(MAXHP, S.hp + MAXHP * LIFESTEAL); sfx.hit('fish', o.x); sfx.pick(o.x); say('🩸 Lifesteal +45% HP', 1.5);
    }
  }
  const b = S.boss; if (!b) return;
  if (Math.hypot(b.x - S.bx, b.y - BY) < 135) {
    b.hp -= S.fury > 0 ? 50 : 25; b.hurt = .3; sfx.whack(b.x);
    if (b.hp <= 0) {
      S.boss = null; S.bonus += 300; S.hp = Math.min(MAXHP, S.hp + MAXHP * LIFESTEAL); sfx.bossDown(); say(`${b.t.n} kalah! +300 • +45% HP • Ambil LOOT!`, 3.5);
      S.obs.push({ k: 'loot', x: b.x, wy: S.scroll + BY - b.y, len: 0, r: 20, a: 0 });
    }
  }
}

function applyPw(p) {
  if (p === 'boost') { S.boost = 6; S.speed = Math.max(S.speed, 200); say('⚡ SPEED BOOST!', 2); }
  else if (p === 'shield') { S.shield = 4; say('🛡 PERISAI! Kebal 4 serangan', 2); }
  else if (p === 'fury') { S.fury = 10; say('🔥 TOMBAK API! Damage x2', 2); }
  else { S.bonus += 100; say('💎 +100 skor', 1.5); }
}
function toSea() {
  S.region = 'sea'; S.dist = 0; S.scroll = 0; S.evi = 0; S.obs = []; S.boss = null; S.warned = false; S.stormEnd = S.curEnd = -1; S.bonus += 1000;
  S.hp = Math.min(MAXHP, S.hp + MAXHP * .5); S.speed = 40; S.bx = W / 2; S.mode = 'river'; S.spawn = 150; save();
  say('🌊 WILAYAH BARU: LAUT LEPAS! (+1000)', 4); sfx.region();
}
function updRiver(dt) {
  const k = S, E = EV[k.region], ev = E[k.evi % E.length], tgt = ev.m + Math.floor(k.evi / E.length) * LAPS[k.region];
  if (k.dist >= GOAL) {
    if (sea()) { k.over = true; sfx.win(); showOv('🏆 KAMU MENANG!', `Kamu menaklukkan sungai dan laut!<br>Skor: <b>${Math.floor(k.dist) + k.bonus}</b>`); } else toSea();
    return;
  }
  if (!k.warned && k.dist >= tgt - 25 && (ev.t === 'climb' || ev.t === 'drop')) { k.warned = true; say('⚠ AIR TERJUN DI DEPAN!'); sfx.warn(); }
  if (k.dist >= tgt) {
    k.warned = false; k.evi++;
    if (ev.t === 'storm') { k.stormEnd = k.dist + ev.len; say('⛈ Cuaca buruk! Angin, hujan, petir', 3); }
    else if (ev.t === 'current') { k.curEnd = k.dist + ev.len; say('🌊 Arus berlawanan! Dayung lebih sering', 3); }
    else if (ev.t === 'boss') spawnBoss();
    else if (ev.t === 'climb') startClimb(); else startDrop();
    if (k.mode !== 'river') return;
  }
  k.storm += ((k.dist < k.stormEnd ? 1 : 0) - k.storm) * Math.min(1, dt * .8);
  k.cur += ((15 + (k.dist < k.curEnd ? 60 + 10 * diff() : 0)) - k.cur) * Math.min(1, dt * 1.5);
  const i = inp();
  if (k.p) { k.push += 60; k.oar = 1; sfx.row(); if (k.boss) sfx.spear(); whack(); }
  const tr = Math.min(k.push, 420 * dt); k.push -= tr; k.speed = Math.min(k.boost > 0 ? 300 : 170, k.speed + tr + (k.boost > 0 ? 500 * dt : 0)); if (k.boost <= 0 && k.speed > 170) k.speed = Math.max(170, k.speed - 160 * dt);
  k.speed = Math.max(0, k.speed - (28 + (i.y > 0 ? i.y * 80 : 0)) * dt);
  const wind = Math.sin(k.t * .9) * 70 * k.storm;
  k.vx += ((i.x * 190 + wind) - k.vx) * Math.min(1, dt * 6); k.bx += k.vx * dt;
  const lo = bankL(k.scroll) + 22, hi = bankR(k.scroll) - 22;
  if (k.bx < lo) { k.bx = lo; k.vx = Math.abs(k.vx) * .3; k.speed *= .98; } else if (k.bx > hi) { k.bx = hi; k.vx = -Math.abs(k.vx) * .3; k.speed *= .98; }
  k.rot += (k.vx / 190 * .35 + Math.sin(k.t * 3) * .08 * k.storm - k.rot) * Math.min(1, dt * 5);
  const net = k.speed - k.cur;
  k.netS += (net - k.netS) * Math.min(1, dt * 8);
  k.scroll = Math.max(0, k.scroll + k.netS * dt); k.dist = k.scroll / PX; k.flow += k.cur * dt;
  if (net > 0 && (k.spawn -= net * dt) <= 0) { spawnObs(); k.spawn = rnd(110, 200) / diff() * (k.boss ? 1.6 : 1); }
  for (let n = k.obs.length - 1; n >= 0; n--) {
    const o = k.obs[n];
    if (o.k === 'log') { o.a += o.va * dt; o.x += o.vx * dt; }
    if (o.k === 'fish') { o.vx = clamp(o.vx + Math.sign(k.bx - o.x) * 60 * dt, -70, 70); o.x += o.vx * dt; o.wy -= 30 * dt; o.a = Math.atan2(30, o.vx); }
    if (o.k === 'supply' || o.k === 'loot' || o.k === 'pw') o.x += Math.sin(k.t * 1.5 + o.wy) * 8 * dt;
    // semua objek dijaga tetap di air (tidak masuk darat)
    const ext = o.r + Math.abs(Math.cos(o.a)) * (o.len || 0) / 2 + 6, lo2 = bankL(o.wy) + ext, hi2 = bankR(o.wy) - ext;
    if (o.x < lo2) { o.x = lo2; if (o.vx) o.vx = Math.abs(o.vx); } else if (o.x > hi2) { o.x = hi2; if (o.vx) o.vx = -Math.abs(o.vx); }
    const sy = BY - (o.wy - k.scroll);
    if (sy > H + 120) { k.obs.splice(n, 1); continue; }
    if (o.k === 'supply' || o.k === 'loot' || o.k === 'pw') {
      if (Math.hypot(k.bx - o.x, BY - sy) < o.r + 22) {
        k.obs.splice(n, 1); if (o.k === 'loot') sfx.loot(); else if (o.k === 'pw') sfx.power(o.p, o.x); else sfx.pick(o.x);
        if (o.k === 'supply') { k.hp = MAXHP; say('HP PENUH 💚', 1.8); }
        else if (o.k === 'pw') applyPw(o.p);
        else { k.hp = Math.min(MAXHP, k.hp + MAXHP * .2); k.bonus += 300; say('LOOT! +300 skor, +20% HP 💎', 2.5); }
      }
      continue;
    }
    if (o.hit) continue;
    const hx = Math.cos(o.a) * o.len / 2, hy = Math.sin(o.a) * o.len / 2;
    if (segDist(k.bx, BY, o.x - hx, sy - hy, o.x + hx, sy + hy) < o.r + 15) {
      if (o.k === 'fish') { if (hurt(o.d, .7, sea() ? 'zap' : 'fish', o.x)) { k.speed *= .8; k.obs.splice(n, 1); } }
      else if (hurt(o.d, .7, o.k, o.x)) { o.hit = true; k.speed *= .3; k.bx += (k.bx > o.x ? 1 : -1) * 18; }
    }
  }
  updBoss(dt);
  if (k.storm > .5 && Math.random() < dt * .25) { k.flash = 1; sfx.thunder(); }
}

// ====== Tanjakan & turunan ======
function startClimb() { S.mode = 'climb'; S.h = 12; S.hv = 12; S.vx = 0; S.deb = []; S.dsp = 0; S.bx = W / 2; S.boss = null; say('⬆ TANJAKAN 90°! Ketuk DAYUNG cepat, hindari kayu jatuh', 3.5); }
function updClimb(dt) {
  const i = inp();
  if (S.p) { S.h += 6.5; S.oar = 1; sfx.row(); }
  S.h -= (9 + 4 * diff()) * dt; S.hv += (S.h - S.hv) * Math.min(1, dt * 12);
  S.vx += (i.x * 220 - S.vx) * Math.min(1, dt * 7); S.bx = clamp(S.bx + S.vx * dt, 130, W - 130);
  S.rot += (S.vx / 220 * .2 - S.rot) * Math.min(1, dt * 6); S.wfo += 320 * dt;
  if ((S.dsp -= dt) <= 0) { S.dsp = rnd(.6, 1.1) / diff(); S.deb.push({ x: rnd(120, W - 120), y: -40, v: rnd(220, 320), r: rnd(14, 22), log: Math.random() < .5 }); }
  for (let n = S.deb.length - 1; n >= 0; n--) {
    const d = S.deb[n]; d.y += d.v * dt;
    if (d.y > H + 50) { S.deb.splice(n, 1); continue; }
    if (Math.hypot(d.x - S.bx, d.y - BY) < d.r + 16) { S.h -= 10; hurt(25, .7, d.log ? 'wood' : 'rock', d.x); S.deb.splice(n, 1); }
  }
  if (S.dying > 0) return;
  if (S.h <= 0) { damage(20); say('Terseret turun! Coba lagi'); sfx.splash(); S.h = 12; }
  if (S.h >= 100) { S.mode = 'river'; S.speed = 60; S.obs = []; S.bonus += 150; S.spawn = 150; say('Berhasil menaiki air terjun! +150', 3); sfx.win(); }
}
function startDrop() { S.mode = 'drop'; S.fp = 0; S.vy = 90; S.vx = 0; S.bk = 0; S.deb = []; S.dsp = 120; S.bx = W / 2; S.boss = null; say('⬇ TURUNAN 90°! DAYUNG = rem, hindari batu', 3.5); }
function updDrop(dt) {
  const i = inp();
  if (S.p) { S.bk += 85; S.oar = 1; sfx.row(); }
  const tb = Math.min(S.bk, 500 * dt); S.bk -= tb; S.vy = Math.max(110, S.vy - tb); S.vy = Math.min(560, S.vy + 240 * dt);
  S.vx += (i.x * 230 - S.vx) * Math.min(1, dt * 7); S.bx = clamp(S.bx + S.vx * dt, 120, W - 120);
  S.rot += (S.vx / 230 * .2 - S.rot) * Math.min(1, dt * 6); S.fp += S.vy * dt; S.wfo += S.vy * dt;
  if ((S.dsp -= S.vy * dt) <= 0) { S.dsp = rnd(170, 300) / diff(); S.deb.push({ x: rnd(120, W - 120), y: H + 60, r: rnd(18, 30) }); }
  for (let n = S.deb.length - 1; n >= 0; n--) {
    const d = S.deb[n]; d.y -= S.vy * dt;
    if (d.y < -80) { S.deb.splice(n, 1); continue; }
    if (Math.hypot(d.x - S.bx, d.y - BY) < d.r + 15) { hurt(25, .7, 'rock', d.x); S.vy *= .55; S.deb.splice(n, 1); }
  }
  if (S.dying > 0) return;
  if (S.fp >= 3200) {
    const dm = Math.max(0, (S.vy - 260) / 10); sfx.splash();
    if (dm > 1) { damage(dm); say(`Mendarat keras! -${Math.round(dm)} HP`, 3); } else say('Mendarat mulus!', 3);
    if (S.dying > 0) return;
    S.mode = 'river'; S.speed = 40; S.obs = []; S.spawn = 150;
  }
}

function update(dt) {
  S.t += dt; S.clock += dt / DAY; S.inv = Math.max(0, S.inv - dt); S.boost = Math.max(0, S.boost - dt); S.fury = Math.max(0, S.fury - dt); S.shake = Math.max(0, S.shake - dt); S.hitF = Math.max(0, S.hitF - dt * 2.5);
  S.msgT -= dt; S.flash = Math.max(0, S.flash - dt * 3); S.oar = Math.max(0, S.oar - dt * 3);
  S.p = pend; pend = false;
  if (S.dying > 0) {
    S.dying -= dt;
    for (const p of S.pieces) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - 1.4 * dt; p.vy *= 1 - 1.4 * dt; p.r += p.vr * dt; }
    if (S.dying <= 0) gameOver();
  }
  if (S.mode === 'river') updRiver(dt); else if (S.mode === 'climb') updClimb(dt); else updDrop(dt);
  if (S.storm > .02) for (const r of S.rain) {
    r.y += r.v * dt; r.x -= (40 + Math.sin(S.t * .9) * 60) * dt;
    if (r.y > H) { r.y = -10; r.x = rnd(0, W + 60); } if (r.x < 0) r.x += W;
  }
}

// ====== Pencahayaan (matahari terbit-terbenam, bulan di malam hari) ======
let SH = { x: 6, y: 6, a: .25 };
function lighting() {
  const p = mod(S.clock, 1), day = p < .6, q = day ? p / .6 : (p - .6) / .4; let h = 0, night = 0;
  if (day) h = Math.sin(q * Math.PI); else night = Math.pow(Math.sin(q * Math.PI), .6);
  const arc = day ? h : Math.sin(q * Math.PI), tt = clamp((q - .42) / .16, 0, 1), ss = tt * tt * (3 - 2 * tt), sx = (day ? ss : 1 - ss) * W, sy = 30 + (1 - arc) * 150;
  L = { p, h, night, day, sx, sy, dusk: day ? clamp(.3 - h, 0, .3) * .9 : Math.max(clamp(.3 - q * 3, 0, .3), clamp(.3 - (1 - q) * 3, 0, .3)) * .9, warm: day ? clamp(1 - h * 2.4, 0, 1) : 0, glare: day ? clamp((h - .72) / .28, 0, 1) : 0 };
  SH = { x: (W / 2 - sx) * .06 * (1.5 - arc), y: 4 + 12 * (1.2 - arc), a: day ? (.1 + .22 * h) * (1 - night) : .09 * night };
}
function shadow(x, y, rx, ry) { if (SH.a < .01) return; c.fillStyle = `rgba(0,25,35,${SH.a})`; c.beginPath(); c.ellipse(x + SH.x, y + SH.y, rx, ry, 0, 0, 7); c.fill(); }
function drawLight() {
  const { h, night, sx, sy, warm, glare, p, day } = L, a0 = Math.atan2(H / 2 - sy, W / 2 - sx);
  c.save();
  if (day && h > .02) {
    const vis = clamp(h * 4, 0, 1); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) { // sinar matahari
      const a = a0 + lerp(-.9, .9, i / 6) + Math.sin(S.t * .3 + i * 2) * .04, w = .05 + (i % 3) * .015, len = 1100;
      const g = c.createLinearGradient(sx, sy, sx + Math.cos(a) * len, sy + Math.sin(a) * len);
      g.addColorStop(0, `rgba(255,${warm > .3 ? 200 : 232},${warm > .3 ? 140 : 185},${(.1 + .08 * warm) * vis * (.6 + .4 * Math.sin(S.t * .6 + i))})`); g.addColorStop(1, 'rgba(255,230,170,0)');
      c.fillStyle = g; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + Math.cos(a - w) * len, sy + Math.sin(a - w) * len); c.lineTo(sx + Math.cos(a + w) * len, sy + Math.sin(a + w) * len); c.fill();
    }
    const bl = c.createRadialGradient(sx, sy, 0, sx, sy, 140 + 300 * glare); // bloom (diredupkan)
    bl.addColorStop(0, `rgba(255,${warm > .3 ? 205 : 238},${warm > .3 ? 140 : 195},${(.26 + .16 * glare) * vis})`); bl.addColorStop(1, 'rgba(255,220,150,0)');
    c.fillStyle = bl; c.fillRect(0, 0, W, H);
    const cr = c.createRadialGradient(sx, sy, 0, sx, sy, 24); // inti matahari
    cr.addColorStop(0, `rgba(255,248,225,${.5 * vis})`); cr.addColorStop(.5, `rgba(255,215,140,${.25 * vis})`); cr.addColorStop(1, 'rgba(255,200,120,0)');
    c.fillStyle = cr; c.beginPath(); c.arc(sx, sy, 24, 0, 7); c.fill();
    for (let i = 0; i < 46; i++) { // kilau air
      const x = (i * 97 + Math.sin(S.t + i) * 6) % W, y = mod(i * 53 + S.scroll * .4, H), a = Math.max(0, Math.sin(S.t * 3 + i * 1.7)) * (.2 + .4 * h);
      c.fillStyle = `rgba(255,255,235,${a})`; c.fillRect(x - 3, y, 6, 1.5); c.fillRect(x - .75, y - 3, 1.5, 7);
    }
    if (glare > .05) { // silau siang hari
      c.fillStyle = `rgba(255,255,245,${glare * (.11 + .03 * Math.sin(S.t * 2))})`; c.fillRect(0, 0, W, H);
      for (const [t, r] of [[.25, 24], [.45, 50], [.7, 30], [.95, 60]]) {
        const fx = lerp(sx, S.bx, t), fy = lerp(sy, BY, t), fg = c.createRadialGradient(fx, fy, 0, fx, fy, r);
        fg.addColorStop(0, `rgba(255,240,200,${glare * .14})`); fg.addColorStop(1, 'rgba(255,200,120,0)'); c.fillStyle = fg; c.beginPath(); c.arc(fx, fy, r, 0, 7); c.fill();
      }
    }
  }
  c.globalCompositeOperation = 'source-over';
  if (warm > 0) { // nuansa pagi/senja + kabut
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgba(255,140,70,${.22 * warm})`); g.addColorStop(1, `rgba(255,190,130,${.06 * warm})`); c.fillStyle = g; c.fillRect(0, 0, W, H);
    if (p < .3) for (let i = 0; i < 4; i++) {
      const mx = mod(i * 190 + S.t * 10, W + 300) - 150, my = 100 + i * 180 + Math.sin(S.t * .3 + i) * 20, mg = c.createRadialGradient(mx, my, 0, mx, my, 170);
      mg.addColorStop(0, `rgba(255,240,225,${.16 * warm})`); mg.addColorStop(1, 'rgba(255,240,225,0)'); c.fillStyle = mg; c.fillRect(mx - 170, my - 170, 340, 340);
    }
  }
  if (L.dusk > 0) { c.fillStyle = `rgba(35,20,60,${L.dusk})`; c.fillRect(0, 0, W, H); }
  if (night > .01) {
    const dk = c.createRadialGradient(S.bx, BY, 30, S.bx, BY, 340); dk.addColorStop(0, `rgba(4,10,34,${.1 * night})`); dk.addColorStop(1, `rgba(4,10,34,${.86 * night})`);
    c.fillStyle = dk; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'lighter';
    const mg = c.createRadialGradient(sx, sy, 0, sx, sy, 260); mg.addColorStop(0, `rgba(150,180,255,${.22 * night})`); mg.addColorStop(1, 'rgba(150,180,255,0)'); c.fillStyle = mg; c.fillRect(0, 0, W, H); // cahaya bulan
    for (let i = 0; i < 5; i++) { const a = a0 + lerp(-.5, .5, i / 4), g = c.createLinearGradient(sx, sy, sx + Math.cos(a) * 900, sy + Math.sin(a) * 900); g.addColorStop(0, `rgba(160,190,255,${.05 * night})`); g.addColorStop(1, 'rgba(160,190,255,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + Math.cos(a - .04) * 900, sy + Math.sin(a - .04) * 900); c.lineTo(sx + Math.cos(a + .04) * 900, sy + Math.sin(a + .04) * 900); c.fill(); }
    const lx = S.bx + 14, ly = BY + 22, lg = c.createRadialGradient(lx, ly, 0, lx, ly, 150 + 8 * Math.sin(S.t * 9)); // lentera
    lg.addColorStop(0, `rgba(255,190,90,${.5 * night})`); lg.addColorStop(1, 'rgba(255,150,50,0)'); c.fillStyle = lg; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(255,255,255,${night * (.3 + .4 * Math.sin(S.t * 2 + i))})`; c.fillRect((i * 73) % W, (i * 41) % 200, 1.5, 1.5); }
    c.globalCompositeOperation = 'source-over'; const ma = clamp(night * 3, 0, 1); // bulan
    c.globalAlpha = ma; c.fillStyle = '#e8eefc'; c.beginPath(); c.arc(sx, sy, 16, 0, 7); c.fill();
    c.fillStyle = 'rgba(150,165,200,.45)'; for (const [dx, dy, r] of [[-5, -4, 4], [5, 3, 5], [-2, 7, 2.5]]) { c.beginPath(); c.arc(sx + dx, sy + dy, r, 0, 7); c.fill(); }
    c.globalAlpha = 1;
  }
  c.restore();
}

// ====== Gambar ======
function drawBoat(x, y, rot, oar) {
  shadow(x, y + 4, 28, 38);
  c.save(); c.translate(x, y); c.rotate(rot);
  if (S.inv > 0 && Math.floor(S.t * 20) % 2) c.globalAlpha = .5;
  c.fillStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.ellipse(0, 36, 26, 9, 0, 0, 7); c.fill();
  const tip = oar > 0 ? -20 + (1 - oar) * 40 : 8;
  c.strokeStyle = '#6d4c2f'; c.lineWidth = 3; c.lineCap = 'round';
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 14, 2); c.lineTo(s * 46, tip); c.stroke(); c.fillStyle = '#8a5f35'; c.beginPath(); c.ellipse(s * 46, tip, 4, 9, 0, 0, 7); c.fill(); }
  for (let i = -2; i <= 2; i++) { // balok rakit
    const x0 = i * 9; c.fillStyle = i % 2 ? '#a66f3c' : '#b9814a'; c.strokeStyle = '#4e2f17'; c.lineWidth = 1.5;
    c.beginPath(); c.roundRect(x0 - 4.5, -32, 9, 64, 4.5); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(255,230,170,.4)'; c.beginPath(); c.moveTo(x0 - 1.5, -27); c.lineTo(x0 - 1.5, 27); c.stroke();
  }
  c.fillStyle = '#5a3a1c'; c.fillRect(-24, -17, 48, 5); c.fillRect(-24, 12, 48, 5);
  c.fillStyle = '#d8c08a'; for (let i = -2; i <= 2; i++) { c.beginPath(); c.arc(i * 9, -14.5, 2, 0, 7); c.arc(i * 9, 14.5, 2, 0, 7); c.fill(); }
  c.fillStyle = '#3a2410'; c.fillRect(19, 18, 3, 12); c.fillStyle = '#ffd27a'; c.beginPath(); c.arc(20.5, 16, 4, 0, 7); c.fill();
  c.fillStyle = '#d94f4f'; c.beginPath(); c.ellipse(0, 4, 9, 6, 0, 0, 7); c.fill();
  c.fillStyle = '#f2c9a0'; c.beginPath(); c.arc(0, -2, 5.5, 0, 7); c.fill();
  c.fillStyle = '#e7c66b'; c.beginPath(); c.ellipse(0, -2, 10, 10, 0, 0, 7); c.fill(); c.strokeStyle = '#b8964a'; c.lineWidth = 1; c.stroke();
  const sl = 30 + oar * 34; // tombak
  c.strokeStyle = '#6d4c2f'; c.lineWidth = 3; c.beginPath(); c.moveTo(-8, 6); c.lineTo(-8, -sl); c.stroke();
  c.fillStyle = S.fury > 0 ? '#ff8a30' : '#d5dce2'; c.beginPath(); c.moveTo(-8, -sl - 12); c.lineTo(-12, -sl); c.lineTo(-4, -sl); c.fill();
  if (S.fury > 0) { c.fillStyle = `rgba(255,120,30,${.3 + .2 * Math.sin(S.t * 14)})`; c.beginPath(); c.arc(-8, -sl - 8, 12, 0, 7); c.fill(); }
  if (S.boost > 0) for (let i = 0; i < 3; i++) { c.fillStyle = `rgba(255,${150 + i * 40},60,${.55 - i * .12})`; c.beginPath(); c.moveTo(-8 + i * 8, 34); c.lineTo(-3 + i * 8, 60 + Math.random() * 14); c.lineTo(2 + i * 8, 34); c.fill(); }
  if (S.shield > 0) { c.strokeStyle = `rgba(120,220,255,${.6 + .2 * Math.sin(S.t * 6)})`; c.lineWidth = 3; c.fillStyle = 'rgba(120,220,255,.14)'; c.beginPath(); c.arc(0, 0, 46, 0, 7); c.fill(); c.stroke(); }
  c.restore();
}
function drawObs(o, sy) {
  shadow(o.x, sy, Math.max(o.r, (o.len || 0) * .35) + 2, o.r + 2);
  c.save(); c.translate(o.x, sy); const sc = sea();
  if (o.k === 'rock') {
    c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.arc(0, 0, o.r + 5, 0, 7); c.fill();
    const g = c.createRadialGradient(-o.r / 3, -o.r / 3, 3, 0, 0, o.r);
    if (sc) { g.addColorStop(0, '#ffb0a0'); g.addColorStop(1, '#b0405f'); } else { g.addColorStop(0, '#c4c8cd'); g.addColorStop(1, '#5d6268'); }
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, o.r, 0, 7); c.fill();
    if (sc) for (let i = 0; i < 6; i++) { const a = i * 1.05; c.beginPath(); c.arc(Math.cos(a) * o.r, Math.sin(a) * o.r, 6, 0, 7); c.fill(); }
  } else if (o.k === 'branch') {
    c.rotate(o.a); c.strokeStyle = sc ? '#6b5a42' : '#5a3d22'; c.lineCap = 'round'; c.lineWidth = sc ? 14 : 11;
    c.beginPath(); c.moveTo(-o.len / 2, 0); c.lineTo(o.len / 2, 0); c.stroke();
    c.lineWidth = 4; if (sc) { c.strokeStyle = '#2a2018'; for (const f of [-.3, .1, .35]) { c.beginPath(); c.moveTo(o.len * f, -6); c.lineTo(o.len * f, 6); c.stroke(); } }
    else for (const f of [-.3, .1, .35]) { c.beginPath(); c.moveTo(o.len * f, 0); c.lineTo(o.len * f + 14, f > 0 ? 24 : -24); c.stroke(); }
  } else if (o.k === 'log') {
    c.rotate(o.a);
    if (sc) { c.fillStyle = '#c0392b'; c.strokeStyle = '#4a1a14'; c.lineWidth = 2; c.beginPath(); c.roundRect(-o.len / 2, -o.r, o.len, o.r * 2, 8); c.fill(); c.stroke(); c.fillStyle = '#e8d8b0'; c.fillRect(-4, -o.r, 8, o.r * 2); }
    else {
      c.fillStyle = '#8b5a2b'; c.strokeStyle = '#4a2c12'; c.lineWidth = 2; c.beginPath(); c.roundRect(-o.len / 2, -o.r, o.len, o.r * 2, 6); c.fill(); c.stroke();
      c.fillStyle = '#d2a36a'; for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * o.len / 2, 0, 4, o.r, 0, 0, 7); c.fill(); c.stroke(); }
    }
  } else if (o.k === 'pw') {
    const m = { boost: ['#ffd23a', '⚡'], shield: ['#5cc8ff', '🛡'], fury: ['#ff7a2a', '🔥'], gem: ['#c86bff', '💎'] }[o.p], pu = 1 + .12 * Math.sin(S.t * 6 + o.wy);
    const g = c.createRadialGradient(0, 0, 4, 0, 0, 30 * pu); g.addColorStop(0, m[0]); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.globalAlpha = .6; c.fillStyle = g; c.beginPath(); c.arc(0, 0, 30 * pu, 0, 7); c.fill(); c.globalAlpha = 1;
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(0, 0, 15, 0, 7); c.fill(); c.strokeStyle = m[0]; c.lineWidth = 3; c.stroke();
    c.font = '18px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(m[1], 0, 1); c.textBaseline = 'alphabetic';
  } else if (o.k === 'supply' || o.k === 'loot' || o.k === 'pw') {
    const ld = o.k === 'loot'; c.rotate(Math.sin(S.t * 2 + o.wy) * .15);
    c.strokeStyle = ld ? `rgba(255,220,100,${.5 + .3 * Math.sin(S.t * 5)})` : `rgba(120,255,150,${.5 + .3 * Math.sin(S.t * 5)})`; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 26, 0, 7); c.stroke();
    c.fillStyle = ld ? '#e6b422' : '#c98f4a'; c.strokeStyle = '#5a3a1c'; c.lineWidth = 2; c.beginPath(); c.roundRect(-15, -15, 30, 30, 4); c.fill(); c.stroke();
    if (ld) { c.fillStyle = '#fff3b0'; c.fillRect(-15, -3, 30, 5); c.fillStyle = '#8a5a10'; c.fillRect(-3, -6, 6, 10); }
    else { c.fillStyle = '#fff'; c.fillRect(-8, -8, 16, 16); c.fillStyle = '#e03a3a'; c.fillRect(-2, -7, 4, 14); c.fillRect(-7, -2, 14, 4); }
  } else if (sc) { // ubur-ubur
    c.fillStyle = 'rgba(255,150,220,.8)'; c.beginPath(); c.arc(0, 0, 9, 0, 7); c.fill(); c.strokeStyle = 'rgba(255,200,240,.8)'; c.lineWidth = 2;
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 3, 6); c.quadraticCurveTo(i * 5 + Math.sin(S.t * 5 + i) * 4, 14, i * 3, 20); c.stroke(); }
  } else {
    c.rotate(o.a - Math.PI / 2); c.fillStyle = '#f09a3e'; c.beginPath(); c.ellipse(0, 0, 5, 10, 0, 0, 7); c.fill();
    c.beginPath(); c.moveTo(0, -8); c.lineTo(-5, -15); c.lineTo(5, -15); c.fill(); c.fillStyle = '#222'; c.fillRect(-2, 5, 1.5, 1.5);
  }
  c.restore();
}
function drawBoss(b) {
  const t = b.t, s = t.s; shadow(b.x, b.y, 52, 105);
  c.save(); c.translate(b.x, b.y); if (b.hurt > 0) c.globalAlpha = .6;
  c.fillStyle = t.c;
  if (s === 'fish' || s === 'shark' || s === 'orca') { c.beginPath(); c.moveTo(0, -80); c.lineTo(-38, -150); c.lineTo(38, -150); c.fill(); }
  if (s === 'croc') { c.beginPath(); c.ellipse(0, -95, 14, 60, 0, 0, 7); c.fill(); }
  const bw = s === 'hippo' ? 62 : s === 'croc' ? 38 : 50;
  c.beginPath(); c.ellipse(0, s === 'octo' ? -20 : 0, bw, s === 'octo' ? 80 : 100, 0, 0, 7); c.fill();
  c.fillStyle = t.d; c.strokeStyle = t.c;
  if (s !== 'croc' && s !== 'hippo' && s !== 'octo') for (const k of [-1, 1]) { c.beginPath(); c.moveTo(k * 46, 0); c.lineTo(k * 85, 30); c.lineTo(k * 44, 45); c.fill(); }
  if (s === 'shark' || s === 'orca') { c.beginPath(); c.moveTo(0, -60); c.lineTo(-12, -20); c.lineTo(12, -20); c.fill(); }
  if (s === 'croc') for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(-7, -50 + i * 15); c.lineTo(0, -60 + i * 15); c.lineTo(7, -50 + i * 15); c.fill(); }
  if (s === 'hippo') for (const k of [-1, 1]) { c.beginPath(); c.arc(k * 44, 56, 11, 0, 7); c.fill(); }
  if (s === 'octo') { c.lineWidth = 11; c.lineCap = 'round'; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(i * 15 - 38, 50); c.quadraticCurveTo(i * 20 - 50 + Math.sin(S.t * 3 + i) * 14, 100, i * 12 - 30 + Math.sin(S.t * 2 + i) * 18, 140); c.stroke(); } }
  c.fillStyle = t.l; c.beginPath(); c.ellipse(0, -10, bw * .55, 60, 0, 0, 7); c.fill();
  if (s === 'orca') { c.fillStyle = '#fff'; for (const k of [-1, 1]) { c.beginPath(); c.ellipse(k * 28, 36, 8, 15, 0, 0, 7); c.fill(); } }
  const open = b.st === 'warn' ? .6 : b.st === 'bite' ? 1 : .15;
  c.fillStyle = '#6b1414'; c.beginPath(); c.ellipse(0, 86, 30, 8 + 22 * open, 0, 0, 7); c.fill();
  c.fillStyle = '#fff'; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 10 - 4, 80); c.lineTo(i * 10 + 4, 80); c.lineTo(i * 10, 92 + 4 * open); c.fill(); }
  for (const k of [-1, 1]) { c.fillStyle = '#fff'; c.beginPath(); c.arc(k * 24, 52, 9, 0, 7); c.fill(); c.fillStyle = b.st === 'warn' ? '#e22' : '#111'; c.beginPath(); c.arc(k * 24, 56, 4, 0, 7); c.fill(); }
  if (b.st === 'warn') { c.fillStyle = '#ff3b3b'; c.font = 'bold 40px sans-serif'; c.textAlign = 'center'; c.fillText('!', 0, 150); }
  c.restore();
}
function water() {
  const sc = sea(), g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, sc ? '#0a4a78' : '#1f6f8b'); g.addColorStop(1, sc ? '#1d8bb8' : '#2a9fbe'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 2;
  for (let i = 0; i < 22; i++) {
    const y = mod(i * 57 + S.scroll + S.flow * .5, H + 60) - 30, x = 60 + (i * 97) % 360, l = sc ? 44 : 24;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + l / 2, y - (sc ? 10 : 6), x + l, y); c.stroke();
  }
  if (sc) { c.strokeStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 10; i++) { const y = mod(i * 83 + S.scroll * .9 + S.flow, H + 40) - 20, x = (i * 151) % W; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 18, y + 3); c.stroke(); } }
  if (S.cur > 30) {
    c.strokeStyle = `rgba(255,255,255,${Math.min(.4, (S.cur - 30) / 100)})`; c.lineWidth = 3;
    for (let i = 0; i < 9; i++) { const y = mod(i * 90 + S.flow * 1.4, H + 80) - 40, x = 100 + (i * 131) % 280; c.beginPath(); c.moveTo(x - 14, y - 8); c.lineTo(x, y + 6); c.lineTo(x + 14, y - 8); c.stroke(); }
  }
}
function drawPieces() {
  for (const p of S.pieces) {
    c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.globalAlpha = clamp(S.dying, 0, 1);
    c.fillStyle = p.lg ? '#a66f3c' : '#7a4f28'; c.strokeStyle = '#4e2f17'; c.lineWidth = 1.5; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); c.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h); c.restore();
  }
  if (S.dying > 0) { c.strokeStyle = `rgba(255,255,255,${clamp(S.dying - .4, 0, 1) * .5})`; c.lineWidth = 3; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(S.bx, BY, (2 - S.dying + i * .3) * 70, 0, 7); c.stroke(); } }
}
function drawRiver() {
  water();
  if (!sea()) {
    for (const side of [0, 1]) {
      c.beginPath(); c.moveTo(side ? W : 0, -10);
      for (let sy = -10; sy <= H + 10; sy += 20) { const wy = S.scroll + BY - sy; c.lineTo(side ? bankR(wy) : bankL(wy), sy); }
      c.lineTo(side ? W : 0, H + 10); c.closePath();
      const gg = c.createLinearGradient(side ? W : 0, 0, side ? W - 120 : 120, 0); gg.addColorStop(0, '#2f6a2c'); gg.addColorStop(1, '#4a8c3f');
      c.fillStyle = gg; c.fill(); c.strokeStyle = '#8d6e45'; c.lineWidth = 8; c.stroke(); c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 2.5; c.stroke();
    }
    const top = S.scroll + BY, bot = top - H;
    for (let k = Math.floor(bot / 70) - 1; k <= Math.ceil(top / 70); k++) {
      const wy = k * 70, sy = BY - (wy - S.scroll), hh = mod(Math.sin(k * 12.9898) * 43758.5453, 1);
      for (const side of [0, 1]) {
        const x = side ? bankR(wy) + 12 + hh * 25 : bankL(wy) - 12 - hh * 25, r = 16 + hh * 8;
        shadow(x, sy, r + 2, r + 2); c.fillStyle = hh > .5 ? '#2a5e2b' : '#336b30'; c.beginPath(); c.arc(x, sy, r, 0, 7); c.fill();
        c.fillStyle = 'rgba(160,220,110,.35)'; c.beginPath(); c.arc(x - r * .3, sy - r * .3, r * .55, 0, 7); c.fill();
      }
    }
  }
  for (const o of S.obs) drawObs(o, BY - (o.wy - S.scroll));
  if (S.boss) drawBoss(S.boss);
  if (S.dying <= 0) drawBoat(S.bx, BY, S.rot, S.oar);
  if (S.boost > 0) { c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; c.beginPath(); for (let i = 0; i < 14; i++) { const x = (i * 71) % W, y = mod(i * 97 + S.t * 900, H + 80) - 40; c.moveTo(x, y); c.lineTo(x, y + 40); } c.stroke(); }
  if (S.storm > .02) {
    const dk = c.createRadialGradient(S.bx, BY, 70, S.bx, BY, 340); dk.addColorStop(0, 'rgba(5,10,25,0)'); dk.addColorStop(1, `rgba(5,10,25,${.8 * S.storm})`);
    c.fillStyle = dk; c.fillRect(0, 0, W, H); c.fillStyle = `rgba(10,20,40,${.25 * S.storm})`; c.fillRect(0, 0, W, H);
    c.strokeStyle = `rgba(200,220,255,${.6 * S.storm})`; c.lineWidth = 1.5; c.beginPath();
    for (const r of S.rain) { c.moveTo(r.x, r.y); c.lineTo(r.x + 5, r.y - 16); } c.stroke();
  }
  if (S.flash > 0) { c.fillStyle = `rgba(255,255,255,${S.flash * .6})`; c.fillRect(0, 0, W, H); }
}
function drawFall(up) {
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#9fd6ea'); g.addColorStop(1, '#4aa6c8'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 3;
  for (let i = 0; i < 30; i++) { const x = 105 + (i * 37) % (W - 210), y = mod(i * 91 + (up ? -S.wfo : S.wfo), H + 80) - 40; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 50); c.stroke(); }
  for (const side of [0, 1]) {
    const x0 = side ? W - 100 : 0; c.fillStyle = '#4b4f55'; c.fillRect(x0, 0, 100, H); c.fillStyle = '#5f646b';
    for (let i = 0; i < 12; i++) { const y = mod(i * 80 + (up ? -S.wfo : S.wfo) * .6, H + 80) - 40; c.beginPath(); c.arc(x0 + (side ? 14 : 86) + (i % 3) * (side ? 8 : -8), y, 20 + (i % 4) * 5, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(side ? W - 104 : 96, 0, 8, H);
  }
}
function drawClimb() {
  drawFall(false);
  for (const d of S.deb) {
    c.save(); c.translate(d.x, d.y);
    if (d.log) { c.rotate(d.y / 60); c.fillStyle = '#8b5a2b'; c.strokeStyle = '#4a2c12'; c.lineWidth = 2; c.beginPath(); c.roundRect(-d.r * 2, -d.r / 2, d.r * 4, d.r, 5); c.fill(); c.stroke(); }
    else { c.fillStyle = '#6a6f76'; c.beginPath(); c.arc(0, 0, d.r, 0, 7); c.fill(); }
    c.restore();
  }
  if (S.dying <= 0) drawBoat(S.bx, BY, S.rot, S.oar);
  c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(W - 36, 100, 18, 380); c.fillStyle = S.h < 25 ? '#ff6b6b' : '#ffd36b';
  const hh = 380 * clamp(S.hv, 0, 100) / 100; c.fillRect(W - 36, 480 - hh, 18, hh); c.strokeStyle = '#fff'; c.lineWidth = 2; c.strokeRect(W - 36, 100, 18, 380);
}
function drawDrop() {
  drawFall(true);
  for (const d of S.deb) { const gr = c.createRadialGradient(d.x - 6, d.y - 6, 3, d.x, d.y, d.r); gr.addColorStop(0, '#9a9fa6'); gr.addColorStop(1, '#4d5258'); c.fillStyle = gr; c.beginPath(); c.arc(d.x, d.y, d.r, 0, 7); c.fill(); }
  if (S.dying <= 0) drawBoat(S.bx, BY, Math.PI + S.rot, S.oar);
  c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(W - 36, 100, 18, 380); c.fillStyle = '#ffd36b'; c.fillRect(W - 36, 100, 18, 380 * clamp(S.fp / 3200, 0, 1));
  c.strokeStyle = '#fff'; c.lineWidth = 2; c.strokeRect(W - 36, 100, 18, 380);
  c.fillStyle = S.vy > 400 ? '#ff6b6b' : '#fff'; c.font = 'bold 14px sans-serif'; c.textAlign = 'left'; c.fillText(`Kecepatan ${Math.round(S.vy)}`, 12, 94);
}
function bar(x, y, w, h, v, col, label) {
  c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(x, y, w, h); c.fillStyle = col; c.fillRect(x, y, w * clamp(v, 0, 1), h);
  c.strokeStyle = '#fff'; c.lineWidth = 2; c.strokeRect(x, y, w, h);
  c.fillStyle = '#fff'; c.font = `bold ${h - 4}px sans-serif`; c.textAlign = 'left'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.6)'; c.strokeText(label, x + 5, y + h - 4); c.fillText(label, x + 5, y + h - 4);
}
function hud() {
  bar(10, 10, 190, 18, S.hp / MAXHP, S.hp > MAXHP * .3 ? '#4cd964' : '#ff4d4d', `RAKIT ${Math.ceil(S.hp)}/${MAXHP}`);
  c.fillStyle = '#fff'; c.textAlign = 'right'; c.font = 'bold 15px sans-serif'; c.fillText(`${Math.floor(S.dist)} m • ${sea() ? 'LAUT' : 'SUNGAI'}`, W - 12, 24);
  if (S.boss) bar(10, 34, 190, 16, S.boss.hp / S.boss.max, '#ff9f43', `${S.boss.t.n} ${Math.max(0, S.boss.hp)}/${S.boss.max}`);
  let cx = 10; c.textAlign = 'left'; c.font = 'bold 13px sans-serif';
  for (const [ic, v] of [['⚡', S.boost], ['🛡', S.shield], ['🔥', S.fury]]) if (v > 0) { c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(cx, 56, 58, 20); c.fillStyle = '#fff'; c.fillText(ic + (ic === '🛡' ? ' ×' + v : ' ' + Math.ceil(v) + 's'), cx + 5, 71); cx += 64; }
  if (S.msgT > 0) {
    c.textAlign = 'center'; c.font = 'bold 18px sans-serif'; c.globalAlpha = Math.min(1, S.msgT); c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.7)'; c.strokeText(S.msg, W / 2, 100);
    c.fillStyle = '#fff'; c.fillText(S.msg, W / 2, 100); c.globalAlpha = 1;
  }
  if (S.hitF > 0) { const v = c.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 480); v.addColorStop(0, 'rgba(255,0,0,0)'); v.addColorStop(1, `rgba(255,20,20,${.55 * S.hitF})`); c.fillStyle = v; c.fillRect(0, 0, W, H); }
}
function draw() {
  lighting(); c.save();
  if (S.shake > 0) c.translate(rnd(-1, 1) * S.shake * 18, rnd(-1, 1) * S.shake * 18);
  if (S.mode === 'river') drawRiver(); else if (S.mode === 'climb') drawClimb(); else drawDrop();
  drawPieces(); c.restore(); drawLight(); hud();
}
function loop(ts) {
  const dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts;
  if (S.started && !S.over) update(dt); else { S.t += dt; S.clock += dt / DAY; }
  musicTick(); ambience(dt); draw(); requestAnimationFrame(loop);
}
reset(); slots(); requestAnimationFrame(loop);