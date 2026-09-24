// js/supabase-config.js
//
// ✅ ตั้งค่าแล้วสำหรับโปรเจกต์ Supabase "KPOR"
//
// หากต้องการเปลี่ยนไปใช้โปรเจกต์อื่นในอนาคต ดูค่าที่ Supabase Dashboard:
// Project Settings → API → Project URL และ Publishable key
//
// อย่าลืม:
// - เปิดใช้ Authentication → Providers → Email และ Google (ต้องตั้งค่า OAuth client ID ที่ Google Cloud Console ด้วย)
// - schema/RLS policies ถูก deploy ผ่าน migration แล้ว (ดู supabase/migrations/)

const SUPABASE_URL = "https://mivyilrytsoncvolhhev.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_GDj2gqeUHXNYl3a7OllSuQ_HHt-TLEi";

// เริ่มต้น Supabase client (ใช้ตัวแปร global ชื่อ `supabase` จาก CDN script ที่โหลดไว้ก่อนหน้าไฟล์นี้)
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
