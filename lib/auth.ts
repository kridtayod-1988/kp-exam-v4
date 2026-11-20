import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type UserProfile = {
  id: string;
  display_name: string;
  email: string;
  role: "user" | "admin";
  photo_url: string | null;
  total_attempts: number;
  best_score: number;
  total_exp: number;
  status: "active" | "banned";
};

export async function getCurrentProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, display_name, email, role, photo_url, total_attempts, best_score, total_exp, status")
    .eq("id", claimsData.claims.sub)
    .maybeSingle();

  if (error || !profile) return null;
  if (profile.role !== "user" && profile.role !== "admin") return null;

  return profile as UserProfile;
}

export async function requireUser() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/dashboard");
  if (profile.status !== "active") redirect("/account-suspended");
  return profile;
}

export async function requireAdmin() {
  const profile = await requireUser();
  if (profile.role !== "admin") redirect("/dashboard");
  return profile;
}
