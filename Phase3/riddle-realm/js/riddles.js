/**
 * Riddle Realm — Riddle Loader (Phase 3)
 * =======================================
 * Reads from window.RIDDLE_DATA (data/riddles-data.js).
 * All game modes use this module to fetch and check riddles.
 *
 * To add riddles: edit data/riddles-data.js only.
 */
const Riddles = (function () {
  'use strict';

  function getData() {
    if (typeof window !== 'undefined' && Array.isArray(window.RIDDLE_DATA)) {
      return window.RIDDLE_DATA;
    }
    // Fallback for non-browser / tests
    if (typeof global !== 'undefined' && Array.isArray(global.RIDDLE_DATA)) {
      return global.RIDDLE_DATA;
    }
    console.warn('[Riddles] RIDDLE_DATA not found. Load data/riddles-data.js first.');
    return [];
  }

  /**
   * Normalize answer for comparison
   */
  function normalize(str) {
    return String(str)
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, ''); // strip punctuation for friendlier matching
  }

  /**
   * Get all riddles, optionally filtered
   * @param {string|null} category
   * @param {string|null} difficulty  easy|medium|hard|expert
   */
  function getAll(category = null, difficulty = null) {
    let list = getData().slice();
    if (category && category !== 'all') {
      list = list.filter(r => r.category === category);
    }
    if (difficulty && difficulty !== 'all') {
      list = list.filter(r => r.difficulty === difficulty);
    }
    return list;
  }

  /**
   * Fisher-Yates shuffle (returns new array)
   */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * Get a session of riddles
   * @param {string|null} category
   * @param {number} limit
   * @param {string|null} difficulty
   */
  function getSession(category = null, limit = 10, difficulty = null) {
    const pool = getAll(category, difficulty);
    if (!pool.length) return [];
    return shuffle(pool).slice(0, Math.min(limit, pool.length));
  }

  /**
   * Check user answer against riddle
   */
  function checkAnswer(riddle, userAnswer) {
    if (!riddle || userAnswer == null) return false;
    const correct = normalize(riddle.answer);
    const given = normalize(userAnswer);

    if (given === correct) return true;

    // Also accept exact option text match when the stored answer is the short form
    if (Array.isArray(riddle.options)) {
      for (const opt of riddle.options) {
        if (normalize(opt) === given && normalize(opt) === correct) return true;
        // If the option text itself normalizes to the answer key
        if (normalize(opt) === given && normalize(opt).includes(correct)) return true;
      }
    }
    return false;
  }

  /**
   * List of categories that currently have at least one riddle
   */
  function getCategories() {
    const set = new Set(getData().map(r => r.category));
    return Array.from(set).sort();
  }

  /**
   * Count helpers
   */
  function count(category = null) {
    return getAll(category).length;
  }

  function countByDifficulty() {
    const result = { easy: 0, medium: 0, hard: 0, expert: 0 };
    getData().forEach(r => {
      if (result[r.difficulty] !== undefined) result[r.difficulty]++;
    });
    return result;
  }

  /**
   * Get a single riddle by id
   */
  function getById(id) {
    return getData().find(r => r.id === id) || null;
  }

  return {
    getAll,
    getSession,
    checkAnswer,
    getCategories,
    count,
    countByDifficulty,
    getById,
    normalize,
    shuffle
  };
})();
