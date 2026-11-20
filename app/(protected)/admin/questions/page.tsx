import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { QuestionManager } from "@/components/admin/question-manager";
export default async function QuestionsPage(){
 await requireAdmin(); const supabase=await createClient();
 const [{data:categories,error:catError},{data:questions,error:qError}]=await Promise.all([
  supabase.from("categories").select("id,name").order("sort_order"),
  supabase.from("questions").select("id,category_id,cat,sub,question_text,options,correct_answer_index,explanation,difficulty").is("deleted_at",null).eq("is_active",true).order("created_at",{ascending:false}).limit(50)
 ]);
 return <section className="stack"><div><Link href="/admin" className="gold">← Admin</Link><h1>คลังข้อสอบ</h1><p className="muted">จัดการข้อสอบและเฉลย — เฉพาะ Admin เท่านั้น</p></div>{catError&&<p role="alert">{catError.message}</p>}{qError&&<p role="alert">{qError.message}</p>}<QuestionManager categories={categories??[]} initial={(questions??[]) as never[]}/></section>;
}
