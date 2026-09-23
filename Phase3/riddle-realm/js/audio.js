/**
 * Riddle Realm — Audio (Phase 11–12)
 * SFX beeps + looping ambient background music tracks.
 * Pure Web Audio — no external files required.
 */
const AudioFX = (function () {
  'use strict';

  let ctx = null;
  let musicNodes = [];
  let musicTimer = null;
  let musicPlaying = false;
  let currentTrack = 0;
  let masterMusicGain = null;

  const TRACKS = [
    {
      id: 'aurora',
      name: 'Aurora Mind',
      pad: [220, 261.63, 329.63],
      arp: [440, 523.25, 659.25, 783.99, 659.25, 523.25],
      bass: 110,
      tempo: 900,
      padType: 'sine',
      arpType: 'triangle'
    },
    {
      id: 'focus',
      name: 'Deep Focus',
      pad: [146.83, 220, 293.66],
      arp: [293.66, 349.23, 440, 523.25, 440, 349.23],
      bass: 73.42,
      tempo: 1000,
      padType: 'sine',
      arpType: 'sine'
    },
    {
      id: 'spark',
      name: 'Gentle Spark',
      pad: [261.63, 329.63, 392],
      arp: [523.25, 587.33, 659.25, 783.99, 659.25, 587.33],
      bass: 130.81,
      tempo: 750,
      padType: 'triangle',
      arpType: 'sine'
    }
  ];

  function getCtx() {
    if (!ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) ctx = new AC();
      } catch (e) {
        return null;
      }
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(function () {});
    }
    return ctx;
  }

  function sfxEnabled() {
    try { return Storage.loadSettings().sfx !== false; } catch (e) { return true; }
  }

  function musicEnabled() {
    try { return Storage.loadSettings().music !== false; } catch (e) { return true; }
  }

  function playNotes(notes, volume) {
    volume = volume || 0.08;
    if (!sfxEnabled()) return;
    var ac = getCtx();
    if (!ac) return;
    var t = ac.currentTime;
    notes.forEach(function (n) {
      var osc = ac.createOscillator();
      var gain = ac.createGain();
      osc.type = n.type || 'sine';
      osc.frequency.value = n.freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(volume, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + (n.dur || 0.12));
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t);
      osc.stop(t + (n.dur || 0.12) + 0.02);
      t += (n.dur || 0.12) + (n.gap || 0.04);
    });
  }

  function toastAchievement() {
    playNotes([{ freq: 523, dur: 0.1 }, { freq: 659, dur: 0.1 }, { freq: 784, dur: 0.18 }], 0.09);
  }
  function toastMission() {
    playNotes([{ freq: 440, dur: 0.1 }, { freq: 554, dur: 0.14 }], 0.08);
  }
  function toastReward() {
    playNotes([{ freq: 587, dur: 0.08 }, { freq: 740, dur: 0.08 }, { freq: 880, dur: 0.16 }], 0.09);
  }
  function toastInfo() {
    playNotes([{ freq: 520, dur: 0.12 }], 0.06);
  }
  function click() {
    playNotes([{ freq: 600, dur: 0.04, type: 'square' }], 0.03);
  }
  function correct() {
    playNotes([{ freq: 523, dur: 0.08 }, { freq: 784, dur: 0.12 }], 0.07);
  }
  function wrong() {
    playNotes([{ freq: 200, dur: 0.15, type: 'triangle' }], 0.06);
  }
  function purchase() {
    playNotes([{ freq: 400, dur: 0.06 }, { freq: 600, dur: 0.06 }, { freq: 800, dur: 0.12 }], 0.08);
  }

  function stopMusic() {
    musicPlaying = false;
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    musicNodes.forEach(function (n) {
      try { if (n.stop) n.stop(); if (n.disconnect) n.disconnect(); } catch (e) {}
    });
    musicNodes = [];
    if (masterMusicGain) {
      try { masterMusicGain.disconnect(); } catch (e) {}
      masterMusicGain = null;
    }
  }

  function startPad(ac, master, freqs, type) {
    freqs.forEach(function (freq, i) {
      var osc = ac.createOscillator();
      var gain = ac.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      var vol = 0.018 - i * 0.003;
      gain.gain.setValueAtTime(0, ac.currentTime);
      gain.gain.linearRampToValueAtTime(Math.max(0.006, vol), ac.currentTime + 1.5);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      musicNodes.push(osc, gain);
    });
  }

  function startBass(ac, master, freq) {
    var osc = ac.createOscillator();
    var gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, ac.currentTime);
    gain.gain.linearRampToValueAtTime(0.025, ac.currentTime + 2);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    musicNodes.push(osc, gain);
  }

  function playArpNote(ac, master, freq, type) {
    var osc = ac.createOscillator();
    var gain = ac.createGain();
    var t = ac.currentTime;
    osc.type = type || 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.04, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + 0.6);
  }

  function startMusic(trackId) {
    if (!musicEnabled()) return;
    stopMusic();
    var ac = getCtx();
    if (!ac) return;

    var track;
    if (typeof trackId === 'string') {
      track = TRACKS.filter(function (t) { return t.id === trackId; })[0] || TRACKS[0];
      currentTrack = TRACKS.indexOf(track);
    } else if (typeof trackId === 'number') {
      currentTrack = trackId % TRACKS.length;
      track = TRACKS[currentTrack];
    } else {
      track = TRACKS[currentTrack % TRACKS.length];
    }

    masterMusicGain = ac.createGain();
    masterMusicGain.gain.value = 0.7;
    masterMusicGain.connect(ac.destination);

    startPad(ac, masterMusicGain, track.pad, track.padType);
    startBass(ac, masterMusicGain, track.bass);

    var step = 0;
    musicPlaying = true;
    musicTimer = setInterval(function () {
      if (!musicPlaying || !musicEnabled()) { stopMusic(); return; }
      var freq = track.arp[step % track.arp.length];
      playArpNote(ac, masterMusicGain, freq, track.arpType);
      step++;
    }, track.tempo);
  }

  function isMusicPlaying() { return musicPlaying; }

  function nextTrack() {
    currentTrack = (currentTrack + 1) % TRACKS.length;
    if (musicPlaying) startMusic(currentTrack);
    return TRACKS[currentTrack];
  }

  function getTracks() {
    return TRACKS.map(function (t, i) { return { id: t.id, name: t.name, index: i }; });
  }

  function getCurrentTrack() {
    return TRACKS[currentTrack % TRACKS.length];
  }

  function onMusicSettingChange(enabled) {
    if (!enabled) stopMusic();
  }

  return {
    toastAchievement: toastAchievement,
    toastMission: toastMission,
    toastReward: toastReward,
    toastInfo: toastInfo,
    click: click,
    correct: correct,
    wrong: wrong,
    purchase: purchase,
    startMusic: startMusic,
    stopMusic: stopMusic,
    isMusicPlaying: isMusicPlaying,
    nextTrack: nextTrack,
    getTracks: getTracks,
    getCurrentTrack: getCurrentTrack,
    onMusicSettingChange: onMusicSettingChange
  };
})();
