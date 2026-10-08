#!/usr/bin/env node
// scripts/import-questions.mjs
// ═══════════════════════════════════════════════════════════════
// Import JSON questions เข้า Supabase
// วิธีใช้:
//   node scripts/import-questions.mjs data/kp2569b-questions.json
//
// ต้องตั้งค่า env:
//   SUPABASE_URL=https://xxx.supabase.co
//   SUPABASE_SERVICE_KEY=<service_role_key>  ← ใช้ service_role เพื่อ bypass RLS
// ═══════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// ─── Colors ───
const C = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

// ─── Args ───
const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error(`${C.red}❌ วิธีใช้: node scripts/import-questions.mjs <path-to-json>${C.reset}`);
  console.error(`${C.gray}   ตัวอย่าง: node scripts/import-questions.mjs data/kp2569b-questions.json${C.reset}`);
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(`${C.red}❌ ต้องตั้งค่าตัวแปรสภาพแวดล้อม:${C.reset}`);
  console.error(`${C.gray}   SUPABASE_URL=https://xxx.supabase.co${C.reset}`);
  console.error(`${C.gray}   SUPABASE_SERVICE_KEY=<service_role_key>${C.reset}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// ─── Main ───
async function main() {
  console.log(`${C.cyan}══════════════════════════════════════════${C.reset}`);
  console.log(`${C.cyan}Import Questions Script${C.reset}`);
  console.log(`${C.cyan}══════════════════════════════════════════${C.reset}`);

  // 1. อ่านไฟล์ JSON
  const absPath = resolve(jsonPath);
  console.log(`\n${C.gray}📄 อ่านไฟล์: ${absPath}${C.reset}`);

  let data;
  try {
    const raw = readFileSync(absPath, "utf-8");
    data = JSON.parse(raw);
  } catch (err) {
    console.error(`${C.red}❌ อ่าน/parse JSON ไม่สำเร็จ: ${err.message}${C.reset}`);
    process.exit(1);
  }

  const { paper, categoryMap, questions } = data;

  if (!paper || !categoryMap || !Array.isArray(questions)) {
    console.error(`${C.red}❌ JSON ไม่ครบฟิลด์ (paper / categoryMap / questions)${C.reset}`);
    process.exit(1);
  }

  console.log(`${C.green}✓${C.reset} พบ ${questions.length} คำถาม`);
  console.log(`${C.green}✓${C.reset} Paper: ${paper.code} — ${paper.label}`);

  // 2. Upsert paper
  console.log(`\n${C.cyan}[1/2] สร้าง/อัปเดต paper${C.reset}`);

  const { data: existingPaper } = await supabase
    .from("exam_years")
    .select("id")
    .eq("code", paper.code)
    .maybeSingle();

  let paperId;
  if (existingPaper) {
    paperId = existingPaper.id;
    console.log(`${C.yellow}⚠${C.reset}  Paper "${paper.code}" มีอยู่แล้ว — ใช้ ID เดิม`);

    // อัปเดต metadata
    await supabase
      .from("exam_years")
      .update({
        label: paper.label,
        year: paper.year,
        description: paper.description,
        is_active: paper.is_active,
      })
      .eq("id", paperId);
    console.log(`${C.green}✓${C.reset} อัปเดต metadata paper`);
  } else {
    const { data: newPaper, error } = await supabase
      .from("exam_years")
      .insert({
        code: paper.code,
        label: paper.label,
        year: paper.year,
        description: paper.description,
        is_active: paper.is_active,
      })
      .select("id")
      .single();

    if (error) {
      console.error(`${C.red}❌ สร้าง paper ไม่สำเร็จ: ${error.message}${C.reset}`);
      process.exit(1);
    }
    paperId = newPaper.id;
    console.log(`${C.green}✓${C.reset} สร้าง paper ใหม่: ${paperId}`);
  }

  // 3. ตรวจว่ามี questions อยู่แล้วไหม
  const { count: existingCount } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("exam_year_id", paperId);

  if (existingCount > 0) {
    console.log(`\n${C.yellow}⚠  Paper นี้มี ${existingCount} คำถามอยู่แล้ว${C.reset}`);
    console.log(`${C.yellow}   เพื่อป้องกันข้อมูลซ้ำ จะทำการลบของเก่าออกก่อน${C.reset}`);

    const { error: delErr } = await supabase
      .from("questions")
      .delete()
      .eq("exam_year_id", paperId);

    if (delErr) {
      console.error(`${C.red}❌ ลบคำถามเก่าไม่สำเร็จ: ${delErr.message}${C.reset}`);
      process.exit(1);
    }
    console.log(`${C.green}✓${C.reset} ลบคำถามเก่า ${existingCount} ข้อ`);
  }

  // 4. แปลง questions → insert rows
  console.log(`\n${C.cyan}[2/2] Insert ${questions.length} คำถาม${C.reset}`);

  const rows = questions.map((q, idx) => {
    const categoryId = categoryMap[q.categoryKey];
    if (!categoryId) {
      console.error(`${C.red}❌ แถว ${idx + 1}: categoryKey "${q.categoryKey}" ไม่มีใน categoryMap${C.reset}`);
      process.exit(1);
    }

    return {
      category_id: categoryId,
      exam_year_id: paperId,
      question_text: q.question_text,
      table_data: q.table_data || null,
      options: q.options,
      correct_answer_index: q.correct_answer_index,
      explanation: q.explanation,
      difficulty: q.difficulty || "medium",
      is_active: true,
      source: "manual",
      cat: q.cat,
      sub: q.sub,
    };
  });

  // 5. Batch insert (100 แถวต่อครั้ง)
  const BATCH_SIZE = 100;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("questions").insert(batch);

    if (error) {
      console.error(`${C.red}❌ Insert batch ${i / BATCH_SIZE + 1} ไม่สำเร็จ: ${error.message}${C.reset}`);
      process.exit(1);
    }

    inserted += batch.length;
    console.log(`${C.green}✓${C.reset} Insert แล้ว ${inserted}/${rows.length}`);
  }

  // 6. สรุป
  console.log(`\n${C.cyan}══════════════════════════════════════════${C.reset}`);
  console.log(`${C.green}✅ สำเร็จ!${C.reset}`);
  console.log(`${C.cyan}══════════════════════════════════════════${C.reset}`);
  console.log(`  Paper ID:    ${paperId}`);
  console.log(`  Paper Code:  ${paper.code}`);
  console.log(`  Questions:   ${inserted}`);
  console.log("");
}

main().catch((err) => {
  console.error(`${C.red}❌ ข้อผิดพลาดร้ายแรง: ${err.message}${C.reset}`);
  process.exit(1);
});