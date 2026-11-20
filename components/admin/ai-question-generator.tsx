"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { reviewAiDraftAction } from "@/lib/admin/actions";

type Category = { id: string; name: string };
type Draft = { id: string; status: string; created_at: string; payload: {question_text?:string;options?:string[];correct_answer_index?:number;explanation?:string;cat?:string;sub?:string} };

export function AiQuestionGenerator({ categories, drafts: initial }: { categories: Category[]; drafts: Draft[] }) {
  const [categoryId,setCategoryId]=useState(categories[0]?.id ?? "");
  const [topic,setTopic]=useState("");
  const [sub,setSub]=useState("");
  const [count,setCount]=useState(3);
  const [difficulty,setDifficulty]=useState<"easy"|"medium"|"hard">("medium");
  const [drafts,setDrafts]=useState(initial);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  async function generate() {
    setBusy(true); setMessage("");
    try {
      const supabase=createClient();
      const {data,error}=await supabase.functions.invoke("generate-questions",{body:{category_id:categoryId,topic,sub,count,difficulty}});
      if(error) throw error;
      setMessage(`สร้าง Draft สำเร็จ ${data?.count ?? 0} ข้อ — กรุณาตรวจสอบรายการด้านล่าง`);
      window.location.reload();
    } catch(e) { setMessage(e instanceof Error ? e.message : "สร้าง Draft ไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  async function review(id:string,decision:"approve"|"reject") {
    setBusy(true); setMessage("");
    try { await reviewAiDraftAction(id,decision); setDrafts(v=>v.filter(x=>x.id!==id)); setMessage(decision==="approve"?"อนุมัติและบันทึกข้อสอบแล้ว":"ปฏิเสธ Draft แล้ว"); }
    catch(e) { setMessage(e instanceof Error ? e.message : "ดำเนินการไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  return <div className="stack">
    <section className="card stack"><h2 style={{margin:0}}>สร้างข้อสอบด้วย AI</h2><p className="muted">API Key อยู่ใน Edge Function Secret เท่านั้น ผลลัพธ์จะถูกบันทึกเป็น Draft ยังไม่เข้าคลังข้อสอบ</p>
      <label className="stack"><span>หมวดวิชา</span><select className="field" value={categoryId} onChange={e=>setCategoryId(e.target.value)}>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="stack"><span>หัวข้อ</span><input className="field" value={topic} onChange={e=>setTopic(e.target.value)} maxLength={240} placeholder="เช่น อนุกรมตัวเลข"/></label>
      <label className="stack"><span>รหัสหมวดย่อย (ถ้ามี)</span><input className="field" value={sub} onChange={e=>setSub(e.target.value)} maxLength={40} placeholder="เช่น SC_M1"/></label>
      <label className="stack"><span>จำนวนข้อ (1-5)</span><input className="field" type="number" min={1} max={5} value={count} onChange={e=>setCount(Math.max(1,Math.min(5,Number(e.target.value))))}/></label>
      <label className="stack"><span>ระดับความยาก</span><select className="field" value={difficulty} onChange={e=>setDifficulty(e.target.value as typeof difficulty)}><option value="easy">ง่าย</option><option value="medium">ปานกลาง</option><option value="hard">ยาก</option></select></label>
      <button className="btn" disabled={busy || !categoryId} onClick={generate}>{busy ? "กำลังสร้าง..." : "สร้าง Draft ด้วย AI"}</button>
      {message && <p role="status" className="muted">{message}</p>}
    </section>
    <section className="card stack"><h2 style={{margin:0}}>รายการ Draft ที่รอตรวจ ({drafts.length})</h2>
      {drafts.length===0 && <p className="muted">ไม่มี Draft รอตรวจ</p>}
      {drafts.map(d=><div key={d.id} style={{borderTop:"1px solid #333",paddingTop:12,display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}><div><strong>Draft {d.id.slice(0,8)}</strong><p className="muted" style={{margin:"4px 0",fontSize:12}}>{new Date(d.created_at).toLocaleString("th-TH")} · {d.status}</p><p>{d.payload?.question_text ?? "ไม่มีข้อความคำถาม"}</p><ol>{(d.payload?.options ?? []).map((option,i)=><li key={i} style={{color:i===d.payload?.correct_answer_index?"#f2c744":"inherit"}}>{option}{i===d.payload?.correct_answer_index?" ✓":""}</li>)}</ol><p className="muted">{d.payload?.explanation}</p></div><div style={{display:"flex",gap:8}}><button className="btn" disabled={busy} onClick={()=>review(d.id,"approve")}>อนุมัติ</button><button className="btn btn-secondary" disabled={busy} onClick={()=>review(d.id,"reject")}>ปฏิเสธ</button></div></div>)}
    </section>
  </div>;
}
