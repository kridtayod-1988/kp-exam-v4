import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AiQuestionGenerator } from "@/components/admin/ai-question-generator";

export default async function AiGeneratorPage() {
  await requireAdmin();
  const supabase=await createClient();
  const [{data:categories,error:categoryError},{data:drafts,error:draftError}]=await Promise.all([
    supabase.from("categories").select("id,name").eq("is_active",true).order("sort_order"),
    supabase.from("ai_question_drafts").select("id,status,created_at").eq("status","draft").order("created_at",{ascending:false}),
  ]);
  return <section className="stack"><div><Link href="/admin" className="gold">← Admin</Link><h1>AI Question Generator</h1><p className="muted">AI สร้างเฉพาะ Draft — Admin ต้องอนุมัติก่อนเผยแพร่</p></div>
    {categoryError && <p role="alert">{categoryError.message}</p>}{draftError && <p role="alert">{draftError.message}</p>}
    <AiQuestionGenerator categories={categories??[]} drafts={drafts??[]}/>
  </section>;
}
