"use client";

import { useActionState, useState } from "react";
import { authenticate, type LoginState, sendMagicLink } from "./actions";

const INITIAL: LoginState = { status: "idle" };

const inputCls =
  "w-full rounded-lg border border-line bg-paper px-3.5 py-2.5 font-mono text-sm outline-none transition focus:border-accent";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [state, action, pending] = useActionState(authenticate, INITIAL);
  const [magicState, magicAction, magicPending] = useActionState(sendMagicLink, INITIAL);
  const [showMagic, setShowMagic] = useState(false);

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <p className="kicker">Личный кабинет</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight">
        {mode === "signin" ? "Вход" : "Регистрация"}
      </h1>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`rounded-full px-4 py-1.5 font-mono text-[0.68rem] uppercase tracking-[0.14em] transition ${
            mode === "signin"
              ? "bg-ink text-card"
              : "border border-line text-muted hover:border-ink hover:text-ink"
          }`}
        >
          Вход
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`rounded-full px-4 py-1.5 font-mono text-[0.68rem] uppercase tracking-[0.14em] transition ${
            mode === "signup"
              ? "bg-ink text-card"
              : "border border-line text-muted hover:border-ink hover:text-ink"
          }`}
        >
          Регистрация
        </button>
      </div>

      <form action={action} className="mt-5 space-y-3 rounded-card border border-line bg-card p-6">
        <input type="hidden" name="mode" value={mode} />
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          className={inputCls}
        />
        <input
          type="password"
          name="password"
          required
          minLength={6}
          placeholder="Пароль (минимум 6 символов)"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          className={inputCls}
        />
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-ink py-2.5 font-mono text-xs uppercase tracking-[0.18em] text-card transition hover:bg-accent disabled:opacity-50"
        >
          {pending ? "Минуту…" : mode === "signin" ? "Войти →" : "Создать аккаунт →"}
        </button>
        {state.status === "error" && <p className="text-sm text-accent">{state.message}</p>}
        {state.status === "check_email" && (
          <p className="text-sm text-sky">
            Аккаунт создан. Подтвердите email по ссылке из письма ({state.email}), затем войдите.
          </p>
        )}
      </form>

      <div className="mt-5 text-center">
        {!showMagic ? (
          <button
            type="button"
            onClick={() => setShowMagic(true)}
            className="font-mono text-[0.68rem] uppercase tracking-wider text-muted hover:text-accent"
          >
            Забыли пароль? Вход по ссылке на почту
          </button>
        ) : (
          <form action={magicAction} className="space-y-2">
            <input
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              className={inputCls}
            />
            <button
              type="submit"
              disabled={magicPending}
              className="w-full rounded-lg border border-line py-2 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink transition hover:border-accent disabled:opacity-50"
            >
              {magicPending ? "Отправляем…" : "Прислать ссылку для входа"}
            </button>
            {magicState.status === "sent" && (
              <p className="text-sm text-sky">Ссылка отправлена на {magicState.email}.</p>
            )}
            {magicState.status === "error" && (
              <p className="text-sm text-accent">{magicState.message}</p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
