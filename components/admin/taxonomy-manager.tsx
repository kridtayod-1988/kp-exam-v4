"use client";
import { useState,useTransition } from "react";
import { saveCategoryAction,saveExamYearAction } from "@/lib/admin/actions";
type Cat={id:string;name:string;sort_order:number;is_active:boolean};
type Year={id:string;label:string;year:number;is_active:boolean};
export function TaxonomyManager({categories,years}:{categories:Cat[];years:Year[]}){
 const [catName,setCatName]=useState("");const [catOrder,setCatOrder]=useState(categories.length);const [yearLabel,setYearLabel]=useState("");const [year,setYear]=useState(2569);const [message,setMessage]=useState("");const [pending,start]=useTransition();
 function addCat(){start(async()=>{try{await saveCategoryAction({name:catName,sortOrder:catOrder,isActive:true});window.location.reload();}catch(e){setMessage(e instanceof Error?e.message:"บันทึกไม่สำเร็จ");}});}
 function addYear(){start(async()=>{try{await saveExamYearAction({label:yearLabel,year,isActive:true});window.location.reload();}catch(e){setMessage(e instanceof Error?e.message:"บันทึกไม่สำเร็จ");}});}
 return <div className="stack"><section className="card stack"><h2 style={{margin:0}}>หมวดวิชา</h2>{categories.map(c=><p key={c.id}>{c.name} · ลำดับ {c.sort_order} · {c.is_active?"เปิด":"ปิด"}</p>)}<input className="field" value={catName} onChange={e=>setCatName(e.target.value)} placeholder="ชื่อหมวดใหม่"/><input className="field" type="number" value={catOrder} onChange={e=>setCatOrder(Number(e.target.value))}/><button className="btn" disabled={pending||!catName.trim()} onClick={addCat}>เพิ่มหมวดวิชา</button></section><section className="card stack"><h2 style={{margin:0}}>ปีข้อสอบ</h2>{years.map(y=><p key={y.id}>{y.label} ({y.year}) · {y.is_active?"เปิด":"ปิด"}</p>)}<input className="field" value={yearLabel} onChange={e=>setYearLabel(e.target.value)} placeholder="ชื่อปีข้อสอบ"/><input className="field" type="number" value={year} onChange={e=>setYear(Number(e.target.value))}/><button className="btn" disabled={pending||!yearLabel.trim()} onClick={addYear}>เพิ่มปีข้อสอบ</button></section>{message&&<p role="alert">{message}</p>}</div>;
}
