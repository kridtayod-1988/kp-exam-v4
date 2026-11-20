"use client";

import { useState } from "react";
import { startExamAction, startBlueprintExamAction, type ExamMode } from "@/lib/exams/actions";

type Option = { id: string; name: string; count: number };
type YearOption = { id: string; label: string; count: number };
type BlueprintOption = { id:string; code:string; title:string; description:string|null; total_questions:number; time_limit_minutes:number };

export function DashboardExamPicker({ categories, years, blueprints }: { categories: Option[]; years: YearOption[]; blueprints: BlueprintOption[] }) {
  const [categoryId, setCategoryId] = useState("");
  const [yearId, setYearId] = useState("");
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function startBlueprint(code: string) {
    setBusy(true); setError("");
    try {
      const result = await startBlueprintExamAction(code);
      window.location.assign(`/exam/${result.attemptId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เริ่ม Blueprint ไม่สำเร็จ");
      setBusy(false);
    }
  }

  async function start(mode: ExamMode) {
    setBusy(true); setError("");
    try {
      const result = await startExamAction({
        mode,
        count,
        categoryId: mode === "category" ? categoryId : undefined,
        examYearId: mode === "year" ? yearId : undefined,
      });
      window.location.assign(`/exam/${result.attemptId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เริ่มข้อสอบไม่สำเร็จ");
      setBusy(false);
    }
  }

  return (
    <section className="stack">
      {blueprints.length > 0 && <div className="card stack">
        <div><h2 style={{margin:0}}>ชุดสอบตาม Blueprint</h2><p className="muted">คัดเลือกและสุ่มข้อสอบภายในฐานข้อมูล ส่งกลับเฉพาะชุดสอบที่เลือกแล้ว</p></div>
        {blueprints.map(bp=><div key={bp.id} style={{borderTop:"1px solid #333",paddingTop:12,display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}>
          <div><strong>{bp.title}</strong><p className="muted" style={{margin:"4px 0",fontSize:12}}>{bp.total_questions} ข้อ · {bp.time_limit_minutes} นาที · {bp.code}</p></div>
          <button className="btn" disabled={busy} onClick={()=>startBlueprint(bp.code)}>เริ่มชุดนี้</button>
        </div>)}
      </div>}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 32 }}>📝</span>
          <div style={{ flex: 1 }}><h2 style={{ margin: 0 }}>จำลองสอบเต็ม 100 ข้อ</h2><p className="muted" style={{ margin: "6px 0 0" }}>สุ่มจากคลังข้อสอบที่เปิดใช้งาน ใช้เวลา 180 นาที</p></div>
          <button className="btn" disabled={busy || !categories.length} onClick={() => start("full100")}>{busy ? "กำลังเตรียม..." : "เริ่มสอบ"}</button>
        </div>
      </div>

      <div className="card stack">
        <div><h2 style={{ margin: 0 }}>ฝึกตามหมวดหมู่</h2><p className="muted">เลือกหมวดและจำนวนข้อที่ต้องการฝึก</p></div>
        <select className="field" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
          <option value="">เลือกหมวดหมู่</option>
          {categories.map(item => <option key={item.id} value={item.id}>{item.name} ({item.count} ข้อ)</option>)}
        </select>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[10,25,50].map(value => <button key={value} className={count === value ? "btn" : "btn btn-secondary"} onClick={() => setCount(value)}>{value} ข้อ</button>)}
        </div>
        <button className="btn" disabled={busy || !categoryId} onClick={() => start("category")}>เริ่มฝึกตามหมวดหมู่</button>
      </div>

      <div className="card stack">
        <div><h2 style={{ margin: 0 }}>ฝึกตามปีข้อสอบ</h2><p className="muted">เลือกปีและจำนวนข้อ</p></div>
        <select className="field" value={yearId} onChange={e => setYearId(e.target.value)}>
          <option value="">เลือกปีข้อสอบ</option>
          {years.map(item => <option key={item.id} value={item.id} disabled={item.count === 0}>{item.label} ({item.count} ข้อ)</option>)}
        </select>
        {years.every(item => item.count === 0) && <p className="muted" style={{ fontSize: 13, margin: 0 }}>ขณะนี้ยังไม่มีข้อสอบที่ผูกกับปีข้อสอบ จึงยังไม่เปิดโหมดนี้</p>}
        <button className="btn btn-secondary" disabled={busy || !yearId || years.every(item => item.count === 0)} onClick={() => start("year")}>เริ่มฝึกตามปี</button>
      </div>

      {error && <p role="alert" style={{ color: "#fca5a5" }}>{error}</p>}
      <p className="muted" style={{ fontSize: 12 }}>ระบบจะเลือกข้อที่ยังไม่เคยทำก่อน และกระจายข้อที่ถูกใช้งานน้อยให้มากขึ้น</p>
    </section>
  );
}
