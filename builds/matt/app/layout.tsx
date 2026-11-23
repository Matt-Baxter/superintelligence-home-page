import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Superintelligence Homepage",
  description: "Writing about superintelligence from papers, labs, research groups, forums and newsletters.",
};

// Every page shows the visitor's sign-in state, so pages are rendered per request.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser().catch(() => null);
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link href="/" className="site-title">
            Superintelligence Homepage
          </Link>
          <nav className="account" aria-label="Account">
            {user ? (
              <>
                <span>
                  Signed in as <strong>{user.username}</strong>
                </span>
                <Link href="/saved">Saved</Link>
                <form method="post" action="/api/auth/signout">
                  <button type="submit" className="link-button">
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/signin">Sign in</Link>
                <Link href="/signup">Sign up</Link>
              </>
            )}
          </nav>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <Link href="/review">How stories are chosen</Link>: every story the AI judge reviewed, with its score.
        </footer>
      </body>
    </html>
  );
}
