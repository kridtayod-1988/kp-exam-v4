"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type BlueprintRule = { category_id?: string; cat?: string; sub_codes?: string[]; quota: number; pass_pct?: number; name?: string };

export async function saveBlueprintAction(input: {
  id?: string; code: string; title: string; description?: string;
  timeLimitMinutes: number; rules: BlueprintRule[]; isActive: boolean;
}) {
  const admin = await requireAdmin();
  const code = input.code.trim().toUpperCase();
  const title = input.title.trim();
  if (!/^[A-Z0-9_-]{2,60}$/.test(code)) throw new Error("รหัส Blueprint ต้องเป็น A-Z, 0-9, _ หรือ -");
  if (title.length < 2 || title.length > 160) throw new Error("กรุณาระบุชื่อ Blueprint 2-160 ตัวอักษร");
  if (!Number.isInteger(input.timeLimitMinutes) || input.timeLimitMinutes < 1 || input.timeLimitMinutes > 600) throw new Error("เวลาไม่ถูกต้อง");
  if (!Array.isArray(input.rules) || input.rules.length === 0) throw new Error("กรุณากำหนดโควตาอย่างน้อยหนึ่งหมวด");
  const rules = input.rules.filter(r => Number.isInteger(r.quota) && r.quota > 0);
  const total = rules.reduce((sum, rule) => sum + rule.quota, 0);
  if (total < 1 || total > 200 || rules.length !== input.rules.length) throw new Error("โควตารวมต้องอยู่ระหว่าง 1-200 ข้อ และทุกหมวดต้องมีโควตามากกว่า 0");
  for (const rule of rules) {
    if ((!rule.category_id || !/^[0-9a-f-]{36}$/i.test(rule.category_id)) && !rule.cat) throw new Error("แต่ละกฎต้องระบุ category_id หรือ cat");
    if (rule.sub_codes && (!Array.isArray(rule.sub_codes) || rule.sub_codes.some(x => typeof x !== "string" || x.length > 40))) throw new Error("รหัสหมวดย่อยไม่ถูกต้อง");
  }

  const supabase = await createClient();
  const payload = {
    code, title, description: input.description?.trim() || null,
    total_questions: total, time_limit_minutes: input.timeLimitMinutes,
    rules, is_active: input.isActive, created_by: admin.id, updated_at: new Date().toISOString(),
  };
  const result = input.id
    ? await supabase.from("exam_blueprints").update(payload).eq("id", input.id)
    : await supabase.from("exam_blueprints").insert(payload);
  if (result.error) throw new Error(result.error.message);
  revalidatePath("/admin/blueprints");
  revalidatePath("/dashboard");
}

