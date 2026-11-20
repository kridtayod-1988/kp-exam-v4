"use client";
import {useState,useTransition} from "react";
import {setUserStatusAction} from "@/lib/admin/actions";
type User={id:string;display_name:string;email:string;role:"user"|"admin";status:"active"|"banned";total_attempts:number;total_exp:number};
export function UserManager({initial}:{initial:User[]}){
 const [users,setUsers]=useState(initial);const [message,setMessage]=useState("");const [pending,start]=useTransition();
 function toggle(user:User){const next=user.status==="active"?"banned":"active";if(!window.confirm((next==="banned"?"ระงับ":"ปลดระงับ")+"บัญชี "+user.email+" ?"))return;start(async()=>{try{await setUserStatusAction(user.id,next);setUsers(rows=>rows.map(x=>x.id===user.id?{...x,status:next}:x));}catch(e){setMessage(e instanceof Error?e.message:"เปลี่ยนสถานะไม่สำเร็จ");}});}
 return <section className="card stack"><h2 style={{margin:0}}>สมาชิก ({users.length})</h2>{message&&<p role="alert">{message}</p>}{users.map(u=><article key={u.id} style={{borderTop:"1px solid #333",paddingTop:12,display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}><div><strong>{u.display_name}</strong><p className="muted" style={{margin:"4px 0",fontSize:12}}>{u.email} · {u.role} · สอบ {u.total_attempts} ครั้ง · {u.total_exp} EXP</p><span className="muted">{u.status==="active"?"บัญชีปกติ":"บัญชีถูกระงับ"}</span></div>{u.role!=="admin"&&<button className="btn btn-secondary" disabled={pending} onClick={()=>toggle(u)}>{u.status==="active"?"ระงับบัญชี":"ปลดระงับ"}</button>}</article>)}</section>;
}
