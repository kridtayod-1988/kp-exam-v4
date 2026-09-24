-- ============================================
-- ปรับปรุงประสิทธิภาพตาม Performance Advisor (Migration 5/5):
-- 1. ห่อ auth.<fn>() ด้วย (select ...) กัน re-evaluate ทุกแถว
-- 2. รวม policy ที่ซ้อนกันต่อ action เดียวให้เหลือ 1 policy
-- 3. เพิ่ม index ให้ foreign key ที่ยังไม่มี
-- ============================================

-- ----- ล้าง policy เดิมทั้งหมดก่อนสร้างใหม่ -----
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own_no_role_change" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
drop policy if exists "profiles_delete_admin" on public.profiles;

drop policy if exists "categories_select_all" on public.categories;
drop policy if exists "categories_write_admin" on public.categories;

drop policy if exists "exam_years_select_all" on public.exam_years;
drop policy if exists "exam_years_write_admin" on public.exam_years;

drop policy if exists "questions_select_authenticated" on public.questions;
drop policy if exists "questions_write_admin" on public.questions;

drop policy if exists "exam_attempts_insert_own" on public.exam_attempts;
drop policy if exists "exam_attempts_select_own_or_admin" on public.exam_attempts;
drop policy if exists "exam_attempts_update_own" on public.exam_attempts;
drop policy if exists "exam_attempts_delete_admin" on public.exam_attempts;

drop policy if exists "user_seen_select_own_or_admin" on public.user_seen_questions;
drop policy if exists "user_seen_insert_own" on public.user_seen_questions;
drop policy if exists "user_seen_update_own_or_admin" on public.user_seen_questions;

drop policy if exists "system_config_select_public_row" on public.system_config;
drop policy if exists "system_config_select_secrets_admin" on public.system_config;
drop policy if exists "system_config_update_admin" on public.system_config;

-- ----- profiles: รวมเหลือ 1 policy ต่อ action -----
create policy "profiles_select" on public.profiles
  for select using ((select auth.uid()) = id or public.is_admin());

create policy "profiles_insert" on public.profiles
  for insert with check ((select auth.uid()) = id and role = 'user');

-- update: รวม "เจ้าของแก้ได้แต่ห้ามเปลี่ยน role" กับ "admin แก้ได้ทุกอย่าง" เป็น policy เดียว
create policy "profiles_update" on public.profiles
  for update using ((select auth.uid()) = id or public.is_admin())
  with check (
    public.is_admin()
    or ((select auth.uid()) = id and role = (select p.role from public.profiles p where p.id = (select auth.uid())))
  );

create policy "profiles_delete" on public.profiles
  for delete using (public.is_admin());

-- ----- categories: select เดียวครอบคลุมทุกคน, write แยกเฉพาะ insert/update/delete (ไม่ใช้ "for all" เพื่อไม่ให้ทับ select) -----
create policy "categories_select" on public.categories
  for select using (true);

create policy "categories_insert_admin" on public.categories
  for insert with check (public.is_admin());
create policy "categories_update_admin" on public.categories
  for update using (public.is_admin()) with check (public.is_admin());
create policy "categories_delete_admin" on public.categories
  for delete using (public.is_admin());

-- ----- exam_years: เหมือน categories -----
create policy "exam_years_select" on public.exam_years
  for select using (true);

create policy "exam_years_insert_admin" on public.exam_years
  for insert with check (public.is_admin());
create policy "exam_years_update_admin" on public.exam_years
  for update using (public.is_admin()) with check (public.is_admin());
create policy "exam_years_delete_admin" on public.exam_years
  for delete using (public.is_admin());

-- ----- questions: select รวม authenticated+admin เป็นเงื่อนไขเดียว, write แยก action -----
create policy "questions_select" on public.questions
  for select using ((select auth.role()) = 'authenticated');

create policy "questions_insert_admin" on public.questions
  for insert with check (public.is_admin());
create policy "questions_update_admin" on public.questions
  for update using (public.is_admin()) with check (public.is_admin());
create policy "questions_delete_admin" on public.questions
  for delete using (public.is_admin());

-- ----- exam_attempts -----
create policy "exam_attempts_insert" on public.exam_attempts
  for insert with check ((select auth.uid()) = user_id);

create policy "exam_attempts_select" on public.exam_attempts
  for select using ((select auth.uid()) = user_id or public.is_admin());

create policy "exam_attempts_update" on public.exam_attempts
  for update using ((select auth.uid()) = user_id);

create policy "exam_attempts_delete" on public.exam_attempts
  for delete using (public.is_admin());

-- ----- user_seen_questions -----
create policy "user_seen_select" on public.user_seen_questions
  for select using ((select auth.uid()) = user_id or public.is_admin());

create policy "user_seen_insert" on public.user_seen_questions
  for insert with check ((select auth.uid()) = user_id);

create policy "user_seen_update" on public.user_seen_questions
  for update using ((select auth.uid()) = user_id or public.is_admin());

-- ----- system_config: select รวมเงื่อนไข public-row-for-everyone OR secrets-row-for-admin เป็น policy เดียว -----
create policy "system_config_select" on public.system_config
  for select using (key = 'public' or public.is_admin());

create policy "system_config_update_admin" on public.system_config
  for update using (public.is_admin()) with check (public.is_admin());

-- ----- เพิ่ม index ให้ foreign key ที่ advisor แจ้งว่ายังไม่มี -----
create index idx_exam_attempts_category on public.exam_attempts (category_id);
create index idx_exam_attempts_exam_year on public.exam_attempts (exam_year_id);
create index idx_questions_category on public.questions (category_id);
create index idx_questions_created_by on public.questions (created_by);
create index idx_questions_exam_year on public.questions (exam_year_id);
