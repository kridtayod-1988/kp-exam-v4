import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BlueprintManager } from "@/components/admin/blueprint-manager";

export default async function BlueprintsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{data:categories,error:categoryError},{data:blueprints,error}] = await Promise.all([
    supabase.from("categories").select("id,name").order("sort_order"),
    supabase.from("exam_blueprints").select("id,code,title,description,total_questions,time_limit_minutes,rules,is_active").order("created_at",{ascending:false}),
  ]);
  return <section className="stack"><div><Link href="/admin" className="gold">← Admin</Link><h1>Exam Blueprints</h1><p className="muted">กำหนดโควตาและเวลา ระบบสุ่มข้อสอบที่ฝั่งฐานข้อมูลเท่านั้น</p></div>
    {categoryError && <p role="alert">โหลดหมวดหมู่ไม่สำเร็จ: {categoryError.message}</p>}
    {error && <p role="alert">โหลด Blueprint ไม่สำเร็จ: {error.message}</p>}
    <BlueprintManager categories={categories ?? []} initial={(blueprints ?? []) as never[]}/>
  </section>;
}
