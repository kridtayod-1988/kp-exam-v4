import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const profile = await getCurrentProfile();
  redirect(profile ? (profile.role === "admin" ? "/admin" : "/dashboard") : "/login");
}
