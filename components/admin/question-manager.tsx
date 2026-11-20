"use client";

import { useState, useTransition } from "react";
import { saveQuestionAction, softDeleteQuestionAction } from "@/lib/admin/actions";
type Category={id:string;name:string};
type Question={id:string;category_id:string;cat:string|null;sub:string|null;question_text:string;options:string[];correct_answer_index:number;explanation:string;difficulty:"easy"|"medium"|"hard"};
const blank={categoryId:"",cat:"",sub:"",questionText:"",options:["","","",""],correctIndex:0,explanation:"",difficulty:"medium" as const};
export function QuestionManager({categories,initial}:{categories:Category[];initial:Question[]}) {
 const [items,setItems]=useState(initial); const [form,setForm]=useState(blank); const [editing,setEditing]=useState<string|undefined>(); const [error,setError]=useState(""); const [pending,start]=useTransition();
 function edit(q:Question){setEditing(q.id);setForm({categoryId:q.category_id,cat:q.cat??"",sub:q.sub??"",questionText:q.question_text,options:q.options,correctIndex:q.correct_answer_index,explanation:q.explanation,difficulty:q.difficulty});setError("");}
 function reset(){setEditing(undefined);setForm({...blank,categoryId:categories[0]?.id??""});setError("");}
 function submit(){setError("");start(async()=>{try{await saveQuestionAction({...form,id:editing,options:form.options});window.location.reload();}catch(e){setError(e instanceof Error?e.message:"บันทึกไม่สำเร็จ");}});}
 function remove(id:string){if(!window.confirm("ยืนยันปิดใช้งานข้อสอบข้อนี้? ข้อมูลจะถูกเก็บไว้ในระบบ"))return;start(async()=>{try{await softDeleteQuestionAction(id);setItems(v=>v.filter(x=>x.id!==id));}catch(e){setError(e instanceof Error?e.message:"ลบไม่สำเร็จ");}});}
 return <div className="stack">
  <section className="card stack"><h2 style={{margin:0}}>{editing?"แก้ไขข้อสอบ":"เพิ่มข้อสอบใหม่"}</h2>
   <label className="stack"><span>หมวดวิชา</span><select className="field" value={form.categoryId} onChange={e=>setForm(v=>({...v,categoryId:e.target.value}))}>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
   <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><label className="stack"><span>หมวดย่อย (cat)</span><input className="field" value={form.cat} onChange={e=>setForm(v=>({...v,cat:e.target.value}))}/></label><label className="stack"><span>รหัสย่อย (sub)</span><input className="field" value={form.sub} onChange={e=>setForm(v=>({...v,sub:e.target.value}))}/></label></div>
   <label className="stack"><span>คำถาม</span><textarea className="field" rows={4} value={form.questionText} onChange={e=>setForm(v=>({...v,questionText:e.target.value}))}/></label>
   {form.options.map((option,i)=><label className="stack" key={i}><span>ตัวเลือก {i+1}</span><input className="field" value={option} onChange={e=>setForm(v=>({...v,options:v.options.map((x,j)=>j===i?e.target.value:x)}))}/></label>)}
   <label className="stack"><span>เฉลยที่ถูกต้อง</span><select className="field" value={form.correctIndex} onChange={e=>setForm(v=>({...v,correctIndex:Number(e.target.value)}))}>{[0,1,2,3].map(i=><option key={i} value={i}>ตัวเลือก {i+1}</option>)}</select></label>
   <label className="stack"><span>คำอธิบายเฉลย</span><textarea className="field" rows={3} value={form.explanation} onChange={e=>setForm(v=>({...v,explanation:e.target.value}))}/></label>
   <label className="stack"><span>ระดับความยาก</span><select className="field" value={form.difficulty} onChange={e=>setForm(v=>({...v,difficulty:e.target.value as typeof form.difficulty}))}><option value="easy">ง่าย</option><option value="medium">ปานกลาง</option><option value="hard">ยาก</option></select></label>
   {error&&<p role="alert" style={{color:"#fca5a5"}}>{error}</p>}
   <div style={{display:"flex",gap:8}}><button className="btn" disabled={pending||!categories.length} onClick={submit}>{pending?"กำลังบันทึก...":editing?"บันทึกการแก้ไข":"เพิ่มข้อสอบ"}</button><button className="btn btn-secondary" onClick={reset}>ล้างฟอร์ม</button></div>
  </section>
  <section className="card stack"><h2 style={{margin:0}}>คลังข้อสอบล่าสุด ({items.length})</h2>{items.map(q=><article key={q.id} style={{borderTop:"1px solid #333",paddingTop:12}}><strong>{q.question_text}</strong><p className="muted" style={{fontSize:12}}>{categories.find(c=>c.id===q.category_id)?.name} · {q.sub??"ไม่ระบุรหัส"} · {q.difficulty}</p><ol>{q.options.map((o,i)=><li key={i} style={{color:i===q.correct_answer_index?"#f2c744":"inherit"}}>{o}{i===q.correct_answer_index?" ✓":""}</li>)}</ol><p className="muted">{q.explanation}</p><div style={{display:"flex",gap:8}}><button className="btn btn-secondary" onClick={()=>edit(q)}>แก้ไข</button><button className="btn btn-secondary" disabled={pending} onClick={()=>remove(q.id)}>ปิดใช้งาน</button></div></article>)}</section>
 </div>;
}
