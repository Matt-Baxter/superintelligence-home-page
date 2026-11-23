import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { cookies } from "next/headers";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { normalizeTheme, THEME_SPECS } from "@/lib/theme";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

const display = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-display",
});
const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: {
    default: "Superintelligence Homepage",
    template: "%s · Superintelligence Homepage",
  },
  description:
    "A calm, explained research feed tracking progress toward AGI and superintelligence: alignment, interpretability, timelines, compute scaling and frontier AI governance.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f1" },
    { media: "(prefers-color-scheme: dark)", color: "#121211" },
  ],
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, cookieStore] = await Promise.all([getCurrentUser().catch(() => null), cookies()]);
  const theme = normalizeTheme(cookieStore.get("si_theme")?.value);
  const darkClass = THEME_SPECS[theme].isDarkScheme ? "dark " : "";

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${darkClass}${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <body>
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        <SiteHeader user={user} initialTheme={theme} />
        <main id="main-content" className="page-main" tabIndex={-1}>
          {children}
        </main>
        <footer className="site-footer">
          <div className="site-footer-inner">
            <span>Open research feeds only. No Twitter/X. Every tag and score is explained.</span>
            <div className="footer-links">
              <Link href="/analysis">Lab</Link>
              <Link href="/review">Method</Link>
              <Link href="/brief">Brief</Link>
              <Link href="/sources">Sources</Link>
              <Link href="/queue">Review queue</Link>
              <Link href="/compare">Build comparison</Link>
              <Link href="/limits">Usage limits</Link>
              <a href="/api/feed.atom">Atom</a>
              <a href="/api/sources.opml">OPML</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
