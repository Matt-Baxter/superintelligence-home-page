import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Superintelligence Homepage",
  description: "Writing about superintelligence from papers, labs, research groups, forums and newsletters.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <a href="/" className="site-title">
            Superintelligence Homepage
          </a>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
