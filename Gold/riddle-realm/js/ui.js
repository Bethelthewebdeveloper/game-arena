/**
 * Riddle Realm — UI Module
 * Handles navigation, theme, splash, and rendering game screens.
 * Phase 1: Makes the existing shell functional + adds playable game screen.
 */
const UI = (function () {
  'use strict';

  let currentScreen = 'home';
  let previousScreen = 'home';
  let timerRefreshId = null;

  // ---------- Helpers ----------
  function $(id) {
    return document.getElementById(id);
  }

  function qs(selector, parent = document) {
    return parent.querySelector(selector);
  }

  function qsa(selector, parent = document) {
    return Array.from(parent.querySelectorAll(selector));
  }

  // ---------- Theme ----------
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const sun = qs('.icon-sun');
    const moon = qs('.icon-moon');
    if (sun && moon) {
      if (theme === 'light') {
        sun.classList.add('hidden');
        moon.classList.remove('hidden');
      } else {
        sun.classList.remove('hidden');
        moon.classList.add('hidden');
      }
    }
    const settingsBtn = $('settings-theme-toggle');
    if (settingsBtn) {
      settingsBtn.textContent = theme === 'light' ? 'Light' : 'Dark';
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    Storage.saveSettings({ theme: next });
  }

  /**
   * Apply accessibility + preference settings to the document
   */
  function applyAccessibility(settings) {
    const s = settings || Storage.loadSettings();
    const root = document.documentElement;

    // Text size
    root.setAttribute('data-text-size', s.textSize || 'medium');

    // Reduced motion
    if (s.reducedMotion) root.setAttribute('data-reduced-motion', 'true');
    else root.removeAttribute('data-reduced-motion');

    // High contrast
    if (s.highContrast) root.setAttribute('data-high-contrast', 'true');
    else root.removeAttribute('data-high-contrast');

    // Sync UI controls if present
    const motion = $('toggle-motion');
    if (motion) motion.checked = !!s.reducedMotion;
    const contrast = $('toggle-contrast');
    if (contrast) contrast.checked = !!s.highContrast;
    qsa('.seg-btn[data-text-size]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.textSize === (s.textSize || 'medium'));
      btn.setAttribute('aria-pressed', btn.dataset.textSize === (s.textSize || 'medium') ? 'true' : 'false');
    });
  }

  function haptic(pattern) {
    const s = Storage.loadSettings();
    if (!s.haptic) return;
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(pattern || 12); } catch (e) {}
    }
  }

  // ---------- Screen Management ----------
  function showScreen(name) {
    // Founder screen is restricted; everything else is open (no login required)
    if (name === 'founder') {
      const u = typeof Auth !== 'undefined' ? Auth.getUser() : null;
      if (!u || u.role !== 'founder') {
        name = 'home';
      }
    }

    // Leave-game cleanup (performance + no lingering timers/music)
    if (currentScreen === 'game' && name !== 'game') {
      if (typeof AudioFX !== 'undefined') AudioFX.stopMusic();
      if (typeof Game !== 'undefined' && Game.stopTimer) Game.stopTimer();
      if (timerRefreshId) {
        clearInterval(timerRefreshId);
        timerRefreshId = null;
      }
    }

    const panels = qsa('.screen-panel');
    panels.forEach(p => {
      p.classList.remove('active');
      p.hidden = true;
    });

    const target = $(`screen-${name}`);
    if (target) {
      target.hidden = false;
      target.classList.add('active');
      // Scroll main content to top without smooth scroll when reduced motion
      try {
        const main = document.querySelector('main') || target;
        main.scrollTop = 0;
        window.scrollTo(0, 0);
      } catch (e) {}
    }

    // Bottom nav active state
    qsa('.bottom-nav-item').forEach(btn => {
      const isActive = btn.dataset.screen === name;
      btn.classList.toggle('active', isActive);
      if (isActive) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });

    // Back button visibility
    const backBtn = $('btn-back');
    const brand = $('brand');
    if (backBtn && brand) {
      if (name === 'home') {
        backBtn.classList.add('hidden');
        brand.classList.remove('hidden');
      } else {
        backBtn.classList.remove('hidden');
      }
    }

    previousScreen = currentScreen;
    currentScreen = name;
  }

  // ---------- Player UI refresh ----------
  function refreshPlayerUI() {
    const player = Storage.loadPlayer();

    const setText = (id, value) => {
      const el = $(id);
      if (el) el.textContent = value;
    };

    const level = player.level || 1;
    const xp = player.xp || 0;
    const xpNeeded = player.xpNeeded || 100;

    setText('player-name', player.name || 'Riddler');
    setText('profile-name', player.name || 'Riddler');
    setText('level-num', level);
    setText('coins-value', player.coins || 0);
    setText('hearts-value', player.hearts ?? 5);
    setText('xp-current', xp);
    setText('xp-needed', xpNeeded);

    // Home + profile summary stats
    setText('stat-solved', player.totalSolved || 0);
    setText('stat-streak', player.bestStreak || 0);

    const accuracy = Storage.getAccuracy(player);
    setText('stat-accuracy', accuracy == null ? '—' : accuracy + '%');

    // Full profile stats grid
    setText('stat-level', level);
    setText('stat-coins', player.coins || 0);
    setText('stat-best-score', player.bestScore || 0);
    setText('stat-games', player.gamesPlayed || 0);
    setText('stat-correct', player.totalCorrect || 0);
    setText('stat-wrong', player.totalWrong || 0);
    setText('profile-level-num', level);
    setText('profile-xp-text', `${xp} / ${xpNeeded} XP`);

    // XP bars (home + profile)
    const pct = Math.min(100, (xp / xpNeeded) * 100);
    const fill = $('xp-fill');
    if (fill) fill.style.width = pct + '%';
    const profileFill = $('profile-xp-fill');
    if (profileFill) profileFill.style.width = pct + '%';

    // Rank
    const rankEl = $('profile-rank');
    if (rankEl) rankEl.textContent = Storage.getRank(level);

    // Equipped avatar
    if (typeof Shop !== 'undefined') {
      const avatarEl = $('avatar-display');
      if (avatarEl) avatarEl.textContent = Shop.getAvatarEmoji();
    }

    // Hint statistics dashboard
    if (typeof Hints !== 'undefined' && Hints.getStats) {
      const hs = Hints.getStats();
      setText('hint-stat-total', hs.total);
      setText('hint-stat-spent', hs.coinsSpent);
      setText('hint-stat-clue', hs.byType.extra_clue || 0);
      setText('hint-stat-letter', hs.byType.reveal_letter || 0);
      setText('hint-stat-5050', hs.byType.remove_options || 0);
      setText('hint-stat-skip', hs.byType.skip || 0);
    }
  }

  // ---------- Achievements ----------
  function renderAchievements() {
    const list = $('achievements-list');
    if (!list || typeof Achievements === 'undefined') return;

    // Check for new unlocks
    Achievements.check();

    const items = Achievements.getAll();
    const unlocked = items.filter(a => a.unlocked).length;
    const sub = $('achievements-sub');
    if (sub) sub.textContent = `${unlocked} / ${items.length} unlocked`;

    list.innerHTML = items.map(a => {
      const status = a.claimed ? 'claimed' : (a.unlocked ? 'unlocked' : 'locked');
      const progressBar = a.locked
        ? `<div class="ach-progress"><div class="ach-progress-fill" style="width:${a.progress}%"></div></div>
           <span class="ach-progress-text">${a.value} / ${a.target}</span>`
        : '';
      const claimBtn = a.unlocked && !a.claimed
        ? `<button class="ach-claim-btn" data-ach="${a.id}">Claim +${a.reward.coins}🪙 +${a.reward.xp}XP</button>`
        : (a.claimed ? '<span class="ach-claimed-tag">Claimed ✓</span>' : '');
      return `
        <div class="ach-card glass ${status}">
          <div class="ach-emoji">${a.locked ? '🔒' : a.emoji}</div>
          <div class="ach-body">
            <div class="ach-name">${a.name}</div>
            <div class="ach-desc">${a.description}</div>
            ${progressBar}
            ${claimBtn}
          </div>
        </div>`;
    }).join('');

    qsa('.ach-claim-btn', list).forEach(btn => {
      btn.addEventListener('click', () => {
        const result = Achievements.claim(btn.dataset.ach);
        if (result.ok) {
          refreshPlayerUI();
          renderAchievements();
        }
      });
    });
  }

  /**
   * Toast notification system
   * @param {string} message
   * @param {object} opts - { emoji, type: 'achievement'|'mission'|'reward'|'info', duration }
   */
  function showToast(message, opts = {}) {
    const root = $('toast-root');
    if (!root) {
      console.log(message);
      return;
    }
    const emoji = opts.emoji || '✨';
    const type = opts.type || 'info';
    const duration = opts.duration || 3200;

    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span class="toast-emoji">${emoji}</span><span class="toast-msg">${message}</span>`;
    root.appendChild(el);

    // Sound effect for toast
    if (typeof AudioFX !== 'undefined') {
      if (type === 'achievement') AudioFX.toastAchievement();
      else if (type === 'mission') AudioFX.toastMission();
      else if (type === 'reward') AudioFX.toastReward();
      else AudioFX.toastInfo();
    }

    requestAnimationFrame(() => el.classList.add('toast-show'));

    setTimeout(() => {
      el.classList.remove('toast-show');
      el.classList.add('toast-hide');
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  function toastNewAchievements(newly) {
    if (!newly || !newly.length) return;
    newly.forEach((a, i) => {
      setTimeout(() => {
        showToast(`${a.name} unlocked!`, { emoji: a.emoji || '🏆', type: 'achievement', duration: 3500 });
      }, i * 400);
    });
  }

  function toastMissions(completed) {
    if (!completed || !completed.length) return;
    completed.forEach((m, i) => {
      setTimeout(() => {
        showToast(`${m.name} complete! Claim your reward`, {
          emoji: m.emoji || '🎯',
          type: 'mission',
          duration: 3500
        });
      }, i * 400);
    });
  }

  function _missionRowHtml(m) {
    const pct = Math.min(100, Math.floor((m.progress / m.target) * 100));
    const cls = m.claimed ? 'claimed' : (m.completed ? 'completed' : '');
    const action = m.completed && !m.claimed
      ? `<button class="mission-claim" data-mission="${m.id}">Claim +${m.reward.coins}🪙</button>`
      : (m.claimed
        ? '<span class="mission-done">✓</span>'
        : `<span class="mission-prog">${m.progress}/${m.target}</span>`);
    return `
      <div class="mission-row ${cls}">
        <span class="mission-emoji">${m.emoji}</span>
        <div class="mission-info">
          <div class="mission-name">${m.name} <span class="mission-diff diff-${m.difficulty || 'normal'}">${m.difficulty || 'normal'}</span></div>
          <div class="mission-desc">${m.description}</div>
          <div class="mission-bar"><div class="mission-bar-fill" style="width:${pct}%"></div></div>
        </div>
        <div class="mission-action">${action}</div>
      </div>`;
  }

  function renderMissions() {
    if (typeof Missions === 'undefined') return;
    const status = Missions.getStatus();
    const list = $('missions-list');
    const weeklyList = $('weekly-list');
    const countEl = $('missions-count');
    const weeklyCount = $('weekly-count');
    if (countEl) countEl.textContent = `${status.completedCount}/${status.total}`;
    if (weeklyCount) weeklyCount.textContent = `${status.weeklyCompleted}/${status.weeklyTotal}`;

    if (list) {
      list.innerHTML = status.missions.map(_missionRowHtml).join('');
    }
    if (weeklyList) {
      weeklyList.innerHTML = (status.weekly || []).map(_missionRowHtml).join('');
    }

    // History
    const histList = $('mission-history-list');
    if (histList) {
      const hist = status.history || [];
      if (!hist.length) {
        histList.innerHTML = '<p class="mission-hist-empty">No past days yet.</p>';
      } else {
        histList.innerHTML = hist.map(h =>
          `<div class="mission-hist-row"><span>${h.date}</span><span>${h.completed}/${h.total} done · ${h.claimed} claimed</span></div>`
        ).join('');
      }
    }

    qsa('.mission-claim').forEach(btn => {
      btn.addEventListener('click', () => {
        const result = Missions.claim(btn.dataset.mission);
        if (result.ok) {
          showToast(`+${result.reward.coins} coins · +${result.reward.xp} XP`, {
            emoji: '🎁',
            type: 'reward'
          });
          if (result.replacement) {
            setTimeout(() => {
              showToast(`New mission: ${result.replacement.name}`, {
                emoji: result.replacement.emoji || '🎯',
                type: 'mission',
                duration: 3000
              });
            }, 500);
          }
          refreshPlayerUI();
          renderMissions();
        }
      });
    });
  }

  /**
   * Central mission progress hook — call from gameplay events
   */
  function trackMission(type, amount = 1) {
    if (typeof Missions === 'undefined') return;
    const completed = Missions.record(type, amount);
    if (completed.length) {
      toastMissions(completed);
      renderMissions();
    }
  }

  // ---------- Game Screen Rendering ----------
  function renderGameScreen() {
    const gState = Game.getState();
    const riddle = Game.getCurrentRiddle();
    const container = $('game-container');
    if (!container) return;

    // Header stats
    const scoreEl = $('game-score');
    const livesEl = $('game-lives');
    const progressEl = $('game-progress');
    const progressFill = $('game-progress-fill');
    if (scoreEl) scoreEl.textContent = gState.score;

    // Lives: hide in timed mode (unlimited), show capped in others
    if (livesEl) {
      if (gState.mode === 'timed') {
        livesEl.textContent = '⏱️';
        livesEl.setAttribute('aria-label', 'Timed mode');
      } else {
        const shownLives = Math.min(gState.lives, gState.maxLives);
        const empty = Math.max(0, gState.maxLives - shownLives);
        livesEl.textContent = '❤️'.repeat(shownLives) + (empty ? '🖤'.repeat(Math.min(empty, 5)) : '');
        livesEl.setAttribute('aria-label', `${gState.lives} lives remaining`);
      }
    }

    // Progress / timer
    if (progressEl) {
      if (gState.mode === 'timed' && gState.timeLeft != null) {
        progressEl.textContent = `${gState.timeLeft}s`;
        progressEl.style.color = gState.timeLeft <= 10 ? 'var(--danger)' : '';
      } else if (gState.progress.total == null) {
        progressEl.textContent = `#${gState.progress.current}`;
      } else {
        progressEl.textContent = `${gState.progress.current} / ${gState.progress.total}`;
      }
    }
    if (progressFill) {
      if (gState.mode === 'timed' && gState.timeLimit) {
        const pct = Math.max(0, (gState.timeLeft / gState.timeLimit) * 100);
        progressFill.style.width = pct + '%';
      } else if (gState.progress.total > 0) {
        const pct = Math.min(100, (gState.progress.current / gState.progress.total) * 100);
        progressFill.style.width = pct + '%';
      } else {
        progressFill.style.width = '0%';
      }
    }

    // Game over view
    if (gState.status === Game.STATE.GAMEOVER) {
      if (typeof Game.recordSessionEnd === 'function') {
        Game.recordSessionEnd();
      }
      // Stop music and record local leaderboard
      if (typeof AudioFX !== 'undefined') AudioFX.stopMusic();
      if (typeof Leaderboard !== 'undefined') {
        Leaderboard.record({
          score: gState.score,
          mode: gState.mode,
          category: gState.category,
          correctCount: gState.correctCount
        });
      }
      if (typeof Analytics !== 'undefined') {
        const started = window.__gameStartedAt || Date.now();
        Analytics.track('game_complete', {
          mode: gState.mode,
          score: gState.score,
          durationMs: Date.now() - started
        });
      }

      let dailyBonusNote = '';
      let dailyResult = null;
      if (gState.isDaily && typeof Daily !== 'undefined') {
        dailyResult = Daily.completeChallenge(gState);
        if (typeof Streaks !== 'undefined') {
          Streaks.onDailyCompleted(dailyResult.streak);
        }
        dailyBonusNote =
          `<p class="daily-bonus">📅 Daily complete! Bonus +${Daily.BONUS_XP} XP · +${Daily.BONUS_COINS} coins<br>` +
          `Daily streak: 🔥 ${dailyResult.streak} day${dailyResult.streak === 1 ? '' : 's'} · Score: ${dailyResult.score}</p>`;
      }

      const player = Storage.loadPlayer();
      const isNewBest = gState.score > 0 && gState.score >= (player.bestScore || 0);

      const modeTitles = {
        daily: 'Daily Challenge Done!',
        timed: gState.timerExpired ? "Time's Up!" : 'Timed Run Complete!',
        survival: 'Survival Over!',
        classic: gState.lives <= 0 ? 'Out of Lives!' : 'Classic Complete!',
        category: gState.lives <= 0 ? 'Out of Lives!' : 'Category Complete!'
      };
      const modeIcons = {
        daily: '📅', timed: '⏱️', survival: '💀', classic: '🎯', category: '📂'
      };
      const overTitle = modeTitles[gState.mode] || (gState.lives <= 0 ? 'Out of Lives!' : 'Session Complete!');
      const overIcon = modeIcons[gState.mode] || (gState.lives <= 0 ? '💔' : '🏁');

      const dailyShareBlock = gState.isDaily
        ? `<div class="daily-share-block">
            <p class="daily-share-label">Share my result</p>
            <div class="daily-share-actions">
              <button class="btn-primary" id="btn-share-daily" type="button">Share My Result</button>
              <button class="btn-secondary" id="btn-share-daily-wa" type="button">WhatsApp</button>
              <button class="btn-secondary" id="btn-share-daily-copy" type="button">Copy result</button>
            </div>
          </div>`
        : '';

      container.innerHTML = `
        <div class="game-over-card glass">
          <div class="game-over-icon">${overIcon}</div>
          <h2>${overTitle}</h2>
          <p class="game-over-score">Score: <strong>${gState.score}</strong></p>
          ${isNewBest ? '<p class="new-best">🎉 New Best Score!</p>' : ''}
          ${dailyBonusNote}
          <p class="game-over-stats">
            Correct: ${gState.correctCount} · Wrong: ${gState.wrongCount}<br>
            XP earned: +${gState.totalXpEarned}${gState.isDaily ? ` (+${Daily.BONUS_XP} bonus)` : ''} · Coins: +${gState.totalCoinsEarned}${gState.isDaily ? ` (+${Daily.BONUS_COINS} bonus)` : ''}<br>
            Level ${player.level} · ${Storage.getRank(player.level)}
          </p>
          ${dailyShareBlock}
          <div class="game-over-actions">
            ${gState.isDaily
              ? '<button class="btn-primary" id="btn-back-home">Back to Home</button>'
              : '<button class="btn-primary" id="btn-play-again">Play Again</button><button class="btn-secondary" id="btn-back-home">Home</button>'
            }
            <button class="btn-secondary" id="btn-share-challenge" type="button">Challenge a Friend</button>
          </div>
        </div>
      `;
      const again = $('btn-play-again');
      const home = $('btn-back-home');
      if (again) again.addEventListener('click', () => {
        Game.restart();
        renderGameScreen();
      });
      if (home) home.addEventListener('click', () => {
        showScreen('home');
        refreshPlayerUI();
        renderDailyStatus();
      });

      async function handleDailyShare(channel) {
        if (typeof Share === 'undefined') return;
        const st = dailyResult || (typeof Daily !== 'undefined' ? Daily.getStatus() : {});
        const result = await Share.shareDailyResult({
          score: st.score != null ? st.score : gState.score,
          streak: st.streak || 0,
          correct: st.correct != null ? st.correct : gState.correctCount,
          date: st.date || (typeof Daily !== 'undefined' ? Daily.todayKey() : ''),
          dateKey: st.date || null,
          channel: channel || null
        });
        if (!result.ok && result.reason === 'cancelled') return;
        if (result.method === 'clipboard' || result.method === 'manual') {
          showToast('Result copied — paste anywhere to share!', { emoji: '📤', type: 'info' });
        } else if (result.method === 'whatsapp') {
          showToast('WhatsApp share opened', { emoji: '📤', type: 'info' });
        } else if (result.method === 'webshare') {
          showToast('Share sheet opened', { emoji: '📤', type: 'reward' });
        }
      }

      const shareDaily = $('btn-share-daily');
      if (shareDaily) shareDaily.addEventListener('click', () => handleDailyShare(null));
      const shareWa = $('btn-share-daily-wa');
      if (shareWa) shareWa.addEventListener('click', () => handleDailyShare('whatsapp'));
      const shareCopy = $('btn-share-daily-copy');
      if (shareCopy) shareCopy.addEventListener('click', () => handleDailyShare('copy'));

      const shareBtn = $('btn-share-challenge');
      if (shareBtn && typeof Share !== 'undefined') {
        shareBtn.addEventListener('click', async () => {
          const result = await Share.shareChallenge({
            score: gState.score,
            mode: gState.mode,
            category: gState.category,
            correctCount: gState.correctCount
          });
          if (result.ok && result.method === 'clipboard') {
            showToast('Challenge copied — paste to a friend!', { emoji: '📤', type: 'info' });
          } else if (result.ok && result.method === 'webshare') {
            showToast('Challenge shared!', { emoji: '📤', type: 'reward' });
          } else if (result.ok && result.method === 'manual' && result.text) {
            showToast('Copy this: ' + result.text.slice(0, 60) + '…', { emoji: '📤', type: 'info', duration: 5000 });
          }
        });
      }
      refreshPlayerUI();
      renderDailyStatus();
      if (typeof Achievements !== 'undefined') {
        const newly = Achievements.check();
        toastNewAchievements(newly);
      }
      // Mission progress on session end
      trackMission('games', 1);
      if (gState.isDaily) trackMission('daily', 1);
      if (gState.mode === 'timed') trackMission('timed_complete', 1);
      if (gState.mode === 'category') trackMission('category_complete', 1);
      if (gState.totalXpEarned) trackMission('xp', 0); // already counted per-answer; no double
      renderMissions();
      return;
    }

    // Feedback view
    if (gState.status === Game.STATE.FEEDBACK && gState.lastResult) {
      const res = gState.lastResult;
      const levelUpHtml = res.leveledUp
        ? `<p class="level-up-banner">⭐ Level Up! You are now Level ${res.newLevel}</p>`
        : '';
      const isSkip = !!res.skipped;
      const fbClass = isSkip ? 'skipped' : (res.correct ? 'correct' : 'wrong');
      const fbIcon = isSkip ? '⏭️' : (res.correct ? '✅' : '❌');
      const fbTitle = isSkip ? 'Skipped' : (res.correct ? 'Correct!' : 'Not quite');
      container.innerHTML = `
        <div class="feedback-card glass ${fbClass}">
          <div class="feedback-icon">${fbIcon}</div>
          <h3>${fbTitle}</h3>
          ${isSkip
            ? `<p class="feedback-answer">Moved to next riddle</p>`
            : (res.correct
              ? `<p class="feedback-reward">+${res.earnedXp} XP · +${res.earnedCoins} coins</p>`
              : `<p class="feedback-answer">Answer: <strong>${res.riddle.answer}</strong></p>`)
          }
          ${levelUpHtml}
          ${(!isSkip && res.explanation) ? `<p class="feedback-explain">${res.explanation}</p>` : ''}
          <button class="btn-primary" id="btn-next-riddle">
            ${Game.isGameOver() ? 'See Results' : 'Next Riddle'}
          </button>
        </div>
      `;
      const nextBtn = $('btn-next-riddle');
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          const hasNext = Game.next();
          renderGameScreen();
          if (!hasNext) refreshPlayerUI();
        });
      }
      return;
    }

    // Playing view
    if (!riddle) {
      container.innerHTML = `<div class="placeholder-card glass"><p>No riddle loaded.</p></div>`;
      return;
    }

    // Reset hint usage when landing on a new riddle index
    if (typeof Hints !== 'undefined') {
      const u = Hints.getUsage();
      // Heuristic: if no usage yet this render cycle is fine; onNewRiddle is called on next()
    }

    const usage = typeof Hints !== 'undefined' ? Hints.getUsage() : { removedOptions: [], revealedIndexes: [], clueShown: false };
    const playerCoins = Storage.loadPlayer().coins || 0;
    const diffClass = riddle.difficulty ? `diff-${riddle.difficulty}` : '';

    // Build letter reveal display if any letters revealed
    let letterHtml = '';
    if (usage.revealedIndexes && usage.revealedIndexes.length) {
      const answer = String(riddle.answer);
      const display = answer.split('').map((ch, i) => {
        if (!/[a-zA-Z0-9]/.test(ch)) return ch === ' ' ? '&nbsp;&nbsp;' : ch;
        return usage.revealedIndexes.includes(i)
          ? `<span class="letter-revealed">${ch.toUpperCase()}</span>`
          : `<span class="letter-hidden">_</span>`;
      }).join(' ');
      letterHtml = `<div class="letter-reveal" aria-label="Revealed letters">${display}</div>`;
    }

    // Clue panel
    let clueHtml = '';
    if (usage.clueShown && riddle.hint) {
      clueHtml = `<div class="clue-panel">💡 ${riddle.hint}</div>`;
    }

    // Options — mark removed ones
    const removed = new Set(usage.removedOptions || []);
    const optionsHtml = (riddle.options || []).map((opt) => {
      const safe = String(opt).replace(/"/g, '&quot;');
      const isRemoved = removed.has(opt);
      return `<button class="option-btn${isRemoved ? ' option-removed' : ''}" data-answer="${safe}" ${isRemoved ? 'disabled' : ''}>${opt}</button>`;
    }).join('');

    // Hint toolbar
    const hintCfg = typeof Hints !== 'undefined' ? Hints.getConfig() : {};
    const hintBtns = ['extra_clue', 'reveal_letter', 'remove_options', 'skip'].map(type => {
      const cfg = hintCfg[type];
      if (!cfg) return '';
      const afford = playerCoins >= cfg.cost;
      const disabledExtra = type === 'extra_clue' && usage.clueShown;
      const disabledRemove = type === 'remove_options' && removed.size >= 2;
      const isDisabled = !afford || disabledExtra || disabledRemove;
      return `<button class="hint-btn${!afford ? ' hint-locked' : ''}" data-hint="${type}" ${isDisabled ? 'disabled' : ''} title="${cfg.description}">
        <span class="hint-emoji">${cfg.emoji}</span>
        <span class="hint-label">${cfg.label}</span>
        <span class="hint-cost">${cfg.cost}🪙</span>
      </button>`;
    }).join('');

    container.innerHTML = `
      <div class="riddle-card glass">
        <div class="riddle-meta">
          <span class="riddle-cat">${riddle.category}</span>
          <span class="riddle-diff ${diffClass}">${riddle.difficulty || 'normal'}</span>
        </div>
        <h2 class="riddle-question">${riddle.question}</h2>
        ${letterHtml}
        ${clueHtml}
        <div class="options-grid">
          ${optionsHtml}
        </div>
      </div>
      <div class="hint-bar" id="hint-bar">
        ${hintBtns}
      </div>
      <div class="ai-bar" id="ai-bar">
        <button type="button" class="ai-mini-btn" data-ai="hint">🤖 AI Hint</button>
        <button type="button" class="ai-mini-btn" data-ai="explain">📖 Explain</button>
        <button type="button" class="ai-mini-btn" data-ai="ask">❓ Ask</button>
      </div>
      <div class="ai-inline-out glass" id="ai-inline-out" hidden></div>
    `;

    // Bind AI mini buttons
    qsa('[data-ai]', container).forEach(btn => {
      btn.addEventListener('click', async () => {
        if (typeof AIService === 'undefined') return;
        const kind = btn.dataset.ai;
        const out = $('ai-inline-out');
        if (out) { out.hidden = false; out.textContent = 'Thinking…'; }
        let res;
        if (kind === 'hint') {
          const advanced = typeof Entitlements !== 'undefined' && Entitlements.hasFeature('ai_advanced_hint');
          res = await AIService.generateHint({ riddle, advanced });
        } else if (kind === 'explain') {
          res = await AIService.explainRiddle({ riddle });
        } else if (kind === 'ask') {
          const q = window.prompt('Ask about this riddle:', 'Any tip without the full answer?');
          if (q == null) { if (out) out.hidden = true; return; }
          res = await AIService.answerQuestion({ riddle, question: q });
        }
        if (out) {
          out.textContent = res && res.success ? res.content : (res && res.content) || 'AI unavailable.';
          out.classList.toggle('ai-error', !(res && res.success));
        }
        if (typeof renderAiDashboard === 'function') { /* noop if not on AI screen */ }
      });
    });

    // Bind option clicks
    qsa('.option-btn:not(.option-removed)', container).forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return; // prevent double-tap
        const answer = btn.dataset.answer;
        const allBtns = qsa('.option-btn', container);
        allBtns.forEach(b => b.disabled = true);

        const result = Game.submitAnswer(answer);
        if (result) {
          if (typeof Analytics !== 'undefined') {
            Analytics.track('answer', {
              correct: !!result.correct,
              category: result.riddle && result.riddle.category,
              difficulty: result.riddle && result.riddle.difficulty
            });
          }
          if (result.correct) {
            btn.classList.add('selected-correct');
            if (typeof AudioFX !== 'undefined') AudioFX.correct();
            haptic(10);
          } else {
            btn.classList.add('selected-wrong');
            if (typeof AudioFX !== 'undefined') AudioFX.wrong();
            haptic([20, 40, 20]);
            allBtns.forEach(b => {
              if (Riddles.checkAnswer(result.riddle, b.dataset.answer)) {
                b.classList.add('show-correct');
              }
            });
          }
          if (result.correct) {
            if (typeof Achievements !== 'undefined') {
              const newly = Achievements.check();
              toastNewAchievements(newly);
            }
            trackMission('correct', 1);
            // no-hint correct: if no hints used this riddle
            if (typeof Hints !== 'undefined') {
              const u = Hints.getUsage();
              const usedHint = (u.revealedIndexes && u.revealedIndexes.length) ||
                (u.removedOptions && u.removedOptions.length) || u.clueShown;
              if (!usedHint) trackMission('no_hint_correct', 1);
            } else {
              trackMission('no_hint_correct', 1);
            }
            // session streak
            const st = Game.getState();
            if (st.currentStreak >= 3) trackMission('session_streak', 3);
            // XP earned this answer
            if (result.earnedXp) trackMission('xp', result.earnedXp);
          }
          setTimeout(() => renderGameScreen(), 480);
        } else {
          renderGameScreen();
        }
      });
    });

    // Bind hint buttons
    qsa('.hint-btn', container).forEach(btn => {
      btn.addEventListener('click', () => {
        if (typeof Hints === 'undefined') return;
        const type = btn.dataset.hint;
        const result = Hints.use(type, riddle);

        if (!result.ok) {
          if (result.reason === 'not_enough_coins') {
            btn.classList.add('hint-shake');
            setTimeout(() => btn.classList.remove('hint-shake'), 400);
          }
          return;
        }

        refreshPlayerUI(); // update coin display

        if (type === 'skip') {
          // Skip: move on without scoring
          if (typeof Hints !== 'undefined') Hints.onNewRiddle();
          const hasNext = Game.next();
          // If still on same index logic — force advance by treating as soft next
          // Game.next() only works from FEEDBACK; so force a neutral feedback path
          // Instead: mark feedback as skip then next
          // Simpler: use a dedicated skip in engine — for now inject feedback state
          _handleSkip();
          return;
        }

        // Re-render to show letter / removed options / clue
        renderGameScreen();
      });
    });
  }

  /**
   * Skip current riddle without awarding points
   */
  function _handleSkip() {
    // Move to feedback-like skip then advance
    const gState = Game.getState();
    // Use next by forcing status — call internal advance via submitting nothing
    // Clean approach: forceGame path
    if (Game.getState().status === Game.STATE.PLAYING) {
      // Manually advance: call next after faking feedback is awkward.
      // Use a lightweight skip on the engine if available, else:
      const st = Game.getState();
      // Submit a guaranteed-wrong empty and then undo isn't ideal.
      // Best: expose skip on Game — call next after setting feedback.
    }
    // Practical approach for Phase 8: mark as wrong with 0 life cost via a flag
    // We'll add Game.skipRiddle() 
    if (typeof Game.skipRiddle === 'function') {
      Game.skipRiddle();
      if (typeof Hints !== 'undefined') Hints.onNewRiddle();
      renderGameScreen();
    } else {
      // Fallback: go to next if possible by completing feedback cycle
      const hasNext = Game.next();
      if (typeof Hints !== 'undefined') Hints.onNewRiddle();
      renderGameScreen();
      if (!hasNext) refreshPlayerUI();
    }
  }

  // ---------- Start a game from category ----------
  function startCategoryGame(category) {
    const ok = typeof Game.startCategory === 'function'
      ? Game.startCategory(category)
      : Game.start(category, 8);
    if (!ok) {
      showScreen('categories');
      const grid = $('category-grid');
      if (grid) {
        const note = document.createElement('div');
        note.className = 'placeholder-card glass small';
        note.style.marginTop = '14px';
        note.innerHTML = `<p>No riddles in this category yet. Try Logic, Math, Science, or General.</p>`;
        const old = grid.parentElement.querySelector('.temp-empty-note');
        if (old) old.remove();
        note.classList.add('temp-empty-note');
        grid.parentElement.appendChild(note);
        setTimeout(() => note.remove(), 3500);
      }
      return;
    }
    showScreen('game');
    renderGameScreen();
    _bindTimerRefresh();
    if (typeof AudioFX !== 'undefined') AudioFX.startMusic();
    if (typeof Analytics !== 'undefined') Analytics.track('game_start', { mode: 'category' });
    if (typeof MetaPixel !== 'undefined') MetaPixel.gameStartMarketing();
    window.__gameStartedAt = Date.now();
  }

  function startModeGame(mode) {
    let ok = false;
    if (mode === 'classic') ok = Game.startClassic();
    else if (mode === 'timed') ok = Game.startTimed();
    else if (mode === 'survival') ok = Game.startSurvival();
    else if (mode === 'category') {
      showScreen('categories');
      return;
    } else {
      ok = Game.startClassic();
    }
    if (!ok) return;
    showScreen('game');
    renderGameScreen();
    _bindTimerRefresh();
    if (typeof AudioFX !== 'undefined') AudioFX.startMusic();
    if (typeof Analytics !== 'undefined') Analytics.track('game_start', { mode: mode || 'classic' });
    if (typeof MetaPixel !== 'undefined') MetaPixel.gameStartMarketing();
    window.__gameStartedAt = Date.now();
  }

  // Keep timer UI updating every second in timed mode
  let lastTimerText = '';
  function _bindTimerRefresh() {
    if (timerRefreshId) {
      clearInterval(timerRefreshId);
      timerRefreshId = null;
    }
    lastTimerText = '';
    window.__onGameTimerEnd = function () {
      if (timerRefreshId) { clearInterval(timerRefreshId); timerRefreshId = null; }
      renderGameScreen();
    };
    timerRefreshId = setInterval(() => {
      const st = Game.getState();
      if (st.mode !== 'timed' || st.status === Game.STATE.GAMEOVER || st.status === Game.STATE.IDLE) {
        clearInterval(timerRefreshId);
        timerRefreshId = null;
        if (st.status === Game.STATE.GAMEOVER) renderGameScreen();
        return;
      }
      const text = st.timeLeft != null ? st.timeLeft + 's' : '';
      if (text === lastTimerText) return;
      lastTimerText = text;
      const progressEl = $('game-progress');
      const progressFill = $('game-progress-fill');
      if (progressEl) {
        progressEl.textContent = text;
        progressEl.style.color = st.timeLeft <= 10 ? 'var(--danger)' : '';
      }
      if (progressFill && st.timeLimit) {
        progressFill.style.width = Math.max(0, (st.timeLeft / st.timeLimit) * 100) + '%';
      }
    }, 250);
  }

  // ---------- Splash ----------
  function arenaCard(g) {
    const playAttr = g.id === 'riddle' ? 'data-screen="home"' : 'data-game="' + g.id + '"';
    return '<button type="button" class="action-card text-left" ' + playAttr + ' style="border-left:4px solid ' + (g.accent || '#7c5cff') + '">' +
      '<div class="action-icon">' + g.emoji + '</div>' +
      '<div class="action-content"><span class="action-title">' + g.title + '</span>' +
      '<span class="action-sub">' + (g.type || 'Game') + ' · ' + g.blurb + '</span></div>' +
      '<div class="action-badge">Play</div></button>';
  }

  function renderArenaLibrary() {
    if (typeof Arena === 'undefined') return;
    const games = Arena.games();
    const box = $('arena-library');
    if (box) box.innerHTML = games.map(arenaCard).join('');
    const feat = $('arena-featured');
    if (feat) feat.innerHTML = games.slice(0, 3).map(arenaCard).join('');
    const rec = $('arena-recent');
    if (rec) {
      const ids = Arena.recent ? Arena.recent() : [];
      if (!ids.length) rec.innerHTML = '<p class="lb-empty">No recently played games yet.</p>';
      else rec.innerHTML = ids.map(function (id) { return Arena.gameById(id); }).filter(Boolean).map(arenaCard).join('');
    }
    const owner = $('owner-games-box');
    if (owner && Arena.ownerSnapshot) {
      const snap = Arena.ownerSnapshot();
      owner.innerHTML = snap.map(function (g) {
        return '<div class="f-row"><span>' + g.title + '</span><span>' + g.plays + ' plays · best ' + g.bestScore + '</span></div>';
      }).join('') || 'No game plays yet.';
    }
  }

  function runSplash(callback) {
    const splash = $('splash');
    const app = $('app');
    if (!splash || !app) {
      if (callback) callback();
      return;
    }

    const reduced = document.documentElement.getAttribute('data-reduced-motion') === 'true'
      || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const hold = reduced ? 200 : 900;
    const fade = reduced ? 0 : 400;

    setTimeout(() => {
      if (fade) splash.classList.add('fade-out');
      setTimeout(() => {
        splash.classList.add('hidden');
        splash.setAttribute('aria-hidden', 'true');
        app.classList.remove('hidden');
        app.setAttribute('aria-hidden', 'false');
        if (callback) callback();
      }, fade);
    }, hold);
  }


  // ---------- Event Wiring ----------
  function bindEvents() {
    const logoutBtn = $('btn-logout-arena');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        if (typeof Auth !== 'undefined' && Auth.logout) await Auth.logout();
        window.location.href = '/';
      });
    }
    // Theme toggle
    const themeBtn = $('btn-theme');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
    const settingsTheme = $('settings-theme-toggle');
    if (settingsTheme) settingsTheme.addEventListener('click', toggleTheme);

    // Bottom nav + action cards + chips
    document.addEventListener('click', (e) => {
      const gameBtn = e.target.closest('[data-game]');
      if (gameBtn && gameBtn.dataset.game) {
        if (typeof MiniGames !== 'undefined') MiniGames.start(gameBtn.dataset.game);
        return;
      }
      const target = e.target.closest('[data-screen]');
      if (!target) return;

      const screen = target.dataset.screen;
      if (!screen) return;

      if (screen === 'daily') {
        showScreen('daily');
        renderDailyStatus();
        return;
      }

      showScreen(screen);
      if (screen === 'home' || screen === 'profile' || screen === 'arena') refreshPlayerUI();
      if (screen === 'library' || screen === 'arena') renderArenaLibrary();
      if (screen === 'home') {
        renderDailyStatus();
        renderMissions();
      }
      if (screen === 'achievements') renderAchievements();
      if (screen === 'shop') {
        renderShop();
        if (typeof MetaPixel !== 'undefined') {
          MetaPixel.viewContent({ name: 'Shop', category: 'shop', type: 'page' });
        }
      }
      if (screen === 'leaderboard') renderLeaderboard();
      if (screen === 'premium') {
        fillProPrices();
        if (typeof Monetization !== 'undefined') Monetization.onPremiumInterest('premium_screen');
        renderProDashboard();
      }
      if (screen === 'ai') renderAiDashboard();
      if (screen === 'plans') renderAiDashboard();
      if (screen === 'multiplayer') renderMultiplayer();
      if (screen === 'battle') renderBattleList();
      if (screen === 'challenge') renderChallengeHome();
      if (screen === 'founder') {
        const u = typeof Auth !== 'undefined' ? Auth.getUser() : null;
        if (!u || u.role !== 'founder') {
          showToast('Founder access only', { emoji: '🔒', type: 'info' });
          showScreen('home');
          return;
        }
        loadFounderOverview();
      }
    });

    // Mode cards + quick-play buttons (data-mode)
    document.addEventListener('click', (e) => {
      const modeBtn = e.target.closest('[data-mode]');
      if (!modeBtn) return;
      // Don't steal category clicks
      if (modeBtn.dataset.screen) return;
      const mode = modeBtn.dataset.mode;
      if (mode) startModeGame(mode);
    });

    // Category cards
    const catGrid = $('category-grid');
    if (catGrid) {
      catGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.cat-card');
        if (!card) return;
        const cat = card.dataset.cat;
        startCategoryGame(cat);
      });
    }

    // Daily start button
    const startDailyBtn = $('btn-start-daily');
    if (startDailyBtn) {
      startDailyBtn.addEventListener('click', () => {
        if (typeof Daily === 'undefined') return;
        const result = Daily.startChallenge();
        if (!result.ok) {
          if (result.reason === 'already_completed') {
            renderDailyStatus();
          }
          return;
        }
        showScreen('game');
        renderGameScreen();
        if (typeof AudioFX !== 'undefined') AudioFX.startMusic();
      });
    }

    // Shop tabs
    const shopTabs = $('shop-tabs');
    if (shopTabs) {
      shopTabs.addEventListener('click', (e) => {
        const tab = e.target.closest('[data-shop-tab]');
        if (!tab) return;
        currentShopTab = tab.dataset.shopTab;
        qsa('.shop-tab', shopTabs).forEach(t => t.classList.toggle('active', t === tab));
        renderShop();
      });
    }

    // Music / SFX toggles
    const musicToggle = $('toggle-music');
    if (musicToggle) {
      const settings = Storage.loadSettings();
      musicToggle.checked = settings.music !== false;
      musicToggle.addEventListener('change', () => {
        Storage.saveSettings({ music: musicToggle.checked });
        if (typeof AudioFX !== 'undefined') {
          AudioFX.onMusicSettingChange(musicToggle.checked);
        }
      });
    }
    const sfxToggle = $('toggle-sfx');
    if (sfxToggle) {
      const settings = Storage.loadSettings();
      sfxToggle.checked = settings.sfx !== false;
      sfxToggle.addEventListener('change', () => {
        Storage.saveSettings({ sfx: sfxToggle.checked });
      });
    }

    // Login reward claim
    const claimLoginBtn = $('btn-claim-login');
    if (claimLoginBtn) {
      claimLoginBtn.addEventListener('click', () => {
        if (typeof Streaks === 'undefined') return;
        const result = Streaks.claimLoginReward();
        if (result.ok) {
          refreshPlayerUI();
          renderStreakUI();
          claimLoginBtn.textContent = 'Claimed ✓';
          claimLoginBtn.classList.add('claimed');
          claimLoginBtn.disabled = true;
        }
      });
    }

    // Back button
    const backBtn = $('btn-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (currentScreen === 'game') {
          if (typeof AudioFX !== 'undefined') AudioFX.stopMusic();
          if (typeof Game !== 'undefined' && Game.stopTimer) Game.stopTimer();
          showScreen('home');
          refreshPlayerUI();
          renderDailyStatus();
        } else {
          showScreen(previousScreen || 'home');
        }
      });
    }

    // Accessibility settings controls
    const motionToggle = $('toggle-motion');
    if (motionToggle) {
      motionToggle.addEventListener('change', () => {
        Storage.saveSettings({ reducedMotion: motionToggle.checked });
        applyAccessibility();
      });
    }
    const contrastToggle = $('toggle-contrast');
    if (contrastToggle) {
      contrastToggle.addEventListener('change', () => {
        Storage.saveSettings({ highContrast: contrastToggle.checked });
        applyAccessibility();
      });
    }
    const hapticToggle = $('toggle-haptic');
    if (hapticToggle) {
      const hs = Storage.loadSettings();
      hapticToggle.checked = hs.haptic !== false;
      hapticToggle.addEventListener('change', () => {
        Storage.saveSettings({ haptic: hapticToggle.checked });
      });
    }
    qsa('.seg-btn[data-text-size]').forEach(btn => {
      btn.addEventListener('click', () => {
        const size = btn.dataset.textSize;
        Storage.saveSettings({ textSize: size });
        applyAccessibility();
      });
    });
    const resetBtn = $('btn-reset-progress');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        const ok = confirm('Reset all progress on this device? This cannot be undone.');
        if (!ok) return;
        Storage.resetPlayer();
        try {
          localStorage.removeItem('rr_daily');
          localStorage.removeItem('rr_streaks');
          localStorage.removeItem('rr_achievements');
          localStorage.removeItem('rr_missions');
          localStorage.removeItem('rr_missions_history');
          localStorage.removeItem('rr_leaderboard');
          localStorage.removeItem('rr_hint_stats');
          localStorage.removeItem('rr_shop');
        } catch (e) {}
        refreshPlayerUI();
        renderMissions();
        renderAchievements();
        showToast('Progress reset', { emoji: '↺', type: 'info' });
        showScreen('home');
      });
    }

    // Founder tabs
    qsa('[data-founder-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        qsa('[data-founder-tab]').forEach(b => b.classList.toggle('active', b === btn));
        const tab = btn.dataset.founderTab;
        const ov = $('founder-overview');
        const us = $('founder-users');
        const rd = $('founder-riddles');
        const gm = $('founder-games');
        const bd = $('founder-boards');
        const ai = $('founder-ai');
        const st = $('founder-settings');
        if (ov) ov.hidden = tab !== 'overview';
        if (us) us.hidden = tab !== 'users';
        if (rd) rd.hidden = tab !== 'riddles';
        if (gm) gm.hidden = tab !== 'games';
        if (bd) bd.hidden = tab !== 'boards';
        if (ai) ai.hidden = tab !== 'ai';
        if (st) st.hidden = tab !== 'settings';
        if (tab === 'overview') loadFounderOverview();
        if (tab === 'users') loadFounderUsers();
        if (tab === 'riddles') loadFounderRiddles();
      });
    });


    // Phase 22 modals
    const proLater = $('pro-modal-later');
    if (proLater) proLater.addEventListener('click', closeProModal);
    const proUp = $('pro-modal-upgrade');
    if (proUp) proUp.addEventListener('click', () => {
      if (typeof Monetization !== 'undefined') Monetization.startCheckout();
      showToast('⭐ Pro Coming Soon — secure payment is not available yet. Pro was NOT unlocked.', {
        emoji: '⭐', type: 'info', duration: 4500
      });
      closeProModal();
    });
    const buyCancel = $('buy-modal-cancel');
    if (buyCancel) buyCancel.addEventListener('click', closeBuyModal);
    const buyConfirm = $('buy-modal-confirm');
    if (buyConfirm) buyConfirm.addEventListener('click', confirmBuy);

    bindMultiplayer();
    bindBattle();
    bindChallenge();
    handleDeepLinks();

    // Demo Pro Mode (DEVELOPMENT ONLY)
    const demoPro = $('toggle-demo-pro');
    if (demoPro && typeof Entitlements !== 'undefined') {
      demoPro.checked = Entitlements.isDemoPro();
      demoPro.addEventListener('change', () => {
        Entitlements.setDemoPro(demoPro.checked);
        showToast(
          demoPro.checked
            ? 'Demo Pro ON — development only, not a payment'
            : 'Demo Pro OFF — Free plan',
          { emoji: '🛠️', type: 'info', duration: 3500 }
        );
        renderAiDashboard();
        refreshPlayerUI();
      });
    }

    // AI dashboard actions
    function currentRiddleCtx() {
      const st = typeof Game !== 'undefined' && Game.getState ? Game.getState() : null;
      const r = st && st.current ? st.current : null;
      return { riddle: r, category: r && r.category, difficulty: r && r.difficulty };
    }
    const aiHint = $('btn-ai-hint');
    if (aiHint) aiHint.addEventListener('click', async () => {
      const res = await AIService.generateHint(currentRiddleCtx());
      showAiOutput(res);
      renderAiDashboard();
    });
    const aiEx = $('btn-ai-explain');
    if (aiEx) aiEx.addEventListener('click', async () => {
      const res = await AIService.explainRiddle(currentRiddleCtx());
      showAiOutput(res);
      renderAiDashboard();
    });
    const aiSim = $('btn-ai-similar');
    if (aiSim) aiSim.addEventListener('click', async () => {
      const res = await AIService.generateRiddle(currentRiddleCtx());
      showAiOutput(res);
      renderAiDashboard();
    });
    const aiAn = $('btn-ai-analyze');
    if (aiAn) aiAn.addEventListener('click', async () => {
      const res = AIService.analyzePerformance();
      showAiOutput(res);
      renderAiDashboard();
    });
    const aiRec = $('btn-ai-recommend');
    if (aiRec) aiRec.addEventListener('click', async () => {
      const res = await AIService.recommendCategory({});
      showAiOutput(res);
      renderAiDashboard();
    });
    const aiCh = $('btn-ai-challenge');
    if (aiCh) aiCh.addEventListener('click', async () => {
      const res = await AIService.generateChallenge({});
      showAiOutput(res);
      renderAiDashboard();
    });
    const aiPr = $('btn-ai-practice');
    if (aiPr) aiPr.addEventListener('click', async () => {
      const res = await AIService.generateRiddle({});
      showAiOutput(res);
      renderAiDashboard();
    });
    const aiUp = $('btn-ai-upgrade');
    if (aiUp) aiUp.addEventListener('click', () => openProModal('Get higher AI limits and advanced AI with Pro.'));
    const plansUp = $('btn-plans-upgrade');
    if (plansUp) plansUp.addEventListener('click', () => showScreen('premium'));

    // Marketing consent
    function syncMarketingUI() {
      const allowed = typeof MetaPixel !== 'undefined' && MetaPixel.hasConsent();
      const toggle = $('toggle-marketing');
      if (toggle) toggle.checked = allowed;
      const banner = $('marketing-consent-banner');
      if (banner) {
        const choice = typeof MetaPixel !== 'undefined' ? MetaPixel.getConsent() : 'denied';
        banner.hidden = choice === 'granted' || choice === 'denied';
      }
    }
    const mToggle = $('toggle-marketing');
    if (mToggle) {
      mToggle.addEventListener('change', () => {
        if (typeof MetaPixel === 'undefined') return;
        MetaPixel.setConsent(mToggle.checked ? 'granted' : 'denied');
        showToast(mToggle.checked ? 'Marketing analytics on' : 'Marketing analytics off', { emoji: '📊', type: 'info' });
      });
    }
    const accept = $('btn-consent-accept');
    if (accept) accept.addEventListener('click', () => {
      if (typeof MetaPixel !== 'undefined') MetaPixel.setConsent('granted');
      syncMarketingUI();
    });
    const decline = $('btn-consent-decline');
    if (decline) decline.addEventListener('click', () => {
      if (typeof MetaPixel !== 'undefined') MetaPixel.setConsent('denied');
      syncMarketingUI();
    });
    syncMarketingUI();

    // Premium checkout (analytics only until payment backend exists)
    const premCheckout = $('btn-premium-checkout');
    if (premCheckout) {
      premCheckout.addEventListener('click', () => {
        if (typeof Monetization === 'undefined') return;
        const status = typeof Entitlements !== 'undefined' ? Entitlements.getStatus() : null;
        if (status && status.isVerifiedPro) {
          showToast('Pro already active', { emoji: '👑', type: 'info' });
          return;
        }
        // Analytics only — no real payment
        const session = Monetization.startCheckout();
        showToast('Payments coming soon. Checkout is not live yet.', {
          emoji: '💳',
          type: 'info',
          duration: 4200
        });
        renderProDashboard();
      });
    }
    const premRestore = $('btn-premium-restore');
    if (premRestore) {
      premRestore.addEventListener('click', () => {
        showToast('Restore requires account + payment verification (coming later).', {
          emoji: '↺',
          type: 'info',
          duration: 4000
        });
      });
    }
    const premShop = $('btn-pro-open-shop');
    if (premShop) premShop.addEventListener('click', () => showScreen('shop'));
    const plansAi = $('btn-plans-compare-ai');
    if (plansAi) plansAi.addEventListener('click', () => showScreen('ai'));
    const premBack = $('btn-premium-back');
    if (premBack) premBack.addEventListener('click', () => showScreen('plans'));

    // Keyboard: 1-4 answer options during play, Escape = back
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (currentScreen === 'game') {
          if (typeof AudioFX !== 'undefined') AudioFX.stopMusic();
          if (typeof Game !== 'undefined' && Game.stopTimer) Game.stopTimer();
          showScreen('home');
          refreshPlayerUI();
        } else if (currentScreen !== 'home') {
          showScreen('home');
        }
        return;
      }
      if (currentScreen !== 'game') return;
      const gState = Game.getState();
      if (gState.status !== Game.STATE.PLAYING) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 4) {
        const btns = qsa('.option-btn:not(.option-removed):not([disabled])');
        if (btns[num - 1]) btns[num - 1].click();
      }
    });
  }

  /**
   * Update Daily Challenge card + home badge
   */
  function renderDailyStatus() {
    if (typeof Daily === 'undefined') return;
    const status = Daily.getStatus();

    // Home badge
    const badge = $('daily-status');
    if (badge) {
      badge.textContent = status.completed ? 'Done' : 'Ready';
      badge.style.color = status.completed ? 'var(--success)' : '';
    }

    // Daily screen
    const title = $('daily-title');
    const meta = $('daily-meta');
    const streakLabel = $('daily-streak-label');
    const startBtn = $('btn-start-daily');
    const doneMsg = $('daily-done-msg');
    const dateLabel = $('daily-date-label');

    if (dateLabel) {
      dateLabel.textContent = 'Challenge for ' + status.date + ' · same set all day';
    }
    if (title) title.textContent = status.completed ? 'Completed Today' : "Today's Challenge";
    if (meta) {
      meta.textContent = status.completed
        ? 'Score ' + status.score + ' · ' + status.correct + ' correct · rewards claimed'
        : status.riddleCount + ' riddles · Bonus +' + status.bonusXp + ' XP · +' + status.bonusCoins + ' coins';
    }
    if (streakLabel) {
      const n = status.streak || 0;
      streakLabel.textContent =
        n > 0
          ? '🔥 ' + n + ' Day' + (n === 1 ? '' : 's')
          : 'Streak: 0 days — complete today to start';
    }
    if (startBtn) {
      if (status.completed) {
        startBtn.classList.add('hidden');
      } else {
        startBtn.classList.remove('hidden');
        startBtn.textContent = 'Start Challenge';
      }
    }
    if (doneMsg) {
      doneMsg.classList.toggle('hidden', !status.completed);
    }

    renderStreakUI();
  }

  /**
   * Home streak strip + login claim + milestones
   */
  function renderStreakUI() {
    if (typeof Streaks === 'undefined') return;
    const s = Streaks.getStatus();

    // Home streak number — prefer Daily streak if higher
    let streakNum = s.currentStreak;
    if (typeof Daily !== 'undefined') {
      streakNum = Math.max(streakNum, Daily.getStatus().streak || 0);
    }
    const homeStreak = $('home-streak-num');
    if (homeStreak) homeStreak.textContent = streakNum;

    // Login claim button
    const claimBtn = $('btn-claim-login');
    if (claimBtn) {
      if (s.canClaimLogin) {
        claimBtn.classList.remove('hidden', 'claimed');
        claimBtn.disabled = false;
        claimBtn.textContent = `Claim +${s.loginXp} XP`;
      } else {
        claimBtn.classList.add('claimed');
        claimBtn.disabled = true;
        claimBtn.textContent = 'Claimed ✓';
      }
    }

    // Milestones row
    const row = $('milestones-row');
    if (row) {
      row.innerHTML = s.allMilestones.map(m => {
        const cls = m.claimed ? 'claimed' : (m.reached ? 'reached' : 'locked');
        const action = m.reached && !m.claimed
          ? `<button class="milestone-claim" data-days="${m.days}">Claim</button>`
          : (m.claimed ? '<span class="milestone-done">✓</span>' : `<span class="milestone-need">${m.days}d</span>`);
        return `
          <div class="milestone-card ${cls}" data-days="${m.days}">
            <span class="milestone-emoji">${m.emoji}</span>
            <span class="milestone-label">${m.label}</span>
            <span class="milestone-reward">+${m.coins}🪙 +${m.xp}XP</span>
            ${action}
          </div>`;
      }).join('');

      // Bind claim buttons
      qsa('.milestone-claim', row).forEach(btn => {
        btn.addEventListener('click', () => {
          const days = parseInt(btn.dataset.days, 10);
          const result = Streaks.claimMilestone(days);
          if (result.ok) {
            refreshPlayerUI();
            renderStreakUI();
          }
        });
      });
    }
  }


  // ---------- Shop ----------
  let currentShopTab = 'avatars';

  let shopPage = 0;
  let shopTier = 'coin'; // coin | pro

  function fillProPrices() {
    const product = typeof Monetization !== 'undefined'
      ? Monetization.getProduct()
      : (typeof Pricing !== 'undefined' ? Pricing.getDisplayPrices() : null);
    if (!product) return;
    const m = $('pro-modal-monthly');
    const y = $('pro-modal-yearly');
    const n = $('pro-modal-yearly-note');
    const note = $('pro-modal-note');
    if (m) m.textContent = product.monthlyLabel || '$4.99/month';
    if (y) y.textContent = product.yearlyLabel || '$49.99/year';
    if (n) n.textContent = product.yearlyValueNote || 'Better value with yearly';
    if (note) {
      note.textContent =
        (product.disclaimer || 'Prices shown where configured.') +
        ' Secure payment is not available yet. Payment will be connected in a future phase.';
    }
    const premiumPrice = $('premium-price');
    if (premiumPrice) {
      premiumPrice.innerHTML =
        (product.monthlyLabel || '$4.99/month') +
        '<br><span style="font-size:0.9rem;font-weight:600">' +
        (product.yearlyLabel || '$49.99/year') +
        '</span>';
    }
  }

  function openProModal(reason) {
    fillProPrices();
    const modal = $('pro-modal');
    const body = $('pro-modal-body');
    const title = $('pro-modal-title');
    if (title) title.textContent = '⭐ PRO';
    if (body) body.textContent = reason || 'Unlock this feature with Pro.';
    if (modal) {
      modal.hidden = false;
      modal.classList.remove('hidden');
    }
    if (typeof Analytics !== 'undefined') Analytics.track('pro_modal_open', {});
    if (typeof Monetization !== 'undefined') Monetization.onPremiumInterest('pro_modal');
  }

  function closeProModal() {
    const modal = $('pro-modal');
    if (modal) {
      modal.hidden = true;
      modal.classList.add('hidden');
    }
  }

  let _pendingBuyId = null;

  function openBuyModal(item) {
    _pendingBuyId = item.id;
    const modal = $('buy-modal');
    const title = $('buy-modal-title');
    const body = $('buy-modal-body');
    const player = Storage.loadPlayer();
    const bal = player.coins || 0;
    if (title) title.textContent = 'Unlock ' + item.name + '?';
    if (body) {
      body.innerHTML =
        'Price: 🪙 <strong>' + item.cost + '</strong><br>' +
        'Your balance: 🪙 <strong>' + bal + '</strong><br>' +
        'After purchase: 🪙 <strong>' + (bal - item.cost) + '</strong>';
    }
    if (modal) {
      modal.hidden = false;
      modal.classList.remove('hidden');
    }
  }

  function closeBuyModal() {
    _pendingBuyId = null;
    const modal = $('buy-modal');
    if (modal) {
      modal.hidden = true;
      modal.classList.add('hidden');
    }
  }

  function confirmBuy() {
    if (!_pendingBuyId || typeof Shop === 'undefined') {
      closeBuyModal();
      return;
    }
    const id = _pendingBuyId;
    closeBuyModal();
    const result = Shop.buy(id);
    if (!result.ok) {
      if (result.reason === 'not_enough_coins') {
        showToast(
          'You need ' + result.cost + ' coins. You have ' + (result.have || 0) + '. Earn more by playing!',
          { emoji: '🪙', type: 'info', duration: 4000 }
        );
      } else if (result.reason === 'pro_required') {
        openProModal('This item is available with Pro.');
      } else {
        showToast(result.reason || 'Could not unlock', { emoji: 'ℹ️', type: 'info' });
      }
      return;
    }
    if (typeof AudioFX !== 'undefined') AudioFX.purchase();
    showToast('Unlocked ' + result.item.name + '!', { emoji: result.item.emoji || '✨', type: 'reward' });
    if (result.item.kind !== 'pack') {
      Shop.equip(result.item.id);
      _applyEquippedCosmetics();
    }
    refreshPlayerUI();
    renderShop();
  }

  function renderShop() {
    if (typeof Shop === 'undefined') return;
    const grid = $('shop-grid');
    const coinsEl = $('shop-coins');
    const player = Storage.loadPlayer();
    if (coinsEl) coinsEl.textContent = player.coins || 0;
    if (!grid) return;

    if (typeof Analytics !== 'undefined') Analytics.track('shop_open', {});

    const state = Shop.getState();
    const counts = state.counts || Shop.counts();
    const kindMap = { avatars: 'avatar', themes: 'theme', packs: 'pack' };
    const kind = kindMap[currentShopTab] || 'avatar';
    const pageData = Shop.getPage(kind, { tier: shopTier === 'pro' ? 'pro' : 'coin' });
    const c = counts[kind === 'theme' ? 'themes' : kind === 'avatar' ? 'avatars' : 'packs'] || {};

    let header =
      '<div class="shop-meta glass">' +
      '<span>Curated catalog · Free coin unlocks + Pro exclusives</span>' +
      '<span>' + (state.isPro ? 'Pro active (demo/verified)' : 'Free plan') + '</span>' +
      '</div>' +
      '<div class="shop-tier-tabs">' +
      '<button type="button" class="shop-tier-btn ' + (shopTier !== 'pro' ? 'active' : '') + '" data-shop-tier="coin">Free / Coins (' + (c.free || 0) + ')</button>' +
      '<button type="button" class="shop-tier-btn ' + (shopTier === 'pro' ? 'active' : '') + '" data-shop-tier="pro">🔒 Pro (' + (c.pro || 0) + ')</button>' +
      '</div>';

    const items = pageData.items.map(function (item) {
      const owned = !!state.owned[item.id] || item.tier === 'free';
      const isPack = kind === 'pack';
      const isEquipped =
        (kind === 'theme' && state.equipped.theme === item.id) ||
        (kind === 'avatar' && state.equipped.avatar === item.id);
      let action = '';
      if (item.tier === 'pro' && !state.isPro) {
        action = '<button type="button" class="shop-buy-btn shop-pro-btn" data-pro-item="' + item.id + '">🔒 PRO</button>';
      } else if (isPack) {
        action = '<button type="button" class="shop-buy-btn" data-buy="' + item.id + '">' + (item.cost ? item.cost + '🪙' : 'Claim') + '</button>';
      } else if (isEquipped) {
        action = '<span class="shop-equipped">Equipped</span>';
      } else if (owned) {
        action = '<button type="button" class="shop-equip-btn" data-equip="' + item.id + '">Equip</button>';
      } else {
        action = '<button type="button" class="shop-buy-btn" data-buy="' + item.id + '">' + item.cost + '🪙</button>';
      }
      return (
        '<div class="shop-card glass ' + (isEquipped ? 'equipped ' : '') + (item.tier === 'pro' ? 'pro-item' : '') + '">' +
        '<span class="shop-emoji">' + item.emoji + '</span>' +
        '<span class="shop-name">' + item.name + '</span>' +
        '<span class="shop-desc">' + (item.desc || '') + '</span>' +
        action +
        '</div>'
      );
    }).join('');

    let packBal = '';
    if (kind === 'pack') {
      packBal =
        '<div class="shop-free-balance glass">Free charges — Clues: ' +
        (state.freeHints.extra_clue || 0) +
        ' · Letters: ' +
        (state.freeHints.reveal_letter || 0) +
        ' · 50/50: ' +
        (state.freeHints.remove_options || 0) +
        '</div>';
    }

    grid.innerHTML = header + packBal + items;

    qsa('[data-shop-tier]', grid).forEach(function (btn) {
      btn.addEventListener('click', function () {
        shopTier = btn.dataset.shopTier;
        shopPage = 0;
        renderShop();
      });
    });
    qsa('[data-buy]', grid).forEach(function (btn) {
      btn.addEventListener('click', function () {
        const item = Shop.findItem(btn.dataset.buy);
        if (!item) return;
        if (item.cost > 0) openBuyModal(item);
        else {
          _pendingBuyId = item.id;
          confirmBuy();
        }
      });
    });
    qsa('[data-pro-item]', grid).forEach(function (btn) {
      btn.addEventListener('click', function () {
        const item = Shop.findItem(btn.dataset.proItem);
        if (typeof Monetization !== 'undefined') Monetization.onProItemBlocked(item);
        openProModal((item && item.name ? item.name + ' is a Pro exclusive.' : 'This is a Pro exclusive.'));
      });
    });
    qsa('[data-equip]', grid).forEach(function (btn) {
      btn.addEventListener('click', function () {
        const result = Shop.equip(btn.dataset.equip);
        if (result.ok) {
          _applyEquippedCosmetics();
          showToast('Equipped!', { emoji: '✨', type: 'info' });
          renderShop();
          refreshPlayerUI();
        } else if (result.reason === 'pro_required') {
          openProModal('This item is available with Pro.');
        }
      });
    });
  }

  function _applyEquippedCosmetics() {
    if (typeof Shop === 'undefined') return;
    const eq = Shop.getEquipped();
    const hue = typeof Shop.getThemeHue === 'function' ? Shop.getThemeHue() : null;
    // Index 1 is light-like starter
    const isLight = eq.theme === 'theme_daylight' || eq.theme === 'theme_1' || eq.theme === 'theme_light';
    document.documentElement.setAttribute('data-theme', isLight ? 'light' : 'dark');
    if (hue != null) {
      document.documentElement.style.setProperty('--accent', 'hsl(' + hue + ' 80% 60%)');
      document.documentElement.style.setProperty('--accent-hover', 'hsl(' + hue + ' 85% 70%)');
      document.documentElement.style.setProperty('--accent-soft', 'hsl(' + hue + ' 70% 50% / 0.15)');
    }
    Storage.saveSettings({ theme: isLight ? 'light' : 'dark' });
  }

  // ---------- Public Init ----------
  
  
  
  function renderProDashboard() {
    const ent = typeof Entitlements !== 'undefined' ? Entitlements.getStatus() : null;
    const prod = typeof Monetization !== 'undefined' ? Monetization.getProduct() : { displayPrice: '999.90' };

    const badge = $('pro-status-badge');
    const detail = $('pro-status-detail');
    const usage = $('pro-ai-usage');
    const note = $('pro-status-note');
    const price = $('premium-price');
    const premNote = $('premium-note');
    const checkout = $('btn-premium-checkout');
    const sub = $('pro-dash-sub');

    if (price) price.textContent = '$' + (prod.displayPrice || '999.90');

    if (!ent) {
      if (badge) badge.textContent = 'Free';
      return;
    }

    if (badge) {
      badge.textContent = ent.isPro ? 'Pro' : 'Free';
      badge.classList.toggle('pro-on', !!ent.isPro);
    }
    if (detail) {
      if (ent.isVerifiedPro) detail.textContent = 'Verified Pro entitlement';
      else if (ent.isDemoPro) detail.textContent = 'Demo Pro (development only)';
      else detail.textContent = 'Standard free access';
    }
    if (usage) {
      usage.textContent = typeof Entitlements.getUsageDisplay === 'function'
        ? Entitlements.getUsageDisplay()
        : (ent.usage.remaining + ' left today');
    }
    if (note) {
      note.textContent = ent.isDemoPro
        ? 'Demo Pro is ON. Turn it off in Settings before any production release.'
        : ent.isVerifiedPro
          ? 'Pro cosmetics and higher AI limits are available.'
          : 'Upgrade when payments go live. Free remains fully playable.';
    }
    if (sub) {
      sub.textContent = ent.isPro ? 'You have Pro features on this device.' : 'See benefits and future upgrade options.';
    }
    if (premNote) {
      premNote.textContent = ent.isPro
        ? (ent.isDemoPro
            ? 'Demo Pro active — not a real purchase.'
            : 'Pro active. Restore will sync from your account after billing ships.')
        : 'Payments coming soon. No card details are collected in this app version.';
    }
    if (checkout) {
      if (ent.isPro && !ent.isDemoPro) {
        checkout.disabled = true;
        checkout.textContent = 'Pro unlocked';
      } else if (ent.isDemoPro) {
        checkout.disabled = false;
        checkout.textContent = 'Payments coming soon';
      } else {
        checkout.disabled = false;
        checkout.textContent = 'Upgrade — Payments coming soon';
      }
    }
  }


  function renderAiDashboard() {
    if (typeof Entitlements === 'undefined') return;
    const status = Entitlements.getStatus();
    const planEl = $('ai-plan-label');
    const usageEl = $('ai-usage-label');
    const noteEl = $('ai-status-note');
    if (planEl) {
      planEl.textContent = 'Plan: ' + (status.plan === 'pro' ? 'Pro' : 'Free') +
        (status.isDemoPro ? ' (Demo)' : '');
    }
    if (usageEl) {
      usageEl.textContent = typeof Entitlements.getUsageDisplay === 'function'
        ? Entitlements.getUsageDisplay()
        : (status.usage.remaining + ' left today');
    }
    if (noteEl) {
      noteEl.textContent = status.isDemoPro
        ? 'DEMO PRO MODE — development only, not a payment.'
        : 'Local helpers use riddle data. Secure cloud AI is Phase 22.';
    }
  }

  function showAiOutput(res) {
    const box = $('ai-output');
    if (!box) return;
    if (!res) {
      box.innerHTML = '<p class="ai-output-placeholder">No response.</p>';
      return;
    }
    if (res.success && res.type === 'practice_riddle' && res.content && res.content.question) {
      box.innerHTML = '<p><strong>Practice</strong></p><p>' + res.content.question + '</p><p class="ai-meta">' +
        (res.metadata && res.metadata.note ? res.metadata.note : '') + '</p>';
      return;
    }
    if (res.success && res.type === 'challenge' && res.content) {
      box.innerHTML = '<p><strong>' + (res.content.title || 'Challenge') + '</strong></p><p>' +
        (res.content.description || '') + '</p>';
      return;
    }
    const body = typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
    box.innerHTML = '<p class="' + (res.success ? '' : 'ai-error-text') + '">' + body + '</p>';
  }


  function bindLeaderboardTabs() {
    const tabs = $('lb-tabs');
    if (!tabs || tabs.dataset.bound) return;
    tabs.dataset.bound = '1';
    tabs.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-lb-tab]');
      if (!btn) return;
      qsa('[data-lb-tab]', tabs).forEach(function (b) {
        b.classList.toggle('active', b === btn);
      });
      const tab = btn.getAttribute('data-lb-tab');
      const local = $('lb-panel-local');
      const mp = $('lb-panel-multiplayer');
      const battle = $('lb-panel-battle');
      if (local) local.hidden = tab !== 'local';
      if (mp) mp.hidden = tab !== 'multiplayer';
      if (battle) battle.hidden = tab !== 'battle';
      if (tab === 'multiplayer') loadMpLeaderboard();
      if (tab === 'battle') loadBattleLeaderboards();
    });
  }

  async function loadMpLeaderboard() {
    const box = $('lb-mp-global');
    if (!box) return;
    box.textContent = 'Loading…';
    if (typeof API === 'undefined') {
      box.textContent = 'No data available yet.';
      return;
    }
    const res = await API.request('/api/multiplayer/leaderboard');
    if (!res.ok) {
      box.textContent = res.error || 'No data available yet.';
      return;
    }
    const d = (res.data && res.data.data) || {};
    const rows = d.top || [];
    if (!rows.length) {
      box.textContent = 'No data available yet.';
      return;
    }
    box.innerHTML = rows.map(function (r) {
      return (
        '<div class="lb-row' + (r.you ? ' lb-you' : '') + '">' +
        '<span class="lb-rank">#' + r.rank + '</span>' +
        '<span class="lb-score">' + r.points + ' pts</span>' +
        '<span class="lb-meta">' + r.player + ' · ' + r.wins + ' wins · ' + r.games + ' games · ' + r.winRate + '%</span>' +
        '</div>'
      );
    }).join('') + (d.you && d.you.rank > 50 ? '<p>Your rank: #' + d.you.rank + '</p>' : '');
  }

  async function loadBattleLeaderboards() {
    const box = $('lb-battle-global');
    if (!box || typeof Battle === 'undefined') return;
    box.textContent = 'Loading…';
    const res = await Battle.list();
    if (!res.ok) {
      box.textContent = res.error || 'No data available yet.';
      return;
    }
    const list = res.battles || [];
    if (!list.length) {
      box.textContent = 'No data available yet.';
      return;
    }
    const parts = [];
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      const detail = await Battle.get(b.battleId);
      const lb = detail.ok && detail.data && detail.data.leaderboard;
      const top = (lb && lb.top) || [];
      parts.push('<h4>' + (b.name || b.battleId) + '</h4>');
      if (!top.length) parts.push('<p class="lb-empty">No data available yet.</p>');
      else {
        parts.push(top.slice(0, 10).map(function (r) {
          return '<div class="lb-row' + (r.you ? ' lb-you' : '') + '"><span class="lb-rank">#' + r.rank + '</span><span class="lb-score">' + r.score + '</span><span class="lb-meta">' + r.player + '</span></div>';
        }).join(''));
      }
    }
    box.innerHTML = parts.join('');
  }

  function renderLeaderboard() {
    bindLeaderboardTabs();
    if (typeof Leaderboard === 'undefined') return;
    const summary = Leaderboard.getSummary();
    const setText = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    setText('lb-personal-best', summary.personalBest);

    function rows(list, emptyMsg) {
      if (!list || !list.length) return `<p class="lb-empty">${emptyMsg}</p>`;
      return list.map((e, i) => `
        <div class="lb-row">
          <span class="lb-rank">#${i + 1}</span>
          <span class="lb-score">${e.score}</span>
          <span class="lb-meta">${e.mode || ''}${e.category ? ' · ' + e.category : ''}</span>
          <span class="lb-date">${e.date || ''}</span>
        </div>`).join('');
    }

    const alltime = $('lb-alltime');
    if (alltime) alltime.innerHTML = rows(summary.allTime, 'No leaderboard results yet.');
    const daily = $('lb-daily');
    if (daily) daily.innerHTML = rows(summary.daily, 'No scores today yet.');
    const weekly = $('lb-weekly');
    if (weekly) weekly.innerHTML = rows(summary.weekly, 'No scores this week yet.');
    const extra = $('lb-arena-games');
    if (extra && typeof Arena !== 'undefined') {
      extra.innerHTML = Arena.games().map(function (g) {
        const board = Arena.boardFor(g.id);
        const list = board.length
          ? board.map(function (e, i) { return '#' + (i + 1) + ' ' + e.score + (e.mode ? ' · ' + e.mode : ''); }).join('<br>')
          : 'No leaderboard results yet.';
        return '<div class="lb-section"><h3 class="lb-title">' + g.title + '</h3><div class="lb-list">' + list + '</div></div>';
      }).join('');
    }


    const modes = $('lb-modes');
    if (modes) {
      const bm = summary.bestByMode || {};
      const keys = Object.keys(bm);
      if (!keys.length) {
        modes.innerHTML = '<p class="lb-empty">No mode records yet.</p>';
      } else {
        modes.innerHTML = keys.map(m => `
          <div class="lb-row">
            <span class="lb-rank">${m}</span>
            <span class="lb-score">${bm[m]}</span>
          </div>`).join('');
      }
    }

    const friends = $('lb-friends');
    if (friends && typeof Leaderboard.getSocialBoard === 'function') {
      const board = Leaderboard.getSocialBoard();
      if (!board.length || (board.length === 1 && board[0].score === 0 && !Leaderboard.getFriends().length)) {
        friends.innerHTML = '<p class="lb-empty">Open a friend challenge link or share yours to fill this board.</p>';
      } else {
        friends.innerHTML = board.map((e, i) => `
          <div class="lb-row ${e.isYou ? 'lb-you' : ''}">
            <span class="lb-rank">#${i + 1}</span>
            <span class="lb-score">${e.score}</span>
            <span class="lb-meta">${e.name}${e.mode && e.mode !== 'best' ? ' · ' + e.mode : ''}</span>
          </div>`).join('');
      }
    }
  }

  function annotateCategoryCounts() {
    const grid = $('category-grid');
    if (!grid || typeof Riddles === 'undefined') return;
    qsa('.cat-card', grid).forEach(card => {
      const cat = card.dataset.cat;
      const n = Riddles.count(cat);
      let badge = card.querySelector('.cat-count');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'cat-count';
        card.appendChild(badge);
      }
      if (n > 0) {
        badge.textContent = n;
        card.classList.remove('cat-empty');
      } else {
        badge.textContent = '0';
        card.classList.add('cat-empty');
      }
    });
  }

  function init() {
    // Restore theme
    const settings = Storage.loadSettings();
    applyTheme(settings.theme || 'dark');
    applyAccessibility(settings);

    // Initial player UI
    refreshPlayerUI();

    // Show how many riddles each category has
    annotateCategoryCounts();

    // Bind all interactive elements
    bindEvents();

    // Ensure anonymous guest key exists for server daily/share APIs
    if (typeof Storage !== 'undefined' && Storage.getGuestKey) Storage.getGuestKey();

    // Daily + streak status on home
    if (typeof Streaks !== 'undefined') Streaks.onAppOpen();
    if (typeof Shop !== 'undefined') _applyEquippedCosmetics();
    renderDailyStatus();
    if (typeof Daily !== 'undefined' && Daily.syncFromServer) {
      Daily.syncFromServer().then(function () {
        renderDailyStatus();
        renderStreakUI();
      }).catch(function () {});
    }
    renderStreakUI();
    renderMissions();
    // Incoming friend challenge from URL
    if (typeof Share !== 'undefined') {
      const incoming = Share.readIncomingChallenge();
      if (incoming && incoming.score != null) {
        if (typeof Leaderboard !== 'undefined' && Leaderboard.addFriendFromChallenge) {
          Leaderboard.addFriendFromChallenge(incoming);
        }
        setTimeout(() => {
          showToast(
            (incoming.name || 'A friend') + ' scored ' + incoming.score + ' — can you beat it?',
            { emoji: '⚔️', type: 'mission', duration: 4500 }
          );
        }, 1200);
      }
    }

    // Guest-first: open Arena landing (riddle game stays one tap away)
    showScreen('arena');
    renderArenaLibrary();
    try {
      const game = new URLSearchParams(window.location.search).get('game');
      if (game && game !== 'riddle' && typeof MiniGames !== 'undefined') MiniGames.start(game);
      else if (game === 'riddle') showScreen('home');
    } catch (e) {}
  }



  async function founderFetch(path) {
    if (typeof API === 'undefined') {
      return { ok: false, error: 'API unavailable' };
    }
    if (typeof Auth === 'undefined' || !Auth.getToken) {
      return { ok: false, error: 'Auth unavailable' };
    }
    const token = Auth.getToken();
    if (!token) return { ok: false, error: 'Not signed in' };
    return API.request(path, {
      headers: { Authorization: 'Bearer ' + token }
    });
  }

  async function loadFounderOverview() {
    const box = $('founder-kpis');
    if (!box) return;
    box.innerHTML = '<div class="kpi glass"><span class="kpi-label">Loading</span><span class="kpi-value">…</span></div>';
    const res = await founderFetch('/api/founder/overview');
    if (!res.ok) {
      box.innerHTML = '<div class="kpi glass"><span class="kpi-label">Access</span><span class="kpi-value">' +
        (res.error || res.data && res.data.error || 'Denied') + '</span></div>';
      return;
    }
    const d = res.data.data || res.data;
    const u = d.users || {};
    const c = d.content || {};
    const ai = d.ai || {};
    box.innerHTML = [
      ['Total users', u.total],
      ['Students', u.students],
      ['Parents', u.parents],
      ['Teachers', u.teachers],
      ['New (7d)', u.newLast7Days],
      ['Active riddles', c.activeRiddles],
      ['AI devices today', ai.devicesActiveToday],
      ['AI requests today', ai.requestsToday]
    ].map(function (row) {
      return '<div class="kpi glass"><span class="kpi-label">' + row[0] + '</span><span class="kpi-value">' +
        (row[1] != null ? row[1] : '—') + '</span></div>';
    }).join('');
  }

  async function loadFounderUsers() {
    const box = $('founder-users-table');
    if (!box) return;
    box.textContent = 'Loading…';
    const res = await founderFetch('/api/founder/users?limit=50');
    if (!res.ok) {
      box.textContent = res.error || 'Forbidden';
      return;
    }
    const list = (res.data && res.data.data) || [];
    if (!list.length) {
      box.textContent = 'No users yet.';
      return;
    }
    box.innerHTML = '<table class="f-table"><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Joined</th></tr></thead><tbody>' +
      list.map(function (u) {
        return '<tr><td>' + (u.username || '') + '</td><td>' + (u.role || '') + '</td><td>' +
          (u.status || '') + '</td><td>' + (u.createdAt ? String(u.createdAt).slice(0, 10) : '') + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  async function loadFounderRiddles() {
    const box = $('founder-riddles-box');
    if (!box) return;
    box.textContent = 'Loading…';
    const res = await founderFetch('/api/founder/riddles/summary');
    if (!res.ok) {
      box.textContent = res.error || 'Forbidden';
      return;
    }
    const d = (res.data && res.data.data) || {};
    const cats = (d.byCategory || []).map(function (c) {
      return '<li>' + (c._id || 'unknown') + ': ' + c.count + '</li>';
    }).join('');
    box.innerHTML = '<p>Total: ' + (d.total || 0) + ' · Active: ' + (d.active || 0) + '</p><ul>' + cats + '</ul>';
  }

  function mpStatusLabel(status) {
    const map = {
      WAITING: 'Waiting for players.',
      READY: 'Lobby ready — host can start.',
      STARTING: 'Starting match…',
      PLAYING: 'Match in progress.',
      FINISHED: 'Match finished.',
      CANCELLED: 'Room closed.'
    };
    return map[status] || status;
  }

  function renderMpRoom(room, session) {
    const home = $('mp-home');
    const lobby = $('mp-lobby');
    if (!room || !session) {
      if (home) home.hidden = false;
      if (lobby) lobby.hidden = true;
      return;
    }
    if (home) home.hidden = true;
    if (lobby) lobby.hidden = false;
    const codeEl = $('mp-room-code');
    if (codeEl) codeEl.textContent = room.roomCode;
    const linkEl = $('mp-room-link');
    if (linkEl) {
      const path = room.link || ('/multiplayer/' + room.roomCode);
      linkEl.textContent = (location.origin || '') + path + ' · ' + (room.playerCount || 0) + '/' + (room.maxPlayers || 2);
    }
    const statusEl = $('mp-status-text');
    if (statusEl) statusEl.textContent = mpStatusLabel(room.status);
    const roleEl = $('mp-role-banner');
    const isHost = room.hostPlayerId === session.playerId;
    if (roleEl) roleEl.textContent = isHost ? 'YOU ARE THE HOST' : 'YOU ARE A GUEST';
    const guestEl = $('mp-guest-id');
    if (guestEl) guestEl.textContent = 'You are ' + session.playerId + (isHost ? ' (host)' : ' (guest)');
    const slots = $('mp-slots');
    if (slots) {
      const players = room.players || [];
      const cap = room.maxPlayers || 2;
      let html = '';
      for (let i = 0; i < cap; i++) {
        const p = players[i];
        if (!p) {
          html += '<div class="mp-slot glass"><div><div class="mp-slot-id">Open seat</div><div class="mp-slot-meta">Waiting…</div></div><span class="mp-pill off">Empty</span></div>';
        } else {
          const you = p.playerId === session.playerId ? ' (you)' : '';
          const host = p.isHost ? ' · HOST' : ' · GUEST';
          html +=
            '<div class="mp-slot glass"><div><div class="mp-slot-id">' +
            p.playerId +
            you +
            '</div><div class="mp-slot-meta">' +
            (p.connected ? 'Online' : 'Away') +
            host +
            '</div></div><span class="mp-pill' +
            (p.ready ? '' : ' off') +
            '">' +
            (p.ready ? 'Ready' : 'Not ready') +
            '</span></div>';
        }
      }
      slots.innerHTML = html;
    }
    const pendingBox = $('mp-pending');
    if (pendingBox) {
      const pending = room.pending || [];
      if (!pending.length) pendingBox.innerHTML = '';
      else {
        pendingBox.innerHTML = '<h3>Waiting to join</h3>' + pending.map(function (p) {
          return '<div class="mp-slot glass"><div class="mp-slot-id">' + p.playerId + '</div>' +
            (isHost
              ? '<button type="button" class="btn-primary btn-mp-admit" data-id="' + p.playerId + '">Allow</button> <button type="button" class="btn-secondary btn-mp-decline" data-id="' + p.playerId + '">Decline</button>'
              : '<span class="mp-pill">Waiting for host</span>') + '</div>';
        }).join('');
      }
    }
    const live = $('mp-live-ranks');
    if (live) {
      if (room.status === 'PLAYING' && room.liveRanks && room.liveRanks.length) {
        live.hidden = false;
        live.innerHTML = '<h3>Live rankings</h3><ol>' + room.liveRanks.map(function (r) {
          return '<li>' + r.playerId + ' — ' + r.score + (r.finished ? ' (finished)' : '') + '</li>';
        }).join('') + '</ol>';
      } else live.hidden = true;
    }
    const loading = $('mp-loading');
    if (loading) loading.hidden = room.status !== 'STARTING';
    const me = (room.players || []).find(function (p) {
      return p.playerId === session.playerId;
    });
    const readyBtn = $('btn-mp-ready');
    if (readyBtn) {
      readyBtn.textContent = me && me.ready ? 'Unready' : "I'm Ready";
      readyBtn.hidden = room.status === 'PLAYING' || room.status === 'STARTING' || room.status === 'FINISHED' || room.status === 'CANCELLED';
    }
    const startBtn = $('btn-mp-start');
    if (startBtn) {
      startBtn.hidden = !(isHost && (room.status === 'READY' || room.status === 'WAITING'));
    }
    paintMpPlay(room);
  }

  function formatClock(ms) {
    const n = Math.max(0, parseInt(ms, 10) || 0);
    const s = Math.floor(n / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
  }

  function paintClock(id, remainingMs) {
    const el = $(id);
    if (!el) return;
    el.textContent = '⏱️ ' + formatClock(remainingMs);
    el.classList.toggle('warn', remainingMs != null && remainingMs <= 30000 && remainingMs > 10000);
    el.classList.toggle('danger', remainingMs != null && remainingMs <= 10000);
  }

  function paintMpPlay(room) {
    const play = $('mp-play');
    const results = $('mp-results');
    if (!room) {
      if (play) play.hidden = true;
      if (results) results.hidden = true;
      return;
    }
    if (room.status === 'FINISHED' && room.results) {
      if (play) play.hidden = true;
      if (results) {
        results.hidden = false;
        results.innerHTML =
          '<h3>Final results</h3><ol>' +
          room.results.map(function (row) {
            const medal = row.rank === 1 ? '1st' : row.rank === 2 ? '2nd' : row.rank === 3 ? '3rd' : '#' + row.rank;
            return '<li>' + medal + ' — ' + row.playerId + ' — ' + row.score + '</li>';
          }).join('') +
          '</ol><button type="button" class="btn-secondary" id="btn-mp-share-score">Share my score</button>';
      }
      return;
    }
    if (results) results.hidden = true;
    const q = room.currentQuestion;
    if (!q || room.status !== 'PLAYING') {
      if (play) play.hidden = true;
      return;
    }
    if (play) play.hidden = false;
    paintClock('mp-clock', room.remainingMs);
    const meta = $('mp-q-meta');
    if (meta) meta.textContent = 'Question ' + ((room.yourIndex || 0) + 1) + ' / ' + (room.questionCount || 5) + ' · score ' + (room.yourScore || 0);
    const text = $('mp-q-text');
    if (text) text.textContent = q.question;
    const opts = $('mp-q-opts');
    if (opts) {
      opts.innerHTML = (q.options || []).map(function (o) {
        return '<button type="button" class="btn-secondary mp-opt">' + o + '</button>';
      }).join(' ');
      opts.onclick = async function (ev) {
        const btn = ev.target.closest('.mp-opt');
        if (!btn || typeof Multiplayer === 'undefined') return;
        const res = await Multiplayer.answer(q.id, btn.textContent);
        if (!res.ok) showToast(res.error || 'Answer failed', { emoji: '⚠️', type: 'info' });
        else renderMpRoom(res.room, Multiplayer.session());
      };
    }
  }

  let mpLastStatus = null;

  function renderMultiplayer() {
    if (typeof Multiplayer === 'undefined') return;
    Multiplayer.setOnUpdate(function (room, session) {
      renderMpRoom(room, session);
      if (room && room.status === 'PLAYING' && mpLastStatus !== 'PLAYING') {
        showToast('Match started.', { emoji: '🎮', type: 'info', duration: 2500 });
      }
      mpLastStatus = room ? room.status : null;
    });
    const session = Multiplayer.session();
    if (session) {
      Multiplayer.startPolling();
      Multiplayer.fetchRoom();
    } else {
      mpLastStatus = null;
      renderMpRoom(null, null);
    }
  }

  function bindMultiplayer() {
    const createBtn = $('btn-mp-create');
    if (createBtn) {
      createBtn.addEventListener('click', async function () {
        if (typeof Multiplayer === 'undefined') return;
        createBtn.disabled = true;
        const capEl = $('mp-cap');
        const cap = capEl ? parseInt(capEl.value, 10) : 2;
        const timeEl = $('mp-time');
        const mins = timeEl ? parseInt(timeEl.value, 10) : 10;
        if (mins > 15) {
          createBtn.disabled = false;
          showToast('⭐ PRO FEATURE — custom timer is Pro Coming Soon. Using 10 minutes.', { emoji: '⭐', type: 'info', duration: 4000 });
        }
        const res = await Multiplayer.createRoom(cap, mins > 15 ? 10 : mins);
        createBtn.disabled = false;
        if (!res.ok) {
          if (res.code === 'PRO_REQUIRED') {
            showToast('⭐ PRO FEATURE — larger rooms are Pro Coming Soon. Payment is not connected.', { emoji: '⭐', type: 'info', duration: 4500 });
          } else {
            showToast(res.error || 'Could not create room', { emoji: '⚠️', type: 'info' });
          }
          return;
        }
        renderMpRoom(res.room, Multiplayer.session());
        showToast('Room created. Share the code!', { emoji: '🤝', type: 'reward' });
      });
    }
    const joinBtn = $('btn-mp-join');
    if (joinBtn) {
      joinBtn.addEventListener('click', async function () {
        if (typeof Multiplayer === 'undefined') return;
        const input = $('mp-join-code');
        const code = input ? input.value : '';
        joinBtn.disabled = true;
        const res = await Multiplayer.joinRoom(code);
        joinBtn.disabled = false;
        if (!res.ok) {
          showToast(res.error || 'Could not join', { emoji: '⚠️', type: 'info' });
          return;
        }
        renderMpRoom(res.room, Multiplayer.session());
        showToast(res.waiting ? 'Waiting for the host to allow you in' : 'Joined room ' + res.room.roomCode, { emoji: '🤝', type: 'reward' });
      });
    }
    const copyBtn = $('btn-mp-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', async function () {
        const code = $('mp-room-code');
        const text = code ? code.textContent : '';
        try {
          if (navigator.clipboard) await navigator.clipboard.writeText(text);
          showToast('Copied ' + text, { emoji: '📋', type: 'info' });
        } catch (e) {
          showToast(text, { emoji: '📋', type: 'info' });
        }
      });
    }
    const readyBtn = $('btn-mp-ready');
    if (readyBtn) {
      readyBtn.addEventListener('click', async function () {
        if (typeof Multiplayer === 'undefined') return;
        const session = Multiplayer.session();
        const currentlyReady = readyBtn.textContent === 'Unready';
        const res = await Multiplayer.setReady(!currentlyReady);
        if (!res.ok) showToast(res.error || 'Could not update ready', { emoji: '⚠️', type: 'info' });
        else renderMpRoom(res.room, session);
      });
    }
    const startBtn = $('btn-mp-start');
    if (startBtn) {
      startBtn.addEventListener('click', async function () {
        if (typeof Multiplayer === 'undefined') return;
        const res = await Multiplayer.startMatch();
        if (!res.ok) showToast(res.error || 'Cannot start yet', { emoji: '⚠️', type: 'info' });
        else renderMpRoom(res.room, Multiplayer.session());
      });
    }
    const shareRoomBtn = $('btn-mp-share');
    if (shareRoomBtn) {
      shareRoomBtn.addEventListener('click', function () {
        const session = typeof Multiplayer !== 'undefined' ? Multiplayer.session() : null;
        const code = session && session.roomCode;
        if (!code) return;
        const url = location.origin + '/multiplayer/' + code;
        const text = 'I CREATED A RIDDLE GAME!\nThink you can beat me?\nJOIN MY GAME\n' + url;
        if (typeof Share !== 'undefined' && Share.shareText) Share.shareText(text, null, 'multiplayer');
        else if (navigator.clipboard) navigator.clipboard.writeText(url);
        showToast('Room link share initiated', { emoji: '🔗', type: 'info' });
      });
    }
    const pendingBox = $('mp-pending');
    if (pendingBox && !pendingBox.dataset.bound) {
      pendingBox.dataset.bound = '1';
      pendingBox.addEventListener('click', async function (e) {
        const admit = e.target.closest('.btn-mp-admit');
        const decline = e.target.closest('.btn-mp-decline');
        if (admit && Multiplayer.admit) {
          const res = await Multiplayer.admit(admit.getAttribute('data-id'));
          if (!res.ok) showToast(res.error || 'Allow failed', { emoji: '⚠️', type: 'info' });
          else renderMpRoom(res.room, Multiplayer.session());
        }
        if (decline && Multiplayer.decline) {
          const res = await Multiplayer.decline(decline.getAttribute('data-id'));
          if (!res.ok) showToast(res.error || 'Decline failed', { emoji: '⚠️', type: 'info' });
          else renderMpRoom(res.room, Multiplayer.session());
        }
      });
    }
    const resultsBox = $('mp-results');
    if (resultsBox && !resultsBox.dataset.bound) {
      resultsBox.dataset.bound = '1';
      resultsBox.addEventListener('click', function (e) {
        if (!e.target.closest('#btn-mp-share-score')) return;
        const session = Multiplayer.session();
        const code = session && session.roomCode;
        const url = location.origin + '/multiplayer/' + (code || '');
        const text = 'I finished a Riddle Realm multiplayer match.\nJOIN MY GAME\n' + url;
        if (typeof Share !== 'undefined' && Share.shareText) Share.shareText(text, null, 'multiplayer');
        showToast('Score share initiated', { emoji: '📤', type: 'info' });
      });
    }
    const leaveBtn = $('btn-mp-leave');
    if (leaveBtn) {
      leaveBtn.addEventListener('click', async function () {
        if (typeof Multiplayer === 'undefined') return;
        await Multiplayer.leaveRoom();
        renderMpRoom(null, null);
        showToast('Left the room', { emoji: '👋', type: 'info' });
      });
    }
  }

  function handleDeepLinks() {
    const path = (location.pathname || '').replace(/\/+$/, '');
    const parts = path.split('/').filter(Boolean);
    if (parts[0] === 'multiplayer' && parts[1]) {
      showScreen('multiplayer');
      if (typeof Multiplayer !== 'undefined') {
        const code = String(parts[1]).toUpperCase();
        const existing = Multiplayer.session();
        if (existing && existing.roomCode === code) {
          Multiplayer.startPolling();
          Multiplayer.fetchRoom();
        } else {
          Multiplayer.joinRoom(code).then(function (res) {
            if (res.ok) renderMpRoom(res.room, Multiplayer.session());
            else showToast(res.error || 'Could not join room', { emoji: '⚠️', type: 'info' });
          });
        }
      }
      return;
    }
    if (parts[0] === 'battle' && parts[1]) {
      showScreen('battle');
      renderBattleList();
      if (typeof Battle !== 'undefined') {
        Battle.get(parts[1]).then(function (res) {
          if (!res.ok) showToast(res.error || 'Battle not found', { emoji: '⚠️', type: 'info' });
        });
      }
      return;
    }
    if (parts[0] === 'challenge' && parts[1]) {
      showScreen('challenge');
      openIncomingChallenge(parts[1]);
    }
  }

  async function renderBattleList() {
    const box = $('battle-list');
    if (!box || typeof Battle === 'undefined') return;
    box.textContent = 'Loading battles…';
    const res = await Battle.list();
    if (!res.ok) {
      box.textContent = res.error || 'Could not load battles. Is the server running?';
      return;
    }
    const list = res.battles || [];
    if (!list.length) {
      box.innerHTML = '<div class="glass mp-card"><h3>NO ACTIVE RIDDLE BATTLES</h3><p>Be the first to create one!</p></div>';
      return;
    }
    box.innerHTML = list.map(function (b) {
      return (
        '<div class="glass mp-card">' +
        '<h3>' + (b.name || 'Battle') + '</h3>' +
        '<p class="panel-sub">' + (b.type || '') + ' · ' + (b.status || '') + ' · ' + (b.participantCount || 0) + ' players</p>' +
        '<p class="panel-sub">' + (b.description || '') + '</p>' +
        '<button type="button" class="btn-primary btn-battle-join" data-id="' + b.battleId + '">Join & Play</button> ' +
        '<button type="button" class="btn-secondary btn-battle-share" data-id="' + b.battleId + '" data-name="' + (b.name || 'Battle') + '">Share</button>' +
        '</div>'
      );
    }).join('');
  }

  function bindBattle() {
    const createBtn = $('btn-battle-create');
    if (createBtn) {
      createBtn.addEventListener('click', async function () {
        if (typeof Battle === 'undefined' || !Battle.create) return;
        createBtn.disabled = true;
        const res = await Battle.create({
          name: ($('battle-name') || {}).value,
          description: ($('battle-desc') || {}).value,
          type: ($('battle-type') || {}).value || 'special',
          timerMinutes: parseInt(($('battle-timer') || {}).value, 10) || 60
        });
        createBtn.disabled = false;
        if (!res.ok) {
          showToast(res.error || 'Could not create battle', { emoji: '⚠️', type: 'info' });
          return;
        }
        const created = $('battle-created');
        const path = (res.battle && res.battle.link) || ('/battle/' + res.battle.battleId);
        const url = (res.share && res.share.url) || ((location.origin || '') + path);
        if (created) {
          created.hidden = false;
          created.innerHTML = '<h3>RIDDLE GAME BATTLE CREATED!</h3><p>' + (res.battle.name || '') + '</p><p>' + (res.battle.description || '') + '</p><p>BATTLE LINK</p><p id="battle-new-link">' + url + '</p><button type="button" class="btn-secondary" id="btn-battle-copy-link">Copy link</button> <button type="button" class="btn-secondary" id="btn-battle-share-new">Share battle</button> <button type="button" class="btn-primary" id="btn-battle-start-play" data-id="' + res.battle.battleId + '">Start playing</button>';
          const copy = $('btn-battle-copy-link');
          if (copy) copy.onclick = function () { if (typeof Share !== 'undefined') Share.shareText(url, 'copy', 'battle'); };
          const sh = $('btn-battle-share-new');
          if (sh) sh.onclick = function () { if (typeof Share !== 'undefined') Share.shareText('RIDDLE BATTLE IS LIVE!\nCan you reach #1?\n' + url, null, 'battle'); };
          const play = $('btn-battle-start-play');
          if (play) play.onclick = async function () {
            const join = await Battle.join(play.getAttribute('data-id'));
            if (!join.ok) showToast(join.error || 'Cannot open battle', { emoji: '⚠️', type: 'info' });
            else paintBattleQuestion();
          };
        }
        showToast('Battle created', { emoji: '⚔️', type: 'reward' });
        renderBattleList();
      });
    }
    const list = $('battle-list');
    if (!list) return;
    list.addEventListener('click', async function (e) {
      const join = e.target.closest('.btn-battle-join');
      const share = e.target.closest('.btn-battle-share');
      if (share) {
        const url = location.origin + '/battle/' + share.getAttribute('data-id');
        const text = 'RIDDLE BATTLE IS LIVE!\nCan you reach #1?\nJoin the competition.\nJOIN THE BATTLE\n' + url;
        if (typeof Share !== 'undefined' && Share.shareText) Share.shareText(text, null, 'battle');
        showToast('Battle share initiated', { emoji: '⚔️', type: 'info' });
        return;
      }
      if (!join) return;
      const res = await Battle.join(join.getAttribute('data-id'));
      if (!res.ok) {
        showToast(res.error || 'Cannot join battle', { emoji: '⚠️', type: 'info' });
        return;
      }
      paintBattleQuestion();
    });
  }

  function paintBattleQuestion() {
    const playBox = $('battle-play');
    const list = $('battle-list');
    const result = $('battle-result');
    if (result) result.hidden = true;
    const q = Battle.currentQuestion();
    if (!q) {
      finishBattle();
      return;
    }
    if (list) list.hidden = true;
    if (playBox) playBox.hidden = false;
    const sess = Battle.session();
    const liveT = $('battle-timer-live');
    if (liveT) {
      liveT.hidden = false;
      paintClock('battle-timer-live', Battle.remaining ? Battle.remaining() : 0);
    }
    $('battle-q-meta').textContent = 'Question ' + (sess.index + 1) + ' / ' + sess.questions.length;
    $('battle-q-text').textContent = q.question;
    const opts = $('battle-q-opts');
    opts.innerHTML = (q.options || []).map(function (o) {
      return '<button type="button" class="btn-secondary battle-opt">' + o + '</button>';
    }).join(' ');
    opts.onclick = function (ev) {
      const btn = ev.target.closest('.battle-opt');
      if (!btn) return;
      const done = Battle.answerCurrent(btn.textContent);
      if (done.done) finishBattle();
      else paintBattleQuestion();
    };
  }

  async function finishBattle() {
    const playBox = $('battle-play');
    if (playBox) playBox.hidden = true;
    const res = await Battle.submit();
    const box = $('battle-result');
    if (!box) return;
    box.hidden = false;
    if (!res.ok) {
      box.textContent = res.error || 'Submit failed';
      return;
    }
    const d = res.data || {};
    const r = d.result || {};
    const lb = (d.leaderboard && d.leaderboard.top) || [];
    const you = d.leaderboard && d.leaderboard.you;
    box.innerHTML =
      '<h3>Verified score: ' + (r.score || 0) + '</h3>' +
      '<p>' + (r.correct || 0) + ' / ' + (r.total || 0) + ' correct</p>' +
      (you ? '<p>Your position: #' + you.rank + '</p>' : '') +
      '<ol>' +
      lb.slice(0, 10).map(function (row) {
        return '<li>' + row.player + ' — ' + row.score + (row.you ? ' (you)' : '') + '</li>';
      }).join('') +
      '</ol><button type="button" class="btn-secondary" id="btn-battle-share-score">Share my score</button>';
    const shareBtn = $('btn-battle-share-score');
    if (shareBtn) {
      shareBtn.onclick = function () {
        const url = location.origin + '/battle/' + ((d.battle && d.battle.battleId) || '');
        const text = 'RIDDLE GAME BATTLE\nI scored ' + (r.score || 0) + ' points\n' + (you ? 'I finished #' + you.rank + '\n' : '') + 'Can you beat my score?\n' + url;
        if (typeof Share !== 'undefined') Share.shareText(text, null, 'battle');
        showToast('Score share initiated', { emoji: '📤', type: 'info' });
      };
    }
    Battle.clear();
    const list = $('battle-list');
    if (list) list.hidden = false;
    renderBattleList();
  }

  function renderChallengeHome() {
    const scoreEl = $('challenge-score');
    if (scoreEl && !scoreEl.value) {
      const p = typeof Storage !== 'undefined' && Storage.loadPlayer ? Storage.loadPlayer() : {};
      if (p && p.bestScore) scoreEl.value = p.bestScore;
    }
  }

  function bindChallenge() {
    const createBtn = $('btn-ch-create');
    if (createBtn) {
      createBtn.addEventListener('click', async function () {
        const n = parseInt(($('challenge-score') || {}).value, 10) || 0;
        const res = await Challenge.create(n, 'classic');
        if (!res.ok) {
          showToast(res.error || 'Could not create challenge', { emoji: '⚠️', type: 'info' });
          return;
        }
        const msg = Challenge.message(res.challenge);
        $('challenge-out').textContent = msg;
        $('challenge-share-row').hidden = false;
        $('challenge-share-row').dataset.text = msg;
      });
    }
    function shareCh(channel) {
      const row = $('challenge-share-row');
      if (!row || row.hidden) return;
      if (typeof Share !== 'undefined' && Share.shareText) Share.shareText(row.dataset.text, channel, 'challenge');
      showToast('Challenge share initiated', { emoji: '🔥', type: 'info' });
    }
    if ($('btn-ch-wa')) $('btn-ch-wa').onclick = function () { shareCh('whatsapp'); };
    if ($('btn-ch-copy')) $('btn-ch-copy').onclick = function () { shareCh('copy'); };
    if ($('btn-ch-native')) $('btn-ch-native').onclick = function () { shareCh('native'); };
    if ($('btn-ch-accept')) {
      $('btn-ch-accept').onclick = function () {
        showToast('Play Classic, then return and submit your score.', { emoji: '🔥', type: 'info', duration: 4000 });
        window._rrPendingChallenge = window._rrIncomingChallenge;
        showScreen('modes');
      };
    }
    if ($('btn-ch-submit')) {
      $('btn-ch-submit').onclick = async function () {
        const ch = window._rrIncomingChallenge;
        if (!ch) return;
        const p = typeof Storage !== 'undefined' && Storage.loadPlayer ? Storage.loadPlayer() : {};
        const score = (p && p.bestScore) || 0;
        const res = await Challenge.submit(ch.challengeId, score);
        const done = $('challenge-done');
        if (!res.ok) {
          showToast(res.error || 'Submit failed', { emoji: '⚠️', type: 'info' });
          return;
        }
        done.hidden = false;
        done.innerHTML = res.data.beaten
          ? '<h3>You beat ' + res.data.hostName + '!</h3><p>You ' + res.data.yours + ' vs ' + res.data.target + '</p>'
          : '<h3>Nice try</h3><p>You ' + res.data.yours + ' vs ' + res.data.target + '</p>';
      };
    }
  }

  async function openIncomingChallenge(id) {
    const res = await Challenge.open(id);
    const box = $('challenge-incoming');
    if (!box) return;
    box.hidden = false;
    if (!res.ok) {
      $('ch-in-title').textContent = 'Challenge unavailable';
      $('ch-in-meta').textContent = res.error || 'Not found';
      return;
    }
    window._rrIncomingChallenge = res.challenge;
    $('ch-in-title').textContent = (res.challenge.hostName || 'A friend') + ' scored ' + res.challenge.targetScore;
    $('ch-in-meta').textContent = 'Level ' + res.challenge.level + (res.challenge.streak ? ' · streak ' + res.challenge.streak : '');
  }

  return {
    init,
    runSplash,
    showScreen,
    renderArenaLibrary,
    refreshPlayerUI,
    renderGameScreen,
    renderDailyStatus,
    renderStreakUI,
    startCategoryGame,
    startModeGame,
    renderAchievements,
    renderMissions,
    renderShop,
    renderLeaderboard,
    renderAiDashboard,
    renderProDashboard,
    renderMultiplayer,
    showToast,
    trackMission,
    toggleTheme
  };
})();



