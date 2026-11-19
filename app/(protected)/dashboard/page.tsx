import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardExamPicker } from "@/components/dashboard-exam-picker";

export default async function DashboardPage() {
  const profile = await requireUser();
  const supabase = await createClient();

  const [{ data: categories }, { data: years }] = await Promise.all([
    supabase.from("categories").select("id, name, sort_order").eq("is_active", true).order("sort_order"),
    supabase.from("exam_years").select("id, label, year").eq("is_active", true).order("year", { ascending: false }),
  ]);

  const categoryOptions = await Promise.all((categories ?? []).map(async item => {
    const { count } = await supabase.from("v_questions_public").select("id", { count: "exact", head: true }).eq("category_id", item.id);
    return { id: item.id, name: item.name, count: count ?? 0 };
  }));
  const yearOptions = await Promise.all((years ?? []).map(async item => {
    const { count } = await supabase.from("v_questions_public").select("id", { count: "exact", head: true }).eq("exam_year_id", item.id);
    return { id: item.id, label: item.label || String(item.year), count: count ?? 0 };
  }));

  return (
    <section className="stack">
      <div>
        <p className="gold" style={{ fontWeight: 700, marginBottom: 6 }}>พื้นที่เตรียมสอบ ก.พ. 2569</p>
        <h1 style={{ fontSize: 32, margin: "8px 0" }}>สวัสดี {profile.display_name}</h1>
        <p className="muted">เลือกภารกิจเพื่อเริ่มฝึกทำข้อสอบ</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
        <div className="card"><p className="muted" style={{ margin: 0 }}>ทำข้อสอบแล้ว</p><h2 style={{ marginBottom: 0 }}>{profile.total_attempts}</h2></div>
        <div className="card"><p className="muted" style={{ margin: 0 }}>คะแนนดีที่สุด</p><h2 style={{ marginBottom: 0 }}>{profile.best_score}</h2></div>
        <div className="card"><p className="muted" style={{ margin: 0 }}>EXP สะสม</p><h2 style={{ marginBottom: 0 }}>{profile.total_exp}</h2></div>
      </div>
      <DashboardExamPicker categories={categoryOptions} years={yearOptions} />
    </section>
  );
}
