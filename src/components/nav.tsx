import Link from "next/link";
import { isAdminEmail } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = isAdminEmail(user?.email);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/85 backdrop-blur-md">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3.5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-sm text-card shadow-[0_2px_10px_rgba(229,72,43,0.4)]">
            ✈
          </span>
          <span className="font-display text-lg font-extrabold lowercase tracking-tight">
            avia<span className="text-accent">top</span>
          </span>
        </Link>

        <div className="flex items-center gap-4 font-mono text-[0.68rem] uppercase tracking-[0.18em] sm:gap-5">
          <Link href="/" className="transition hover:text-accent">
            Лента
          </Link>
          <Link href="/anomalies" className="transition hover:text-accent">
            Аномалии
          </Link>
          {user ? (
            <>
              <Link href="/saved" className="transition hover:text-accent">
                Поиски
              </Link>
              {admin && (
                <Link href="/admin" className="text-accent transition hover:opacity-70">
                  Админ
                </Link>
              )}
              <form action="/auth/logout" method="post">
                <button
                  type="submit"
                  className="uppercase tracking-[0.18em] transition hover:text-accent"
                >
                  Выход
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/auth/login"
              className="rounded-full bg-ink px-3.5 py-1.5 text-card transition hover:bg-accent"
            >
              Вход
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
