"use client";

import { useMemo, useState, useTransition } from "react";
import { saveBlueprintAction, toggleBlueprintAction } from "@/lib/admin/actions";

type Category = { id: string; name: string };
type Rule = { category_id: string; quota: number };
type Blueprint = { id: string; code: string; title: string; description: string | null; total_questions: number; time_limit_minutes: number; rules: Rule[]; is_active: boolean };

export function BlueprintManager({ categories, initial }: { categories: Category[]; initial: Blueprint[] }) {
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<Blueprint | null>(null);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [minutes, setMinutes] = useState(180);
  const [active, setActive] = useState(true);
  const [quotas, setQuotas] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const total = useMemo(() => Object.values(quotas).reduce((sum, value) => sum + (Number(value) || 0), 0), [quotas]);

  function reset(bp?: Blueprint) {
    setEditing(bp ?? null); setCode(bp?.code ?? ""); setTitle(bp?.title ?? "");
    setDescription(bp?.description ?? ""); setMinutes(bp?.time_limit_minutes ?? 180);
    setActive(bp?.is_active ?? true);
    const next: Record<string, number> = {};
    categories.forEach(c => { next[c.id] = bp?.rules?.find(r => r.category_id === c.id)?.quota ?? 0; });
    setQuotas(next); setError("");
  }

  function submit() {
    setError("");
    const rules = categories.filter(c => Number(quotas[c.id]) > 0).map(c => ({ category_id: c.id, quota: Number(quotas[c.id]), pass_pct: 60 }));
    startTransition(async () => {
      try {
        await saveBlueprintAction({ id: editing?.id, code, title, description, timeLimitMinutes: minutes, rules, isActive: active });
        window.location.reload();
      } catch (e) { setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ"); }
    });
  }

  function toggle(bp: Blueprint) {
    startTransition(async () => {
      try { await toggleBlueprintAction(bp.id, !bp.is_active); window.location.reload(); }
      catch (e) { setError(e instanceof Error ? e.message : "เปลี่ยนสถานะไม่สำเร็จ"); }
    });
  }

  return <div className="stack">
    <section className="card stack">
      <div><h2 style={{margin:0}}>{editing ? "แก้ไข Blueprint" : "สร้าง Blueprint ใหม่"}</h2><p className="muted">กำหนดโควตาจากหมวดหมู่ที่มีอยู่ในฐานข้อมูลจริง</p></div>
      <label className="stack"><span>รหัส</span><input className="field" value={code} onChange={e=>setCode(e.target.value)} placeholder="KP_FULL_100" maxLength={60}/></label>
      <label className="stack"><span>ชื่อชุดสอบ</span><input className="field" value={title} onChange={e=>setTitle(e.target.value)} maxLength={160}/></label>
      <label className="stack"><span>คำอธิบาย</span><textarea className="field" rows={2} value={description} onChange={e=>setDescription(e.target.value)}/></label>
      <label className="stack"><span>เวลาสอบ (นาที)</span><input className="field" type="number" min={1} max={600} value={minutes} onChange={e=>setMinutes(Number(e.target.value))}/></label>
      <div className="stack"><strong>โควตาข้อสอบรายหมวด</strong>
        {categories.map(c=><label key={c.id} style={{display:"grid",gridTemplateColumns:"1fr 110px",gap:12,alignItems:"center"}}><span>{c.name}</span><input className="field" type="number" min={0} max={200} value={quotas[c.id] ?? 0} onChange={e=>setQuotas(v=>({...v,[c.id]:Number(e.target.value)}))}/></label>)}
        <p className="muted">รวม {total} ข้อ</p>
      </div>
      <label style={{display:"flex",gap:8,alignItems:"center"}}><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/> เปิดให้ผู้ใช้เลือกสอบ</label>
      {error && <p role="alert" style={{color:"#fca5a5"}}>{error}</p>}
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="btn" disabled={pending || !categories.length || total<1} onClick={submit}>{pending ? "กำลังบันทึก..." : editing ? "บันทึกการแก้ไข" : "สร้าง Blueprint"}</button>{editing && <button className="btn btn-secondary" onClick={()=>reset()}>ยกเลิกแก้ไข</button>}</div>
    </section>
    <section className="card stack"><h2 style={{margin:0}}>Blueprint ในระบบ ({items.length})</h2>
      {items.length===0 && <p className="muted">ยังไม่มี Blueprint</p>}
      {items.map(bp=><div key={bp.id} style={{borderTop:"1px solid #333",paddingTop:14,display:"grid",gap:8}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><div><strong>{bp.title}</strong><p className="muted" style={{margin:"4px 0",fontSize:12}}>{bp.code} · {bp.total_questions} ข้อ · {bp.time_limit_minutes} นาที</p></div><span className="muted">{bp.is_active ? "เปิดใช้งาน" : "ปิดใช้งาน"}</span></div>
        <p className="muted" style={{margin:0,fontSize:13}}>{(bp.rules??[]).map(r=>categories.find(c=>c.id===r.category_id)?.name + " " + r.quota + " ข้อ").join(" · ")}</p>
        <div style={{display:"flex",gap:8}}><button className="btn btn-secondary" onClick={()=>reset(bp)}>แก้ไข</button><button className="btn btn-secondary" disabled={pending} onClick={()=>toggle(bp)}>{bp.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}</button></div>
      </div>)}
    </section>
  </div>;
}
