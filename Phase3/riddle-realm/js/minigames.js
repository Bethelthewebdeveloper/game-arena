/**
 * Game Arena Phase 2 — six replayable minigames.
 * Rewards only apply through Arena.finishSession.
 */
const MiniGames = (function () {
  'use strict';

  let active = null;

  const WORDS = {
    easy: ['GAME', 'PLAY', 'FAST', 'WORD', 'TEAM', 'GOAL', 'MIND', 'FIRE', 'STAR', 'JUMP'],
    medium: ['ARENA', 'PUZZLE', 'MEMORY', 'STREAK', 'SCORE', 'BRAIN', 'FLASH', 'RIVAL', 'QUEST', 'LIGHT'],
    hard: ['CHALLENGE', 'VICTORY', 'STRATEGY', 'PRECISION', 'REACTION', 'CHAMPION', 'KNOWLEDGE', 'MOMENTUM'],
    expert: ['REPLAYABILITY', 'COMPETITIVE', 'VOCABULARY', 'LEADERBOARD', 'ACHIEVEMENT']
  };
  const ODD = {
    easy: [['CAT', 'DOG', 'BIRD', 'CAR'], ['RED', 'BLUE', 'GREEN', 'SHOE']],
    medium: [['APPLE', 'PEAR', 'MANGO', 'CHAIR'], ['SOCCER', 'TENNIS', 'RUGBY', 'PIANO']],
    hard: [['MERCURY', 'VENUS', 'MARS', 'OCEAN'], ['SONNET', 'HAIKU', 'NOVEL', 'CIRCUIT']],
    expert: [['ALGORITHM', 'COMPILER', 'RUNTIME', 'SONATA'], ['EQUATOR', 'LATITUDE', 'MONSOON', 'INTEGER']]
  };
  const TRIVIA = {
    'General Knowledge': [
      { q: 'How many minutes are in one hour?', a: ['60', '30', '90', '45'], i: 0, d: 'easy' },
      { q: 'Which ocean is the largest?', a: ['Pacific', 'Atlantic', 'Indian', 'Arctic'], i: 0, d: 'medium' },
      { q: 'What is the capital of Japan?', a: ['Kyoto', 'Osaka', 'Tokyo', 'Nagoya'], i: 2, d: 'easy' }
    ],
    Science: [
      { q: 'Water freezes at what Celsius temperature?', a: ['0', '10', '32', '100'], i: 0, d: 'easy' },
      { q: 'What gas do plants absorb?', a: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Helium'], i: 2, d: 'medium' },
      { q: 'How many planets are in our solar system?', a: ['7', '8', '9', '10'], i: 1, d: 'easy' }
    ],
    Technology: [
      { q: 'HTML is used to build what?', a: ['Web pages', 'Cars', 'Recipes', 'Music'], i: 0, d: 'easy' },
      { q: 'What does CPU stand for?', a: ['Central Processing Unit', 'Computer Power Utility', 'Core Program User', 'Cache Process Upload'], i: 0, d: 'medium' },
      { q: 'Which company created the iPhone?', a: ['Google', 'Apple', 'Samsung', 'Nokia'], i: 1, d: 'easy' }
    ],
    History: [
      { q: 'In which century did World War II end?', a: ['18th', '19th', '20th', '21st'], i: 2, d: 'medium' },
      { q: 'Ancient pyramids are most associated with which country?', a: ['Peru', 'Egypt', 'China', 'Italy'], i: 1, d: 'easy' }
    ],
    Geography: [
      { q: 'Which continent is Egypt in?', a: ['Asia', 'Europe', 'Africa', 'Australia'], i: 2, d: 'easy' },
      { q: 'What is the longest river often named with the Nile?', a: ['Amazon', 'Nile', 'Danube', 'Thames'], i: 1, d: 'medium' }
    ],
    Sports: [
      { q: 'How many players are on a soccer team on the field?', a: ['9', '10', '11', '12'], i: 2, d: 'easy' },
      { q: 'A basketball hoop is how many feet high?', a: ['8', '10', '12', '15'], i: 1, d: 'medium' }
    ],
    Entertainment: [
      { q: 'Which instrument has 88 keys?', a: ['Guitar', 'Piano', 'Flute', 'Drum'], i: 1, d: 'easy' },
      { q: 'A movie is typically measured in?', a: ['Minutes', 'Tons', 'Watts', 'Acres'], i: 0, d: 'easy' }
    ],
    Nature: [
      { q: 'Bees are best known for making?', a: ['Silk', 'Honey', 'Wool', 'Paper'], i: 1, d: 'easy' },
      { q: 'The largest land animal is the?', a: ['Giraffe', 'Hippo', 'African elephant', 'Rhino'], i: 2, d: 'medium' }
    ],
    Business: [
      { q: 'Profit equals revenue minus?', a: ['Taxes only', 'Costs', 'Customers', 'Ads'], i: 1, d: 'medium' },
      { q: 'A company logo is part of its?', a: ['Brand', 'Payroll', 'Warehouse', 'Tax form'], i: 0, d: 'easy' }
    ]
  };

  function $(id) { return document.getElementById(id); }

  function showPanel(name) {
    ['mg-setup', 'mg-play', 'mg-results'].forEach(function (id) {
      const el = $(id);
      if (el) el.hidden = id !== name;
    });
  }

  function start(gameId) {
    const def = Arena.gameById(gameId);
    if (!def || def.id === 'riddle') {
      if (typeof UI !== 'undefined') UI.showScreen('home');
      return;
    }
    active = { id: gameId, def: def };
    if (typeof UI !== 'undefined') UI.showScreen('minigame');
    renderSetup();
  }

  function renderSetup() {
    const box = $('mg-setup');
    if (!box || !active) return;
    showPanel('mg-setup');
    const modes = modesFor(active.id);
    const diffs = ['easy', 'medium', 'hard', 'expert'];
    box.innerHTML =
      '<div class="panel-header"><h2>' + active.def.emoji + ' ' + active.def.title + '</h2><p class="panel-sub">' + active.def.blurb + '</p></div>' +
      '<label class="mp-label">Mode</label><select id="mg-mode" class="mp-input">' +
      modes.map(function (m) { return '<option value="' + m.id + '">' + m.label + '</option>'; }).join('') +
      '</select><label class="mp-label">Difficulty</label><select id="mg-diff" class="mp-input">' +
      diffs.map(function (d) { return '<option value="' + d + '">' + d[0].toUpperCase() + d.slice(1) + '</option>'; }).join('') +
      '</select><button type="button" class="btn-primary" id="mg-go">Start</button>' +
      '<button type="button" class="btn-secondary" data-screen="library">Back to Library</button>';
    const go = $('mg-go');
    if (go) go.onclick = function () {
      launch($('mg-mode').value, $('mg-diff').value);
    };
  }

  function modesFor(id) {
    if (id === 'reflex') return [{ id: 'quick', label: 'Quick Reaction' }, { id: 'five', label: '5-Round Challenge' }, { id: 'ten', label: '10-Round Challenge' }, { id: 'endless', label: 'Endless Practice' }];
    if (id === 'memory') return [{ id: 'standard', label: 'Standard Board' }, { id: 'timed', label: 'Timed Board' }];
    if (id === 'penalty') return [{ id: 'five', label: '5-Shot Challenge' }, { id: 'sudden', label: 'Sudden Death' }, { id: 'practice', label: 'Practice' }];
    if (id === 'rps') return [{ id: 'quick', label: 'Quick Match' }, { id: 'bo3', label: 'Best of 3' }, { id: 'bo5', label: 'Best of 5' }, { id: 'endless', label: 'Endless Match' }];
    if (id === 'wordclash') return [{ id: 'quick', label: 'Quick Clash' }, { id: 'ten', label: '10-Round Clash' }, { id: 'time', label: 'Time Attack' }, { id: 'endless', label: 'Endless Word Challenge' }];
    if (id === 'trivia') return [{ id: 'quick', label: 'Quick Trivia' }, { id: 'ten', label: '10 Questions' }, { id: 'rush', label: 'Time Rush' }, { id: 'endless', label: 'Endless Trivia' }];
    return [{ id: 'quick', label: 'Quick' }];
  }

  function launch(mode, difficulty) {
    active.mode = mode;
    active.difficulty = difficulty;
    active.score = 0;
    active.round = 0;
    active.log = [];
    showPanel('mg-play');
    if (active.id === 'reflex') playReflex();
    else if (active.id === 'memory') playMemory();
    else if (active.id === 'penalty') playPenalty();
    else if (active.id === 'rps') playRps();
    else if (active.id === 'wordclash') playWord();
    else if (active.id === 'trivia') playTrivia();
  }

  function finish(meta, bonusXp, bonusCoins) {
    const out = Arena.finishSession({
      gameId: active.id,
      score: active.score,
      mode: active.mode,
      difficulty: active.difficulty,
      meta: meta || {},
      bonusXp: bonusXp || 0,
      bonusCoins: bonusCoins || 0
    });
    const box = $('mg-results');
    showPanel('mg-results');
    const ach = (out.achievements || []).map(function (a) { return a.name; }).join(', ');
    box.innerHTML =
      '<div class="panel-header"><h2>Results</h2></div>' +
      '<div class="glass" style="padding:16px">' +
      '<p class="player-name">' + (out.newRecord ? 'New personal best!' : 'Run complete') + '</p>' +
      '<p>Score: <strong>' + out.score + '</strong></p>' +
      '<p>XP: +' + out.xp + ' · Coins: +' + out.coins + '</p>' +
      '<p>Personal best: ' + (out.newRecord ? 'YES' : 'No') + '</p>' +
      (ach ? '<p>Achievements: ' + ach + '</p>' : '') +
      '</div>' +
      '<button type="button" class="btn-primary" id="mg-again">Play Again</button>' +
      '<button type="button" class="btn-secondary" data-screen="arena">Return to Game Arena</button>';
    const again = $('mg-again');
    if (again) again.onclick = function () { renderSetup(); };
    if (typeof UI !== 'undefined' && UI.refreshPlayerUI) UI.refreshPlayerUI();
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.isLoggedIn() && typeof API !== 'undefined') {
      API.request('/api/arena/result', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + Auth.getToken()
        },
        body: JSON.stringify({
          gameId: active.id,
          score: out.score,
          mode: active.mode,
          difficulty: active.difficulty,
          meta: meta || {}
        })
      }).catch(function () {});
    }
  }

  function playTargetRounds() {
    if (active.mode === 'quick') return 1;
    if (active.mode === 'five' || active.mode === 'bo3') return 5;
    if (active.mode === 'ten' || active.mode === 'bo5') return 10;
    return 99;
  }

  /* -------- Reflex -------- */
  function playReflex() {
    const play = $('mg-play');
    const times = [];
    const goal = active.mode === 'quick' ? 1 : active.mode === 'five' ? 5 : active.mode === 'ten' ? 10 : 8;
    let n = 0;
    let waiting = false;
    let armedAt = 0;
    let timer = null;
    const waitRange = { easy: [1400, 3800], medium: [1100, 3200], hard: [800, 2400], expert: [500, 1600] }[active.difficulty];

    function paint(state, msg) {
      play.innerHTML = '<p class="panel-sub">Round ' + (n + (state === 'go' || state === 'wait' ? 1 : 0)) + ' / ' + goal + '</p>' +
        '<button type="button" id="rf-pad" class="btn-primary" style="min-height:160px;width:100%;font-size:1.2rem">' + msg + '</button>' +
        '<p class="f-note" id="rf-note"></p>';
      const pad = $('rf-pad');
      pad.onclick = onTap;
      pad.dataset.state = state;
    }

    function arm() {
      waiting = true;
      paint('wait', 'Wait…');
      const delay = waitRange[0] + Math.floor(Math.random() * (waitRange[1] - waitRange[0]));
      timer = setTimeout(function () {
        armedAt = performance.now();
        waiting = false;
        paint('go', 'TAP!');
      }, delay);
    }

    function onTap() {
      const pad = $('rf-pad');
      if (!pad) return;
      if (pad.dataset.state === 'wait') {
        if (timer) clearTimeout(timer);
        times.push(null);
        n += 1;
        next('Too soon');
        return;
      }
      if (pad.dataset.state !== 'go') return;
      const ms = Math.round(performance.now() - armedAt);
      times.push(ms);
      n += 1;
      next(ms + ' ms');
    }

    function next(msg) {
      if (n >= goal) {
        const valid = times.filter(function (t) { return t != null; });
        const best = valid.length ? Math.min.apply(null, valid) : 0;
        const avg = valid.length ? Math.round(valid.reduce(function (a, b) { return a + b; }, 0) / valid.length) : 0;
        active.score = valid.length ? Math.max(0, 1200 - avg) + valid.length * 20 : 0;
        const prev = Arena.statsFor('reflex') || {};
        const bestMs = prev.bestMs && prev.bestMs > 0 ? Math.min(prev.bestMs, best || prev.bestMs) : best;
        finish({ bestMs: bestMs || prev.bestMs, avgMs: avg, rounds: n }, best && best < 250 ? 8 : 0, 0);
        return;
      }
      paint('ready', msg + ' · Next');
      $('rf-pad').onclick = function () { arm(); };
    }

    paint('ready', 'Tap to begin');
    $('rf-pad').onclick = function () { arm(); };
  }

  /* -------- Memory -------- */
  function playMemory() {
    const play = $('mg-play');
    const sizes = { easy: [3, 4], medium: [4, 4], hard: [4, 5], expert: [4, 6] }[active.difficulty];
    const pairs = (sizes[0] * sizes[1]) / 2;
    const icons = ['🌟', '🔥', '💎', '🎯', '⚽', '🧠', '⚡', '🍀', '🎵', '🚀', '🦊', '🌙'];
    let deck = [];
    for (let i = 0; i < pairs; i++) deck.push(icons[i % icons.length], icons[i % icons.length]);
    deck = deck.sort(function () { return Math.random() - 0.5; });
    let open = [];
    let matched = 0;
    let moves = 0;
    let mistakes = 0;
    const t0 = Date.now();
    const limit = active.mode === 'timed' ? ({ easy: 90, medium: 75, hard: 60, expert: 45 }[active.difficulty] * 1000) : 0;

    function render() {
      play.innerHTML = '<p class="panel-sub">Moves ' + moves + ' · Matches ' + matched + '/' + pairs + '</p>' +
        '<div style="display:grid;grid-template-columns:repeat(' + sizes[0] + ',1fr);gap:8px">' +
        deck.map(function (c, i) {
          const on = open.indexOf(i) >= 0 || c === null;
          return '<button type="button" class="btn-secondary" data-i="' + i + '" style="min-height:56px;font-size:1.3rem">' + (on ? (c || '✓') : '?') + '</button>';
        }).join('') + '</div>';
      play.querySelectorAll('[data-i]').forEach(function (btn) {
        btn.onclick = function () { flip(parseInt(btn.getAttribute('data-i'), 10)); };
      });
    }

    function flip(i) {
      if (deck[i] == null || open.indexOf(i) >= 0 || open.length === 2) return;
      if (limit && Date.now() - t0 > limit) return done();
      open.push(i);
      render();
      if (open.length < 2) return;
      moves += 1;
      if (deck[open[0]] === deck[open[1]]) {
        deck[open[0]] = null;
        deck[open[1]] = null;
        matched += 1;
        open = [];
        if (matched >= pairs) return done();
        render();
      } else {
        mistakes += 1;
        setTimeout(function () { open = []; render(); }, 500);
      }
    }

    function done() {
      const sec = Math.max(1, Math.round((Date.now() - t0) / 1000));
      active.score = Math.max(20, pairs * 80 - moves * 8 - mistakes * 12);
      const prev = Arena.statsFor('memory') || {};
      const fewest = prev.fewestMoves ? Math.min(prev.fewestMoves, moves) : moves;
      finish({ fewestMoves: fewest, bestTime: prev.bestTime ? Math.min(prev.bestTime, sec) : sec, lastMoves: moves }, mistakes === 0 ? 10 : 0, 0);
    }

    render();
  }

  /* -------- Penalty -------- */
  function playPenalty() {
    const play = $('mg-play');
    const zones = ['L', 'CL', 'C', 'CR', 'R'];
    let shot = 0;
    let goals = 0;
    let saves = 0;
    let misses = 0;
    const total = active.mode === 'practice' ? 8 : 5;
    const saveChance = { easy: 0.28, medium: 0.42, hard: 0.55, expert: 0.68 }[active.difficulty];

    function render(msg) {
      play.innerHTML = '<p class="panel-sub">Shot ' + Math.min(shot + 1, total) + ' / ' + total + ' · Goals ' + goals + '</p>' +
        '<p>' + (msg || 'Pick a corner') + '</p>' +
        '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px">' +
        zones.map(function (z) { return '<button type="button" class="btn-primary" data-z="' + z + '">' + z + '</button>'; }).join('') +
        '</div>';
      play.querySelectorAll('[data-z]').forEach(function (b) {
        b.onclick = function () { kick(b.getAttribute('data-z')); };
      });
    }

    function kick(zone) {
      const keeper = zones[Math.floor(Math.random() * zones.length)];
      const saved = Math.random() < saveChance && keeper === zone;
      const miss = !saved && Math.random() < ({ easy: 0.06, medium: 0.1, hard: 0.14, expert: 0.2 }[active.difficulty]);
      shot += 1;
      if (saved) { saves += 1; render('Saved! Keeper went ' + keeper); }
      else if (miss) { misses += 1; render('Wide! Keeper went ' + keeper); }
      else { goals += 1; render('GOAL! Keeper went ' + keeper); }
      if (shot >= total) {
        if (active.mode === 'sudden' && goals === saves) {
          active.score = goals * 120;
          finish({ goals: goals, saves: saves, shots: shot, perfect: goals === total ? 1 : 0 });
          return;
        }
        active.score = goals * 140 + (goals === total ? 80 : 0);
        const prev = Arena.statsFor('penalty') || {};
        finish({
          goals: (prev.goals || 0) + goals,
          shots: (prev.shots || 0) + shot,
          perfect: (prev.perfect || 0) + (goals === total ? 1 : 0)
        }, goals === total ? 12 : 0, goals === total ? 4 : 0);
      }
    }

    render();
  }

  /* -------- RPS -------- */
  function playRps() {
    const play = $('mg-play');
    const opts = ['Rock', 'Paper', 'Scissors'];
    let wins = 0, losses = 0, draws = 0, streak = 0, best = 0;
    const need = active.mode === 'quick' ? 1 : active.mode === 'bo3' ? 2 : active.mode === 'bo5' ? 3 : 6;

    function beat(a) { return { Rock: 'Paper', Paper: 'Scissors', Scissors: 'Rock' }[a]; }

    function render(msg) {
      play.innerHTML = '<p class="panel-sub">W ' + wins + ' · L ' + losses + ' · D ' + draws + ' · Streak ' + streak + '</p>' +
        '<p>' + (msg || 'Choose') + '</p>' +
        opts.map(function (o) { return '<button type="button" class="btn-primary" data-o="' + o + '">' + o + '</button>'; }).join(' ');
      play.querySelectorAll('[data-o]').forEach(function (b) {
        b.onclick = function () { turn(b.getAttribute('data-o')); };
      });
    }

    function turn(choice) {
      let opp = opts[Math.floor(Math.random() * 3)];
      if (active.difficulty === 'expert' && Math.random() < 0.35) opp = beat(choice);
      if (choice === opp) { draws += 1; streak = 0; render('Draw. Both ' + choice); }
      else if (beat(opp) === choice) { wins += 1; streak += 1; if (streak > best) best = streak; render('You win. ' + choice + ' beats ' + opp); }
      else { losses += 1; streak = 0; render('You lose. ' + opp + ' beats ' + choice); }
      if (active.mode !== 'endless' && (wins >= need || losses >= need)) done();
      if (active.mode === 'endless' && wins + losses + draws >= 8) done();
    }

    function done() {
      active.score = wins * 100 + draws * 20 + best * 15;
      const prev = Arena.statsFor('rps') || {};
      finish({
        wins: (prev.wins || 0) + wins,
        losses: (prev.losses || 0) + losses,
        bestWinStreak: Math.max(prev.bestWinStreak || 0, best)
      }, best >= 3 ? 6 : 0, 0);
    }

    render();
  }

  /* -------- Word Clash -------- */
  function playWord() {
    const play = $('mg-play');
    const bank = WORDS[active.difficulty] || WORDS.easy;
    const oddBank = ODD[active.difficulty] || ODD.easy;
    const goal = active.mode === 'quick' ? 4 : active.mode === 'ten' ? 10 : active.mode === 'time' ? 8 : 8;
    let n = 0, correct = 0, wrong = 0, combo = 0, bestCombo = 0;
    const t0 = Date.now();

    function scramble(w) {
      const a = w.split('');
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a.join('') === w ? scramble(w) : a.join('');
    }

    function nextQ() {
      if (n >= goal) return done();
      n += 1;
      const kind = n % 3;
      if (kind === 0) {
        const w = bank[Math.floor(Math.random() * bank.length)];
        const s = scramble(w);
        const choices = [w].concat(bank.filter(function (x) { return x !== w; }).slice(0, 3));
        ask('Unscramble: ' + s, choices.sort(function () { return Math.random() - 0.5; }), w);
      } else if (kind === 1) {
        const w = bank[Math.floor(Math.random() * bank.length)];
        const cut = Math.max(1, Math.floor(w.length / 3));
        const shown = w.slice(0, w.length - cut) + '_'.repeat(cut);
        ask('Complete: ' + shown, [w].concat(bank.filter(function (x) { return x !== w; }).slice(0, 3)).sort(function () { return Math.random() - 0.5; }), w);
      } else {
        const row = oddBank[Math.floor(Math.random() * oddBank.length)];
        ask('Find the odd word', row, row[row.length - 1]);
      }
    }

    function ask(title, choices, answer) {
      play.innerHTML = '<p class="panel-sub">Q ' + n + '/' + goal + ' · Combo ' + combo + '</p><h3>' + title + '</h3>' +
        choices.map(function (c) { return '<button type="button" class="btn-secondary" data-c="' + c + '">' + c + '</button>'; }).join('');
      play.querySelectorAll('[data-c]').forEach(function (b) {
        b.onclick = function () {
          if (b.getAttribute('data-c') === answer) { correct += 1; combo += 1; if (combo > bestCombo) bestCombo = combo; }
          else { wrong += 1; combo = 0; }
          nextQ();
        };
      });
    }

    function done() {
      active.score = correct * 90 + bestCombo * 20 - wrong * 15;
      const prev = Arena.statsFor('wordclash') || {};
      finish({
        solved: (prev.solved || 0) + correct,
        bestScore: Math.max(prev.bestScore || 0, active.score),
        bestCombo: Math.max(prev.bestCombo || 0, bestCombo)
      }, bestCombo >= 4 ? 8 : 0, 0);
    }

    nextQ();
  }

  /* -------- Trivia -------- */
  function playTrivia() {
    const play = $('mg-play');
    let pool = [];
    Object.keys(TRIVIA).forEach(function (cat) {
      TRIVIA[cat].forEach(function (item) {
        pool.push(Object.assign({ cat: cat }, item));
      });
    });
    if (active.difficulty === 'easy') pool = pool.filter(function (x) { return x.d !== 'hard'; });
    pool = pool.sort(function () { return Math.random() - 0.5; });
    const goal = active.mode === 'quick' ? 5 : active.mode === 'ten' ? 10 : 8;
    let n = 0, correct = 0, wrong = 0, streak = 0, best = 0;
    const limit = { easy: 16000, medium: 12000, hard: 9000, expert: 7000 }[active.difficulty];

    function nextQ() {
      if (n >= goal || n >= pool.length) return done();
      const item = pool[n];
      n += 1;
      let left = limit;
      play.innerHTML = '<p class="panel-sub">' + item.cat + ' · Q ' + n + '/' + goal + ' · Streak ' + streak + '</p>' +
        '<h3>' + item.q + '</h3><p id="tr-time"></p>' +
        item.a.map(function (opt, idx) { return '<button type="button" class="btn-secondary" data-i="' + idx + '">' + opt + '</button>'; }).join('');
      const tick = setInterval(function () {
        left -= 200;
        const t = $('tr-time');
        if (t) t.textContent = Math.max(0, Math.ceil(left / 1000)) + 's';
        if (left <= 0) { clearInterval(tick); wrong += 1; streak = 0; nextQ(); }
      }, 200);
      play.querySelectorAll('[data-i]').forEach(function (b) {
        b.onclick = function () {
          clearInterval(tick);
          if (parseInt(b.getAttribute('data-i'), 10) === item.i) {
            correct += 1; streak += 1; if (streak > best) best = streak;
            active.score += 80 + Math.floor(left / 200);
          } else { wrong += 1; streak = 0; }
          nextQ();
        };
      });
    }

    function done() {
      const prev = Arena.statsFor('trivia') || {};
      finish({
        answered: (prev.answered || 0) + correct + wrong,
        correct: (prev.correct || 0) + correct,
        bestStreak: Math.max(prev.bestStreak || 0, best),
        bestScore: Math.max(prev.bestScore || 0, active.score)
      }, best >= 4 ? 8 : 0, 0);
    }

    nextQ();
  }

  return { start: start };
})();
