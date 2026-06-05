"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SavedSearchInput = {
  origin_iata: string;
  destination_iata: string;
  date_from: string;
  date_to: string;
  max_price_rub: number;
};

export async function createSavedSearch(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const origin = String(formData.get("origin_iata") ?? "")
    .trim()
    .toUpperCase();
  const destination = String(formData.get("destination_iata") ?? "")
    .trim()
    .toUpperCase();
  const dateFrom = String(formData.get("date_from") ?? "");
  const dateTo = String(formData.get("date_to") ?? "");
  const maxPrice = Number(formData.get("max_price_rub") ?? 0);

  if (!origin || !destination || !dateFrom || !dateTo || maxPrice <= 0) return;

  await supabase.from("saved_searches").insert({
    user_id: user.id,
    origin_iata: origin,
    destination_iata: destination,
    date_from: dateFrom,
    date_to: dateTo,
    max_price_rub: maxPrice,
  });

  revalidatePath("/saved");
}

export async function deleteSavedSearch(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // RLS also enforces ownership; the explicit user_id filter is defense-in-depth.
  await supabase.from("saved_searches").delete().eq("id", id).eq("user_id", user.id);

  revalidatePath("/saved");
}
