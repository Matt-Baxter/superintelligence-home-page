import type { Metadata } from "next";
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
          <a href="/" className="site-title">
            Superintelligence Homepage
          </a>
          <nav className="account" aria-label="Account">
            {user ? (
              <>
                <span>
                  Signed in as <strong>{user.username}</strong>
                </span>
                <a href="/saved">Saved</a>
                <form method="post" action="/api/auth/signout">
                  <button type="submit" className="link-button">
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <>
                <a href="/signin">Sign in</a>
                <a href="/signup">Sign up</a>
              </>
            )}
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
