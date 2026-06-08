"use client";

import { useActionState } from "react";
import { type LoginState, sendMagicLink } from "./actions";

const INITIAL: LoginState = { status: "idle" };

export default function LoginPage() {
  const [state, action, pending] = useActionState(sendMagicLink, INITIAL);

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <p className="kicker">Boarding pass</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">Вход</h1>
      <p className="mt-3 text-sm text-muted">
        Введите email — пришлём ссылку для входа без пароля.
      </p>

      <form action={action} className="mt-8 space-y-3 rounded-card border border-line bg-card p-6">
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          className="w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 font-mono text-sm outline-none transition focus:border-accent"
        />
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-ink py-2.5 font-mono text-xs uppercase tracking-[0.18em] text-card transition hover:bg-accent disabled:opacity-50"
        >
          {pending ? "Отправляем…" : "Получить ссылку →"}
        </button>
      </form>

      {state.status === "sent" && (
        <p className="mt-4 text-sm text-sky">
          Ссылка отправлена на {state.email}. Проверьте почту.
        </p>
      )}
      {state.status === "error" && <p className="mt-4 text-sm text-accent">{state.message}</p>}
    </main>
  );
}
