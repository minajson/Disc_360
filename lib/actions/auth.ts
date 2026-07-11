"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/db/server";

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
