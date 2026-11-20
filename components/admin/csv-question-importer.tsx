"use client";
import { useState,useTransition } from "react";
import { importQuestionsCsvAction } from "@/lib/admin/actions";
const sample='category_id,question_text,options,correct_answer_index,explanation,difficulty,cat,sub\n00000000-0000-0000-0000-000000000000,ตัวอย่างคำถาม,"[""ตัวเลือก ก"",""ตัวเลือก ข"",""ตัวเลือก ค"",""ตัวเลือก ง""]",0,คำอธิบาย,medium,ความสามารถทั่วไป,SC_M1';
export function CsvQuestionImporter(){
 const [csv,setCsv]=useState("");const [message,setMessage]=useState("");const [pending,start]=useTransition();
 function submit(){setMessage("");start(async()=>{try{const result=await importQuestionsCsvAction(csv);setMessage("นำเข้าสำเร็จ "+result.count+" ข้อ");setCsv("");}catch(e){setMessage(e instanceof Error?e.message:"นำเข้าไม่สำเร็จ");}});}
 return <section className="card stack"><h2 style={{margin:0}}>นำเข้าข้อสอบ CSV</h2><p className="muted">จำกัด 500 ข้อต่อครั้ง และต้องมีคอลัมน์ category_id, question_text, options, correct_answer_index, explanation โดย options เป็น JSON array 4 ตัวเลือก</p><textarea className="field" rows={14} value={csv} onChange={e=>setCsv(e.target.value)} placeholder="วางเนื้อหา CSV ที่นี่..."/><button className="btn" disabled={pending||!csv.trim()} onClick={submit}>{pending?"กำลังนำเข้า...":"นำเข้า CSV"}</button>{message&&<p role="status" className="muted">{message}</p>}<button className="btn btn-secondary" onClick={()=>setCsv(sample)}>ใส่ตัวอย่างรูปแบบ CSV</button></section>;
}
