import { supabase } from '../supabaseClient';
import { EXAM_SETS, RAW_QUESTION_BANK } from '../data/examData';

// Toggle Supabase usage via Vite env var: VITE_USE_SUPABASE=true|false
const USE_SUPABASE = (import.meta.env.VITE_USE_SUPABASE || 'true').toLowerCase() === 'true';
const LOCAL_ATTEMPTS_KEY = 'smart_exam_local_attempts';

export async function fetchExamSets() {
  if (!USE_SUPABASE) {
    return EXAM_SETS;
  }

  try {
    const { data, error } = await supabase.from('exam_sets').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return data && data.length ? data : EXAM_SETS;
  } catch (err) {
    console.warn('[fetchExamSets] supabase failed, fallback to local', err?.message || err);
    return EXAM_SETS;
  }
}

export async function fetchQuestionsForExam(exam) {
  // If supabase is disabled, always use local bank
  if (!USE_SUPABASE) {
    if (!exam) return RAW_QUESTION_BANK.slice(0, Math.min(30, RAW_QUESTION_BANK.length));
    if (exam.category === 'math_thai') {
      return RAW_QUESTION_BANK.filter(q => q.cat === 'math' || q.cat === 'thai');
    }
    if (exam.category) {
      return RAW_QUESTION_BANK.filter(q => q.cat === exam.category);
    }
    return RAW_QUESTION_BANK.slice(0, Math.min(exam.question_count || 30, RAW_QUESTION_BANK.length));
  }

  try {
    if (exam?.id) {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('exam_set_id', exam.id)
        .order('created_at', { ascending: true });

      if (!error && data && data.length) return data.map(mapRowToQuestion);
    }

    if (exam?.category) {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('category', exam.category)
        .order('created_at', { ascending: true });

      if (!error && data && data.length) return data.map(mapRowToQuestion);
    }

    // Final fallback: local RAW_QUESTION_BANK filtered by category
    if (exam?.category) {
      return RAW_QUESTION_BANK.filter(q => (exam.category === 'math_thai' ? (q.cat === 'math' || q.cat === 'thai') : q.cat === exam.category));
    }

    return RAW_QUESTION_BANK.slice(0, Math.min(exam.question_count || 30, RAW_QUESTION_BANK.length));
  } catch (err) {
    console.warn('[fetchQuestionsForExam] supabase error, fallback to local', err?.message || err);
    if (exam?.category) {
      return RAW_QUESTION_BANK.filter(q => (exam.category === 'math_thai' ? (q.cat === 'math' || q.cat === 'thai') : q.cat === exam.category));
    }
    return RAW_QUESTION_BANK.slice(0, Math.min(exam.question_count || 30, RAW_QUESTION_BANK.length));
  }
}

export async function saveAttempt({ userId, exam, questions, answers, scoreResult }) {
  // If supabase disabled => skip writing and save locally in browser storage
  if (!USE_SUPABASE) {
    try {
      const existingRaw = localStorage.getItem(LOCAL_ATTEMPTS_KEY);
      const existing = existingRaw ? JSON.parse(existingRaw) : [];

      const record = {
        id: `local-${Date.now()}`,
        user_id: userId,
        exam_set_id: exam?.id || null,
        exam_name: exam?.name || 'Unknown',
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        score: scoreResult.score,
        max_score: scoreResult.total,
        passed: scoreResult.passed,
        percentage: scoreResult.percentage,
        answers: questions.map((q, idx) => ({
          question_id: q.id,
          selected: answers[idx],
          correct: answers[idx] === q.correct,
          text: q.text,
        })),
        createdAt: new Date().toISOString(),
        note: 'local-only-mode'
      };

      localStorage.setItem(LOCAL_ATTEMPTS_KEY, JSON.stringify([...existing, record]));
      return record;
    } catch (err) {
      console.warn('[saveAttempt] localStorage unavailable, fallback to mock object', err?.message || err);
      return {
        id: `local-${Date.now()}`,
        user_id: userId,
        exam_set_id: exam?.id || null,
        exam_name: exam?.name || 'Unknown',
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        score: scoreResult.score,
        max_score: scoreResult.total,
        passed: scoreResult.passed,
        percentage: scoreResult.percentage,
        note: 'local-only-mode-fallback'
      };
    }
  }

  try {
    const startedAt = new Date().toISOString();
    const { data: attempt, error: attemptError } = await supabase
      .from('attempts')
      .insert([{
        user_id: userId,
        exam_set_id: exam.id,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        score: scoreResult.score,
        max_score: scoreResult.total,
        passed: scoreResult.passed,
        meta: {
          exam_name: exam.name,
          questions_total: questions.length,
          percentage: scoreResult.percentage
        }
      }])
      .select()
      .single();

    if (attemptError) throw attemptError;

    const payload = questions.map((q, idx) => ({
      attempt_id: attempt.id,
      question_id: q.id,
      selected: answers[idx],
      correct: answers[idx] === q.correct
    }));

    const { error: answerError } = await supabase.from('answers').insert(payload);
    if (answerError) throw answerError;

    return attempt;
  } catch (err) {
    console.error('[saveAttempt] failed:', err);
    throw err;
  }
}

function mapRowToQuestion(row) {
  return {
    id: row.id,
    cat: row.cat || row.category || 'unknown',
    sub: row.sub || row.subcategory || null,
    text: row.text,
    options: Array.isArray(row.options) ? row.options : (row.options ? JSON.parse(row.options) : []),
    correct: typeof row.correct === 'number' ? row.correct : Number(row.correct) || 0,
    exp: row.exp || row.explanation || ''
  };
}
