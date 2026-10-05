import { supabase } from '../supabaseClient';
import { EXAM_SETS, RAW_QUESTION_BANK } from '../data/examData';

export async function fetchExamSets() {
  try {
    const { data, error } = await supabase.from('exam_sets').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    if (!data || !data.length) return EXAM_SETS;
    return data;
  } catch (err) {
    console.warn('[fetchExamSets] fallback to local data', err?.message || err);
    return EXAM_SETS;
  }
}

export async function fetchQuestionsForExam(exam) {
  try {
    // Prefer questions linked to exam_set_id
    if (exam?.id) {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('exam_set_id', exam.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (data && data.length) return data.map(mapRowToQuestion);
    }

    // Fallback by category
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
      return RAW_QUESTION_BANK.filter(q => {
        if (exam.category === 'math_thai') return q.cat === 'math' || q.cat === 'thai';
        return q.cat === exam.category;
      });
    }

    return RAW_QUESTION_BANK.slice(0, Math.min(exam.question_count || 10, RAW_QUESTION_BANK.length));
  } catch (err) {
    console.warn('[fetchQuestionsForExam] fallback to local bank', err?.message || err);
    if (exam?.category) {
      return RAW_QUESTION_BANK.filter(q => (exam.category === 'math_thai' ? (q.cat === 'math' || q.cat === 'thai') : q.cat === exam.category));
    }
    return RAW_QUESTION_BANK.slice(0, Math.min(exam.question_count || 10, RAW_QUESTION_BANK.length));
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
