// js/exam-engine.js
// ตรรกะหลักของการสุ่มข้อสอบและบันทึกผล (ใช้ร่วมกันทุกโหมด) — Supabase เวอร์ชัน

/**
 * ดึงคำถามทั้งหมดที่ active ตามเงื่อนไข filter (categoryId / examYearId)
 * filter = { categoryId: string|null, examYearId: string|null }
 */
async function fetchActiveQuestions(filter = {}) {
  let query = sb.from("questions").select("*").eq("is_active", true);

  if (filter.categoryId) {
    query = query.eq("category_id", filter.categoryId);
  }
  if (filter.examYearId) {
    query = query.eq("exam_year_id", filter.examYearId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapQuestionRow);
}

/**
 * โหลด set ของ "ข้อที่เคยเจอแล้ว" ของผู้ใช้คนนี้
 */
async function getSeenQuestionIds(uid) {
  // ใช้ maybeSingle() เพราะผู้ใช้ใหม่จะยังไม่มีแถวนี้เลย (ไม่ใช่ error)
  const { data, error } = await sb
    .from("user_seen_questions")
    .select("seen_question_ids")
    .eq("user_id", uid)
    .maybeSingle();

  if (error) throw error;
  return new Set(data?.seen_question_ids || []);
}

/**
 * บันทึกข้อที่ออกในรอบนี้เข้า "ประวัติข้อที่เคยเจอ" ของผู้ใช้ (merge ไม่ให้ซ้ำ)
 */
async function markQuestionsAsSeen(uid, questionIds) {
  const { data: existing } = await sb
    .from("user_seen_questions")
    .select("seen_question_ids")
    .eq("user_id", uid)
    .maybeSingle();

  const existingIds = existing?.seen_question_ids || [];
  const merged = Array.from(new Set([...existingIds, ...questionIds]));

  const { error } = await sb
    .from("user_seen_questions")
    .upsert({ user_id: uid, seen_question_ids: merged }, { onConflict: "user_id" });

  if (error) throw error;
}

/**
 * สุ่ม n ข้อ โดยพยายามเลี่ยงข้อที่ผู้ใช้เคยเจอมาแล้วก่อน
 * ถ้าข้อที่ยังไม่เคยเจอมีไม่พอ จะ fallback สุ่มเติมจากข้อที่เคยเจอแล้ว
 *
 * @param {string} uid
 * @param {number} count จำนวนข้อที่ต้องการ
 * @param {object} filter { categoryId, examYearId } — ส่ง null ทั้งคู่ถ้าต้องการสุ่มจากทั้งคลัง
 * @returns {Promise<{questions: Array, usedFallback: boolean}>}
 */
async function drawQuestionsNoRepeat(uid, count, filter = {}) {
  const allQuestions = await fetchActiveQuestions(filter);
  const seenIds = await getSeenQuestionIds(uid);

  const unseen = allQuestions.filter((q) => !seenIds.has(q.id));
  const seen = allQuestions.filter((q) => seenIds.has(q.id));

  let selected = [];
  let usedFallback = false;

  if (unseen.length >= count) {
    selected = sampleArray(unseen, count);
  } else {
    // ใช้ข้อที่ยังไม่เคยเจอทั้งหมดก่อน แล้วเติมจากข้อที่เคยเจอแล้ว
    selected = unseen.slice();
    const remaining = count - unseen.length;
    if (remaining > 0 && seen.length > 0) {
      usedFallback = true;
      selected = selected.concat(sampleArray(seen, remaining));
    }
  }

  return { questions: selected, usedFallback, totalAvailable: allQuestions.length };
}

/**
 * บันทึก attempt ใหม่ตอนเริ่มทำข้อสอบ (ก่อนตอบ) คืน attemptId
 */
async function createExamAttempt({ userId, mode, categoryId = null, examYearId = null, questionIds }) {
  const { data, error } = await sb
    .from("exam_attempts")
    .insert({
      user_id: userId,
      mode,
      category_id: categoryId,
      exam_year_id: examYearId,
      question_ids: questionIds,
      user_answers: new Array(questionIds.length).fill(-1),
      score: 0,
      total_questions: questionIds.length,
      duration_seconds: 0
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

/**
 * บันทึกผลตอนทำข้อสอบเสร็จ + อัปเดตสถิติผู้ใช้ + อัปเดต seen questions
 */
async function finishExamAttempt({ attemptId, userId, userAnswers, questions, durationSeconds }) {
  let score = 0;
  userAnswers.forEach((answer, idx) => {
    if (answer === questions[idx].correctAnswerIndex) score++;
  });

  const expGained = score * EXP_PER_CORRECT_ANSWER;

  const { error: updateAttemptError } = await sb
    .from("exam_attempts")
    .update({
      user_answers: userAnswers,
      score,
      exp_gained: expGained,
      finished_at: new Date().toISOString(),
      duration_seconds: durationSeconds
    })
    .eq("id", attemptId);

  if (updateAttemptError) throw updateAttemptError;

  // อัปเดตสถิติผู้ใช้ + คำนวณ EXP ที่ได้รับจากรอบนี้ (10 EXP ต่อข้อที่ตอบถูก)
  const { data: profile, error: profileFetchError } = await sb
    .from("profiles")
    .select("total_attempts, best_score, total_exp")
    .eq("id", userId)
    .single();

  if (profileFetchError) throw profileFetchError;

  const newTotalAttempts = (profile.total_attempts || 0) + 1;
  const newBestScore = Math.max(profile.best_score || 0, score);
  const previousTotalExp = profile.total_exp || 0;
  const newTotalExp = previousTotalExp + expGained;

  const levelBefore = calculateLevelInfo(previousTotalExp).level;
  const levelAfter = calculateLevelInfo(newTotalExp).level;
  const leveledUp = levelAfter > levelBefore;

  const { error: profileUpdateError } = await sb
    .from("profiles")
    .update({
      total_attempts: newTotalAttempts,
      best_score: newBestScore,
      total_exp: newTotalExp,
      last_attempt_at: new Date().toISOString()
    })
    .eq("id", userId);

  if (profileUpdateError) throw profileUpdateError;

  // บันทึกว่าข้อเหล่านี้ "เคยเจอแล้ว" (เฉพาะโหมด full100 ตามที่ออกแบบไว้ เพื่อกันสุ่มซ้ำข้ามรอบ)
  await markQuestionsAsSeen(userId, questions.map((q) => q.id));

  return {
    score,
    total: questions.length,
    expGained,
    newTotalExp,
    leveledUp,
    newLevel: levelAfter
  };
}