export async function toggleBlueprintAction(id: string, isActive: boolean) {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Blueprint ID ไม่ถูกต้อง");
  const supabase = await createClient();
  const { error } = await supabase.from("exam_blueprints").update({ is_active: isActive, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/blueprints");
  revalidatePath("/dashboard");
}

export async function reviewAiDraftAction(id: string, decision: "approve" | "reject") {
  const admin = await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Draft ID ไม่ถูกต้อง");
  const supabase = await createClient();
  const { data: draft, error: readError } = await supabase.from("ai_question_drafts")
    .select("id,payload,status").eq("id", id).single();
  if (readError || !draft) throw new Error("ไม่พบ AI Draft");
  if (draft.status !== "draft") throw new Error("Draft นี้ได้รับการตรวจสอบแล้ว");

  if (decision === "approve") {
    const payload = draft.payload as Record<string, unknown>;
    const allowed = ["category_id","cat","sub","question_text","table_data","options","correct_answer_index","explanation","difficulty","source"];
    const question = Object.fromEntries(Object.entries(payload).filter(([key]) => allowed.includes(key)));
    const { error: insertError } = await supabase.from("questions").insert({
      ...question, source: "ai_generated", created_by: admin.id, is_active: true,
    });
    if (insertError) throw new Error("บันทึกข้อสอบไม่สำเร็จ: " + insertError.message);
  }
  const { error: updateError } = await supabase.from("ai_question_drafts").update({
    status: decision === "approve" ? "approved" : "rejected",
    reviewed_at: new Date().toISOString(), reviewed_by: admin.id,
  }).eq("id", id).eq("status", "draft");
  if (updateError) throw new Error(updateError.message);
  revalidatePath("/admin/ai-generator");
  revalidatePath("/admin/questions");
}

export async function saveQuestionAction(input: {
  id?: string; categoryId: string; examYearId?: string; cat?: string; sub?: string;
  questionText: string; options: string[]; correctIndex: number; explanation: string;
  difficulty: "easy"|"medium"|"hard"; tableData?: unknown;
}) {
  const admin = await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(input.categoryId)) throw new Error("กรุณาเลือกหมวดวิชา");
  if (input.examYearId && !/^[0-9a-f-]{36}$/i.test(input.examYearId)) throw new Error("ปีข้อสอบไม่ถูกต้อง");
  const questionText = input.questionText.trim();
  if (questionText.length < 5 || questionText.length > 2000) throw new Error("โจทย์ต้องมีความยาว 5-2,000 ตัวอักษร");
  if (!Array.isArray(input.options) || input.options.length !== 4 || input.options.some(x => !x.trim() || x.length > 500)) throw new Error("ต้องมีตัวเลือกครบ 4 ข้อ");
  if (!Number.isInteger(input.correctIndex) || input.correctIndex < 0 || input.correctIndex > 3) throw new Error("เฉลยต้องอยู่ระหว่างตัวเลือก 1-4");
  if (!["easy","medium","hard"].includes(input.difficulty)) throw new Error("ระดับความยากไม่ถูกต้อง");
  const supabase = await createClient();
  const payload = {
    category_id: input.categoryId, exam_year_id: input.examYearId || null,
    cat: input.cat?.trim() || null, sub: input.sub?.trim() || null,
    question_text: questionText, options: input.options.map(x=>x.trim()),
    correct_answer_index: input.correctIndex, explanation: input.explanation.trim(),
    difficulty: input.difficulty, table_data: input.tableData ?? null,
    updated_at: new Date().toISOString(),
  };
  const result = input.id
    ? await supabase.from("questions").update(payload).eq("id",input.id).is("deleted_at",null)
    : await supabase.from("questions").insert({...payload,created_by:admin.id,source:"manual",is_active:true});
  if (result.error) throw new Error(result.error.message);
  revalidatePath("/admin/questions");
  revalidatePath("/dashboard");
}

export async function softDeleteQuestionAction(id: string) {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Question ID ไม่ถูกต้อง");
  const supabase = await createClient();
  const {error}=await supabase.from("questions").update({is_active:false,deleted_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id).is("deleted_at",null);
  if(error) throw new Error(error.message);
  revalidatePath("/admin/questions");
}

function parseCsvRows(csv: string): string[][] {
  const rows: string[][]=[]; let row:string[]=[]; let cell=""; let quoted=false;
  for(let i=0;i<csv.length;i++){
    const ch=csv[i];
    if(ch === '"'){ if(quoted && csv[i+1] === '"'){cell+='"';i++;} else quoted=!quoted; }
    else if(ch === ',' && !quoted){row.push(cell);cell="";}
    else if((ch === "\n" || ch === "\r") && !quoted){ if(ch === "\r" && csv[i+1] === "\n") i++; row.push(cell); if(row.some(v=>v.trim())) rows.push(row); row=[]; cell=""; }
    else cell+=ch;
  }
  row.push(cell); if(row.some(v=>v.trim())) rows.push(row);
  if(quoted) throw new Error("CSV มีเครื่องหมายอัญประกาศไม่ครบ");
  return rows;
}

export async function importQuestionsCsvAction(csv: string) {
  const admin=await requireAdmin();
  if(typeof csv!=="string" || csv.length>1_500_000) throw new Error("ไฟล์ CSV ใหญ่เกินไป (จำกัด 1.5 MB)");
  const rows=parseCsvRows(csv);
  if(rows.length<2) throw new Error("ไม่พบข้อมูลสำหรับนำเข้า");
  const headers=rows[0].map(x=>x.trim());
  const required=["category_id","question_text","options","correct_answer_index","explanation"];
  for(const key of required) if(!headers.includes(key)) throw new Error("CSV ต้องมีคอลัมน์ "+required.join(", "));
  if(rows.length-1>500) throw new Error("นำเข้าได้ไม่เกิน 500 ข้อต่อครั้ง");
  const index=(key:string)=>headers.indexOf(key);
  const data=rows.slice(1).map((cells,i)=>{
    const get=(key:string)=>cells[index(key)] ?? "";
    let options:unknown;
    try{options=JSON.parse(get("options"));}catch{throw new Error("แถว "+(i+2)+": options ต้องเป็น JSON array");}
    const answer=Number(get("correct_answer_index"));
    if(!Array.isArray(options)||options.length!==4||options.some(x=>typeof x!=="string")) throw new Error("แถว "+(i+2)+": ต้องมี options 4 ตัว");
    if(!Number.isInteger(answer)||answer<0||answer>3) throw new Error("แถว "+(i+2)+": correct_answer_index ต้องเป็น 0-3");
    const categoryId=get("category_id").trim();
    if(!/^[0-9a-f-]{36}$/i.test(categoryId)) throw new Error("แถว "+(i+2)+": category_id ไม่ถูกต้อง");
    const difficulty=get("difficulty")||"medium";
    if(!["easy","medium","hard"].includes(difficulty)) throw new Error("แถว "+(i+2)+": difficulty ไม่ถูกต้อง");
    return {
      category_id:categoryId, exam_year_id:get("exam_year_id")||null,
      cat:get("cat")||null, sub:get("sub")||null,
      question_text:get("question_text").trim(), options,
      correct_answer_index:answer, explanation:get("explanation").trim(),
      difficulty, source:"manual", created_by:admin.id, is_active:true,
    };
  });
  const supabase=await createClient();
  for(let i=0;i<data.length;i+=50){
    const {error}=await supabase.from("questions").insert(data.slice(i,i+50));
    if(error) throw new Error("นำเข้าล้มเหลวช่วงแถว "+(i+2)+"-"+Math.min(i+51,rows.length)+": "+error.message);
  }
  revalidatePath("/admin/questions");
  return {count:data.length};
}

export async function saveCategoryAction(input:{id?:string;name:string;sortOrder:number;isActive:boolean}) {
  await requireAdmin();
  const name=input.name.trim();
  if(name.length<2||name.length>100) throw new Error("ชื่อหมวดต้องมี 2-100 ตัวอักษร");
  if(!Number.isInteger(input.sortOrder)||input.sortOrder<0) throw new Error("ลำดับไม่ถูกต้อง");
  const supabase=await createClient();
  const result=input.id
    ? await supabase.from("categories").update({name,sort_order:input.sortOrder,is_active:input.isActive}).eq("id",input.id)
    : await supabase.from("categories").insert({name,sort_order:input.sortOrder,is_active:input.isActive});
  if(result.error) throw new Error(result.error.message);
  revalidatePath("/admin/taxonomy"); revalidatePath("/dashboard");
}

export async function saveExamYearAction(input:{id?:string;label:string;year:number;isActive:boolean}) {
  await requireAdmin();
  const label=input.label.trim();
  if(label.length<2||label.length>50) throw new Error("ชื่อปีข้อสอบต้องมี 2-50 ตัวอักษร");
  if(!Number.isInteger(input.year)||input.year<2500||input.year>2700) throw new Error("กรุณาระบุปี พ.ศ. ให้ถูกต้อง");
  const supabase=await createClient();
  const result=input.id
    ? await supabase.from("exam_years").update({label,year,is_active:input.isActive}).eq("id",input.id)
    : await supabase.from("exam_years").insert({label,year,is_active:input.isActive});
  if(result.error) throw new Error(result.error.message);
  revalidatePath("/admin/taxonomy"); revalidatePath("/dashboard");
}
