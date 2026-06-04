import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="border-b border-gray-200">
      <nav className="mx-auto flex max-w-5xl items-center justify-between p-4">
        <Link href="/" className="font-bold">
          Авиа-агрегатор
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/anomalies" className="text-gray-600 hover:text-black">
            Аномалии
          </Link>
          <Link href="/status" className="text-gray-600 hover:text-black">
            Статус
          </Link>
          {user ? (
            <>
              <span className="text-gray-600">{user.email}</span>
              <form action="/auth/logout" method="post">
                <button type="submit" className="text-gray-600 hover:text-black">
                  Выход
                </button>
              </form>
            </>
          ) : (
            <Link href="/auth/login" className="text-gray-600 hover:text-black">
              Вход
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
