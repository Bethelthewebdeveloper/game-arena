/**
 * Development seed: import sample riddles from data/riddles-data.js into MongoDB.
 * Does not delete existing documents. Skips duplicates by externalId/question.
 * Usage: node scripts/seed-riddles.js
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { connectDatabase } = require('../server/config/database');
const Riddle = require('../server/models/Riddle');

function loadLocalRiddles() {
  const file = path.join(__dirname, '..', 'data', 'riddles-data.js');
  const src = fs.readFileSync(file, 'utf8');
  // Evaluate as window-free assignment
  const sandbox = {};
  const wrapped = src.replace(/window\.RIDDLE_DATA\s*=/, 'globalThis.__RIDDLES =');
  // eslint-disable-next-line no-new-func
  const fn = new Function(wrapped + '; return globalThis.__RIDDLES;');
  const data = fn();
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.riddles)) return data.riddles;
  return [];
}

async function main() {
  await connectDatabase();
  const local = loadLocalRiddles();
  console.log('Local riddles found:', local.length);
  if (!local.length) {
    console.log('Nothing to seed.');
    process.exit(0);
  }

  let inserted = 0;
  let skipped = 0;

  for (const r of local.slice(0, 200)) {
    const externalId = String(r.id || r.externalId || '');
    const question = String(r.question || '').trim();
    if (!question || !r.answer) {
      skipped++;
      continue;
    }

    const existing = externalId
      ? await Riddle.findOne({ externalId })
      : await Riddle.findOne({ question });

    if (existing) {
      skipped++;
      continue;
    }

    await Riddle.create({
      externalId: externalId || undefined,
      question,
      answer: String(r.answer),
      options: r.options || [],
      category: r.category || 'general',
      difficulty: r.difficulty === 'normal' ? 'medium' : r.difficulty || 'medium',
      hint: r.hint || '',
      explanation: r.explanation || '',
      tags: r.tags || [],
      xpReward: r.xp || r.xpReward || 10,
      coinReward: r.coins || r.coinReward || 5,
      source: 'seed',
      active: true
    });
    inserted++;
  }

  console.log('Seed complete. Inserted:', inserted, 'Skipped:', skipped);
  console.log('Verify in MongoDB Compass → database Riddles-Game → collection "riddles"');
  process.exit(0);
}

main().catch((e) => {
  console.error('Seed failed:', e.message);
  process.exit(1);
});
