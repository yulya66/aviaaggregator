"use client";

import { useActionState } from "react";
import { type LoginState, sendMagicLink } from "./actions";

const INITIAL: LoginState = { status: "idle" };

export default function LoginPage() {
  const [state, action, pending] = useActionState(sendMagicLink, INITIAL);

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-bold">Вход</h1>
      <p className="mt-2 text-gray-600">Введите email — пришлём ссылку для входа.</p>
      <form action={action} className="mt-6 space-y-3">
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          className="w-full rounded border border-gray-300 px-3 py-2"
        />
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {pending ? "Отправляем..." : "Получить ссылку"}
        </button>
      </form>

      {state.status === "sent" && (
        <p className="mt-4 text-green-700">Ссылка отправлена на {state.email}. Проверьте почту.</p>
      )}
      {state.status === "error" && <p className="mt-4 text-red-700">{state.message}</p>}
    </main>
  );
}
