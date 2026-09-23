/**
 * Riddle Realm — AIService (Phase 18B)
 * =====================================
 * Frontend abstraction for AI features.
 * Local/offline helpers use existing riddle data only.
 * Real provider calls belong on a secure backend (Phase 22).
 * Never holds API keys.
 */
const AIService = (function () {
  'use strict';

  const BACKEND_URL = '/api/ai'; // Phase 22 anonymous usage API

  function fail(reason, message) {
    return {
      success: false,
      type: 'error',
      content: message || 'AI is unavailable right now.',
      metadata: { reason: reason || 'error' }
    };
  }

  function ok(type, content, metadata) {
    return {
      success: true,
      type: type,
      content: content,
      metadata: metadata || {}
    };
  }

  function ensureEntitled(feature) {
    if (typeof Entitlements === 'undefined') {
      return { ok: false, response: fail('no_entitlements', 'Entitlements not loaded.') };
    }
    if (!Entitlements.hasFeature(feature)) {
      return {
        ok: false,
        response: fail('pro_required', 'This AI feature is available on Pro. Upgrade to unlock.')
      };
    }
    const usage = Entitlements.consumeAiUsage(feature);
    if (!usage.ok) {
      return {
        ok: false,
        response: fail(
          'limit_reached',
          'FREE AI LIMIT REACHED — you used all ' + usage.limit + ' free AI requests for today. Resets tomorrow, or view Pro.'
        )
      };
    }
    return { ok: true, usage: usage };
  }

  /**
   * Local hint helper — uses riddle.hint / category, never invents the answer.
   */
  function localHint(riddle, advanced) {
    if (!riddle) return fail('invalid', 'No riddle selected.');
    if (riddle.hint && String(riddle.hint).trim()) {
      const prefix = advanced ? 'Advanced tip: ' : 'Hint: ';
      return ok('hint', prefix + riddle.hint, { source: 'local', advanced: !!advanced });
    }
    const cat = riddle.category ? ' Focus on the "' + riddle.category + '" theme.' : '';
    const diff = riddle.difficulty ? ' Difficulty is marked ' + riddle.difficulty + '.' : '';
    return ok(
      'hint',
      'Think about the wording carefully.' + cat + diff + ' Try eliminating impossible options first.',
      { source: 'local_fallback', advanced: !!advanced }
    );
  }

  function localExplain(riddle) {
    if (!riddle) return fail('invalid', 'No riddle selected.');
    if (riddle.explanation && String(riddle.explanation).trim()) {
      return ok('explanation', riddle.explanation, { source: 'local' });
    }
    if (riddle.answer) {
      return ok(
        'explanation',
        'The accepted answer is “' + riddle.answer + '”. Re-read the riddle and match each clue to that idea.',
        { source: 'local_fallback' }
      );
    }
    return fail('empty', 'No explanation is available for this riddle yet.');
  }

  function localAsk(riddle, question) {
    if (!riddle) return fail('invalid', 'No riddle selected.');
    const q = (question || '').trim().toLowerCase();
    if (!q) return fail('invalid', 'Type a question about this riddle.');
    if (q.indexOf('answer') >= 0 && q.indexOf('what is') >= 0) {
      return ok(
        'ask',
        'I won’t spoil the full answer here. Try a hint first, or use a letter reveal if you need a nudge.',
        { source: 'local' }
      );
    }
    if (q.indexOf('hint') >= 0) {
      return localHint(riddle, false);
    }
    if (q.indexOf('category') >= 0 || q.indexOf('topic') >= 0) {
      return ok(
        'ask',
        riddle.category
          ? 'This riddle sits in the “' + riddle.category + '” category.'
          : 'Category isn’t tagged on this riddle.',
        { source: 'local' }
      );
    }
    return ok(
      'ask',
      'Focus on the exact wording. Everyday objects and double meanings are common in riddles. Use a hint if you’re stuck.',
      { source: 'local' }
    );
  }

  // ---- Public API (same shape for local + future backend) ----

  function generateHint(ctx) {
    const feature = ctx && ctx.advanced ? 'ai_advanced_hint' : 'ai_hint';
    if (ctx && ctx.advanced && typeof Entitlements !== 'undefined' && !Entitlements.hasFeature('ai_advanced_hint')) {
      // Fall back to basic hint if advanced locked
      const gate = ensureEntitled('ai_hint');
      if (!gate.ok) return Promise.resolve(gate.response);
      return Promise.resolve(localHint(ctx.riddle, false));
    }
    const gate = ensureEntitled(feature === 'ai_advanced_hint' ? 'ai_advanced_hint' : 'ai_hint');
    if (!gate.ok) return Promise.resolve(gate.response);
    return Promise.resolve(localHint(ctx && ctx.riddle, !!(ctx && ctx.advanced)));
  }

  function explainRiddle(ctx) {
    const gate = ensureEntitled('ai_explain');
    if (!gate.ok) return Promise.resolve(gate.response);
    return Promise.resolve(localExplain(ctx && ctx.riddle));
  }

  function answerQuestion(ctx) {
    const gate = ensureEntitled('ai_ask');
    if (!gate.ok) return Promise.resolve(gate.response);
    return Promise.resolve(localAsk(ctx && ctx.riddle, ctx && ctx.question));
  }

  function generateRiddle(ctx) {
    if (typeof Entitlements !== 'undefined' && !Entitlements.hasFeature('ai_practice')) {
      return Promise.resolve(
        fail('pro_required', 'AI practice generation is a Pro feature.')
      );
    }
    const gate = ensureEntitled('ai_practice');
    if (!gate.ok) return Promise.resolve(gate.response);

    // Phase 18B: no private AI key on client. Offer a local practice pick from the bank.
    if (typeof Riddles !== 'undefined' && Riddles.getAll) {
      const all = Riddles.getAll() || [];
      let pool = all.slice();
      if (ctx && ctx.category) {
        const filtered = pool.filter(function (r) {
          return r.category === ctx.category;
        });
        if (filtered.length) pool = filtered;
      }
      if (ctx && ctx.difficulty) {
        const filtered = pool.filter(function (r) {
          return r.difficulty === ctx.difficulty;
        });
        if (filtered.length) pool = filtered;
      }
      if (pool.length) {
        const r = pool[Math.floor(Math.random() * pool.length)];
        return Promise.resolve(
          ok(
            'practice_riddle',
            {
              id: 'practice_' + (r.id || Date.now()),
              question: r.question,
              answer: r.answer,
              options: r.options,
              hint: r.hint,
              explanation: r.explanation,
              category: r.category,
              difficulty: r.difficulty,
              tags: r.tags || [],
              practice: true,
              source: 'local_bank'
            },
            { note: 'Practice from your local riddle bank. Server-side AI generation comes in Phase 22.' }
          )
        );
      }
    }
    return Promise.resolve(
      fail('unavailable', 'Practice riddles need the local bank or a future AI backend.')
    );
  }

  function generateChallenge(ctx) {
    if (typeof Entitlements !== 'undefined' && !Entitlements.hasFeature('ai_personalized')) {
      return Promise.resolve(fail('pro_required', 'Personalized challenges are a Pro feature.'));
    }
    const gate = ensureEntitled('ai_personalized');
    if (!gate.ok) return Promise.resolve(gate.response);
    const player = typeof Storage !== 'undefined' ? Storage.loadPlayer() : {};
    return Promise.resolve(
      ok(
        'challenge',
        {
          title: 'Personal stretch',
          description:
            'Play a Timed run and try to beat your best score of ' +
            (player.bestScore || 0) +
            '. Stay sharp on categories you play most.',
          suggestedMode: 'timed'
        },
        { source: 'local_rules' }
      )
    );
  }

  function recommendCategory(ctx) {
    const gate = ensureEntitled('ai_hint');
    if (!gate.ok) return Promise.resolve(gate.response);
    if (typeof Riddles !== 'undefined' && Riddles.getCategories) {
      const cats = Riddles.getCategories() || [];
      if (cats.length) {
        const pick = cats[Math.floor(Math.random() * cats.length)];
        return Promise.resolve(
          ok('recommend', 'Try the “' + (pick.name || pick.id || pick) + '” category next.', {
            category: pick.id || pick.name || pick,
            source: 'local'
          })
        );
      }
    }
    return Promise.resolve(ok('recommend', 'Mix Classic and Daily Challenge to keep improving.', {}));
  }

  function analyzePerformance() {
    if (typeof Storage === 'undefined') {
      return fail('no_player', 'Player data is not available.');
    }
    const p = Storage.loadPlayer();
    const acc = Storage.getAccuracy(p);
    const lines = [
      'Performance is based on this device only.',
      'Games played: ' + (p.gamesPlayed || 0),
      'Correct answers: ' + (p.totalCorrect || 0),
      'Wrong answers: ' + (p.totalWrong || 0),
      'Accuracy: ' + (acc == null ? 'No data yet' : acc + '%'),
      'Best score: ' + (p.bestScore || 0),
      'Current streak: ' + (p.currentStreak || 0),
      'Best streak: ' + (p.bestStreak || 0),
      'Level: ' + (p.level || 1) + ' · XP ' + (p.xp || 0) + '/' + (p.xpNeeded || 100)
    ];
    return ok('analyze', lines.join('\n'), { source: 'local_stats' });
  }

  function isBackendConfigured() {
    return !!BACKEND_URL;
  }

  return {
    generateHint: generateHint,
    explainRiddle: explainRiddle,
    answerQuestion: answerQuestion,
    generateRiddle: generateRiddle,
    generateChallenge: generateChallenge,
    recommendCategory: recommendCategory,
    analyzePerformance: analyzePerformance,
    isBackendConfigured: isBackendConfigured,
    BACKEND_URL: BACKEND_URL
  };
})();
