import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TaxonomyManager } from "@/components/admin/taxonomy-manager";
export default async function TaxonomyPage(){await requireAdmin();const supabase=await createClient();const [{data:categories},{data:years}]=await Promise.all([supabase.from("categories").select("id,name,sort_order,is_active").order("sort_order"),supabase.from("exam_years").select("id,label,year,is_active").order("year",{ascending:false})]);return <section className="stack"><div><Link href="/admin" className="gold">← Admin</Link><h1>หมวดหมู่และปีข้อสอบ</h1></div><TaxonomyManager categories={categories??[]} years={years??[]}/></section>;}
