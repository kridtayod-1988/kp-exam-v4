import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const jsonHeaders = { "Content-Type": "application/json" };
const allowedOrigin = Deno.env.get("APP_ORIGIN") ?? "http://localhost:3000";

function response(body: unknown, status = 200, origin = allowedOrigin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...jsonHeaders,
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    },
  });
}

type Payload = {
  category_id: string;
  cat?: string;
  sub?: string;
  topic?: string;
  count?: number;
  difficulty?: "easy" | "medium" | "hard";
};

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? allowedOrigin;
  if (origin !== allowedOrigin && origin !== "http://localhost:3000") {
    return response({ error: "Origin not allowed" }, 403, allowedOrigin);
  }
  if (req.method === "OPTIONS") return response({ ok: true }, 200, origin);
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405, origin);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return response({ error: "Unauthorized" }, 401, origin);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
    if (!supabaseUrl || !publishableKey || !geminiKey) {
      return response({ error: "Server configuration incomplete" }, 500, origin);
    }

    const supabase = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return response({ error: "Invalid session" }, 401, origin);

    const { data: profile, error: profileError } = await supabase
      .from("profiles").select("role").eq("id", user.id).single();
    if (profileError || profile?.role !== "admin") return response({ error: "Admin access required" }, 403, origin);

    const payload = await req.json() as Payload;
    if (!payload || typeof payload.category_id !== "string") return response({ error: "category_id is required" }, 400, origin);
    const count = Math.max(1, Math.min(Number.isInteger(payload.count) ? Number(payload.count) : 3, 5));
    const difficulty = ["easy", "medium", "hard"].includes(payload.difficulty ?? "") ? payload.difficulty : "medium";
    const { data: category, error: categoryError } = await supabase
      .from("categories").select("id,name").eq("id", payload.category_id).single();
    if (categoryError || !category) return response({ error: "Invalid category" }, 400, origin);

    const prompt = `คุณเป็นผู้เชี่ยวชาญในการออกข้อสอบ ก.พ. ภาษาไทย
สร้างข้อสอบปรนัย ${count} ข้อ หมวด ${category.name}
หัวข้อ: ${String(payload.topic ?? "แนวข้อสอบมาตรฐาน").slice(0, 240)}
รหัสหมวดย่อย: ${String(payload.sub ?? "").slice(0, 40)}
ระดับ: ${difficulty}
ตอบเป็น JSON array เท่านั้น แต่ละ object มี question_text, options (4 ข้อ), correct_answer_index (0-3), explanation
ต้องเป็นคำถามใหม่ ไม่ซ้ำ ไม่อ้างว่าเป็นข้อสอบจริง และเฉลยต้องมีเหตุผลถูกต้อง.`;

    const ai = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
      }),
    });
    if (!ai.ok) {
      const detail = await ai.text();
      console.error("Gemini request failed", ai.status, detail.slice(0, 500));
      return response({ error: "AI provider request failed" }, 502, origin);
    }
    const aiData = await ai.json();
    const text = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string") return response({ error: "AI returned no content" }, 502, origin);
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed) || parsed.length !== count) return response({ error: "AI response count mismatch" }, 502, origin);

    const drafts = parsed.map((item: Record<string, unknown>) => {
      if (typeof item.question_text !== "string" || item.question_text.length < 8 || item.question_text.length > 2000) {
        throw new Error("Invalid question_text");
      }
      if (!Array.isArray(item.options) || item.options.length !== 4 || item.options.some(x => typeof x !== "string" || x.length > 500)) {
        throw new Error("Each question must contain exactly four text options");
      }
      const answer = Number(item.correct_answer_index);
      if (!Number.isInteger(answer) || answer < 0 || answer > 3) throw new Error("Invalid correct_answer_index");
      if (typeof item.explanation !== "string" || item.explanation.length > 2000) throw new Error("Invalid explanation");
      return {
        category_id: category.id,
        cat: typeof payload.cat === "string" ? payload.cat.slice(0, 80) : null,
        sub: typeof payload.sub === "string" ? payload.sub.slice(0, 40) : null,
        question_text: item.question_text,
        options: item.options,
        correct_answer_index: answer,
        explanation: item.explanation,
        difficulty,
        source: "ai_generated",
      };
    });

    const { data: inserted, error: insertError } = await supabase
      .from("ai_question_drafts")
      .insert(drafts.map(payload => ({ created_by: user.id, payload, status: "draft" })))
      .select("id,status,created_at");
    if (insertError) {
      console.error("Draft insert failed", insertError.message);
      return response({ error: "Could not save AI drafts" }, 500, origin);
    }
    return response({ success: true, count: inserted?.length ?? 0, drafts: inserted }, 200, origin);
  } catch (error) {
    console.error("generate-questions error", error);
    return response({ error: error instanceof Error ? error.message : "Internal error" }, 400, origin);
  }
});
