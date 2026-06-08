import type { Metadata } from "next";
import { JetBrains_Mono, Manrope, Unbounded } from "next/font/google";
import Script from "next/script";
import { Nav } from "@/components/nav";
import "./globals.css";

const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  variable: "--font-unbounded",
  display: "swap",
});
const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Авиа-агрегатор — дешёвые рейсы и ценовые аномалии",
  description: "Личный мониторинг дешёвых авиабилетов из Екатеринбурга, Москвы и других хабов",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${unbounded.variable} ${manrope.variable} ${jetbrains.variable}`}>
      <body className="flex min-h-screen flex-col">
        {/* Travelpayouts site verification / tracking (marker 537159) */}
        <Script id="tp-verification" strategy="afterInteractive">
          {`(function () { var s = document.createElement("script"); s.async = 1; s.src = "https://emrldco.com/NTM3MTU5.js?t=537159"; document.head.appendChild(s); })();`}
        </Script>
        <Nav />
        <div className="flex-1">{children}</div>
        <footer className="mt-16 border-t border-line">
          <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-6 py-8 text-xs text-muted sm:flex-row">
            <span className="font-mono uppercase tracking-widest">✈ Авиа-агрегатор</span>
            <span>Цены кэшируются — проверяйте перед покупкой.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
