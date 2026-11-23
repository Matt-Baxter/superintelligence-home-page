import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import type { ThemeMode } from "@/components/theme-toggle";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Superintelligence Homepage",
    template: "%s · Superintelligence Homepage",
  },
  description:
    "Focused research feed tracking progress toward AGI and superintelligence, alignment, interpretability, timelines, compute scaling and frontier AI governance.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d0f13",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, cookieStore] = await Promise.all([
    getCurrentUser().catch(() => null),
    cookies(),
  ]);

  const rawTheme = cookieStore.get("si_theme")?.value;
  const theme: ThemeMode =
    rawTheme === "light" || rawTheme === "tactical" || rawTheme === "dark" ? rawTheme : "dark";

  return (
    <html lang="en" data-theme={theme}>
      <body>
        <SiteHeader user={user} initialTheme={theme} />
        <main className="page-main">{children}</main>
        <footer className="site-footer">
          <div className="site-footer-inner">
            <span>
              Superintelligence Homepage · Open research feeds only · Zero Twitter/X · Every tag &amp; score explained.
            </span>
            <div className="footer-links">
              <Link href="/analysis">Analysis &amp; SIM Lab</Link>
              <Link href="/review">How stories are chosen</Link>
              <Link href="/brief">Weekly Brief</Link>
              <Link href="/sources">Sources</Link>
              <a href="/api/feed.atom">Atom 1.0</a>
              <a href="/api/sources.opml">OPML</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
