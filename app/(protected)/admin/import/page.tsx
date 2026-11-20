import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { CsvQuestionImporter } from "@/components/admin/csv-question-importer";
export default async function ImportPage(){await requireAdmin();return <section className="stack"><div><Link href="/admin" className="gold">← Admin</Link><h1>นำเข้าข้อสอบ CSV</h1></div><CsvQuestionImporter/></section>;}
