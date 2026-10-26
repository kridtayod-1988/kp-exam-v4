// scripts/classify-questions.mjs

// ใช้:  node scripts/classify-questions.mjs --in data/questions.json --dry

//       node scripts/classify-questions.mjs --in data/questions.json --apply

//       เพิ่ม --llm เพื่อให้ AI ช่วยข้อที่ confidence ต่ำ

import fs from 'node:fs/promises';

import { createClient } from '@supabase/supabase-js';

import { TAXONOMY, RULES } from './taxonomy.mjs';


const arg = (k, d = null) => {

  const i = process.argv.indexOf(k);

  return i > -1 ? (process.argv[i + 1]?.startsWith('--') ? true : process.argv[i + 1]) : d;

};

const IN = arg('--in', 'data/questions.json');

const APPLY = process.argv.includes('--apply');

const USE_LLM = process.argv.includes('--llm');

const THRESHOLD = Number(arg('--threshold', 0.45));


const byCode = Object.fromEntries(TAXONOMY.map(t => [t.code, t]));

const ancestors = code => {

  const out = []; let c = byCode[code];

  while (c) { out.unshift(c.code); c = c.parent ? byCode[c.parent] : null; }

  return out;

};


/* ---------- 1) กฎ keyword + น้ำหนัก ---------- */

function ruleClassify(q) {

  const text = [q.question_text, ...(q.choices || []).map(c => c.text || c)].join('\n');

  const score = {};

  const hits = {};

  for (const [re, code, w] of RULES) {

    const m = text.match(re);

    if (!m) continue;

    score[code] = (score[code] || 0) + w;

    (hits[code] ||= []).push(m[0].slice(0, 30));

  }

  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);

  if (!ranked.length) return { code: null, confidence: 0, hits: [] };

  const total = ranked.reduce((s, [, v]) => s + v, 0);

  const [code, top] = ranked[0];

  const margin = ranked[1] ? (top - ranked[1][1]) / top : 1;

  const confidence = Math.min(1, (top / total) * 0.7 + margin * 0.3);

  return { code, confidence: +confidence.toFixed(2), hits: hits[code], runnerUp: ranked[1]?.[0] ?? null };

}


/* ---------- 2) ประมาณความยาก ---------- */

function estimateDifficulty(q) {

  const t = q.question_text || '';

  const len = t.length;

  const numeric = (t.match(/\d/g) || []).length;

  const multiStep = /แล้ว|จากนั้น|ถ้า.*และ|หากว่า/.test(t);

  let s = 0;

  if (len > 400) s += 2; else if (len > 180) s += 1;

  if (numeric > 12) s += 1;

  if (multiStep) s += 1;

  if (/เงื่อนไขสัญลักษณ์|ละเมิด|คำสั่งทางปกครอง/.test(t)) s += 1;

  return s >= 3 ? 'hard' : s >= 1 ? 'medium' : 'easy';

}


/* ---------- 3) LLM fallback (เฉพาะข้อ confidence ต่ำ) ---------- */

async function llmClassify(batch) {

  const key = process.env.GEMINI_API_KEY;

  if (!key) { console.warn('⚠️  ไม่มี GEMINI_API_KEY — ข้าม LLM'); return {}; }

  const labels = TAXONOMY.filter(t => t.level >= 2).map(t => `${t.code} = ${t.th}`).join('\n');

  const prompt = `คุณคือผู้เชี่ยวชาญข้อสอบ ก.พ. จำแนกข้อสอบแต่ละข้อเข้า code ที่ตรงที่สุด

รายการ code:

${labels}


ตอบเป็น JSON array เท่านั้น: [{"id":<id>,"code":"<CODE>","confidence":0-1,"reason":"สั้นๆ"}]


ข้อสอบ:

${batch.map(q => `#${q.id}: ${q.question_text.slice(0, 500)}`).join('\n---\n')}`;


  const res = await fetch(

    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,

    { method: 'POST', headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }],

        generationConfig: { temperature: 0, responseMimeType: 'application/json' } }) });

  const json = await res.json();

  const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';

  try { return Object.fromEntries(JSON.parse(raw).map(r => [r.id, r])); }

  catch { console.warn('⚠️  parse LLM ไม่สำเร็จ'); return {}; }

}


/* ---------- main ---------- */

const questions = JSON.parse(await fs.readFile(IN, 'utf8'));

console.log(`📚 โหลดข้อสอบ ${questions.length} ข้อ`);


const results = questions.map((q, i) => {

  const r = ruleClassify(q);

  return { id: q.id ?? i + 1, question_text: q.question_text, ...r,

    difficulty: q.difficulty || estimateDifficulty(q), source: r.code ? 'rule' : 'none' };

});


if (USE_LLM) {

  const weak = results.filter(r => r.confidence < THRESHOLD);

  console.log(`🤖 ส่งให้ LLM ช่วย ${weak.length} ข้อ`);

  for (let i = 0; i < weak.length; i += 20) {

    const map = await llmClassify(weak.slice(i, i + 20));

    for (const r of weak.slice(i, i + 20)) {

      const g = map[r.id];

      if (g?.code && byCode[g.code]) {

        Object.assign(r, { code: g.code, confidence: g.confidence ?? 0.6, source: 'llm', reason: g.reason });

      }

    }

  }

}


const enriched = results.map(r => {

  const path = r.code ? ancestors(r.code) : [];

  return { id: r.id, subject_code: path[0] ?? 'UNCLASSIFIED', area_code: path[1] ?? null,

    topic_code: path[2] ?? null, difficulty: r.difficulty,

    classify_confidence: r.confidence, classify_source: r.source,

    needs_review: r.confidence < THRESHOLD, matched: r.hits ?? [] };

});


/* ---------- รายงาน ---------- */

const tally = {};

for (const e of enriched) tally[e.area_code || e.subject_code] = (tally[e.area_code || e.subject_code] || 0) + 1;

console.table(Object.entries(tally).map(([code, n]) =>

  ({ code, ชื่อ: byCode[code]?.th ?? '-', จำนวน: n, 'สัดส่วน %': ((n / enriched.length) * 100).toFixed(1) })));

const review = enriched.filter(e => e.needs_review);

console.log(`\n🔎 ต้องตรวจซ้ำ ${review.length} ข้อ → ${review.map(r => r.id).join(', ') || '-'}`);


await fs.mkdir('out', { recursive: true });

await fs.writeFile('out/classified.json', JSON.stringify(enriched, null, 2));

await fs.writeFile('out/review.csv',

  'id,subject,area,topic,difficulty,confidence,source\n' +

  enriched.map(e => [e.id, e.subject_code, e.area_code, e.topic_code, e.difficulty, e.classify_confidence, e.classify_source].join(',')).join('\n'));

console.log('💾 เขียน out/classified.json และ out/review.csv แล้ว');


if (!APPLY) { console.log('\n(dry-run — ใส่ --apply เพื่อเขียนลง Supabase)'); process.exit(0); }


const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

for (let i = 0; i < enriched.length; i += 50) {

  const chunk = enriched.slice(i, i + 50).map(({ matched, ...rest }) => rest);

  const { error } = await sb.from('questions').upsert(chunk, { onConflict: 'id' });

  if (error) { console.error('❌', error.message); process.exit(1); }

  console.log(`✅ อัปเดต ${Math.min(i + 50, enriched.length)}/${enriched.length}`);

}

console.log('🎉 เสร็จสิ้น');
