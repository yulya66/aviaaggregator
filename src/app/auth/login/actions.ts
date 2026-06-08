"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "check_email"; email: string }
  | { status: "error"; message: string };

/** Map common Supabase auth errors to friendly Russian. */
function ru(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "Неверный email или пароль";
  if (m.includes("already registered")) return "Аккаунт с таким email уже есть — войдите";
  if (m.includes("rate limit")) return "Слишком много попыток, подождите минуту";
  if (m.includes("password")) return "Пароль минимум 6 символов";
  return message;
}

/** Email + password sign-in / sign-up, chosen by the hidden `mode` field. */
export async function authenticate(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const mode = String(formData.get("mode") ?? "signin");
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email.includes("@")) return { status: "error", message: "Введите корректный email" };
  if (password.length < 6) return { status: "error", message: "Пароль минимум 6 символов" };

  const supabase = await createClient();

  if (mode === "signup") {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { status: "error", message: ru(error.message) };
    // Email confirmation OFF → session returned → logged in. ON → must confirm by email.
    if (!data.session) return { status: "check_email", email };
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { status: "error", message: ru(error.message) };
  }

  redirect("/");
}

/** Fallback: passwordless magic link (kept for recovery if a password is forgotten). */
export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email.includes("@")) return { status: "error", message: "Введите корректный email" };
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { status: "error", message: ru(error.message) };
  return { status: "sent", email };
}
