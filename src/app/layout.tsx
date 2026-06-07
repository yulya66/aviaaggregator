import type { Metadata } from "next";
import Script from "next/script";
import { Nav } from "@/components/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Авиа-агрегатор",
  description: "Личный мониторинг дешёвых авиабилетов",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        {/* Travelpayouts site verification / tracking (marker 537159) */}
        <Script id="tp-verification" strategy="afterInteractive">
          {`(function () { var s = document.createElement("script"); s.async = 1; s.src = "https://emrldco.com/NTM3MTU5.js?t=537159"; document.head.appendChild(s); })();`}
        </Script>
        <Nav />
        {children}
      </body>
    </html>
  );
}
