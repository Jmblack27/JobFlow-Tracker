import Link from "next/link";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JobFlow | Applications",
  description: "Track every job opportunity from wishlist to offer.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <nav className="site-nav" aria-label="Main navigation">
          <Link href="/" className="brand">
            JOBFLOW
          </Link>
          <Link href="/">Applications</Link>
          <Link href="/profile">My Profile</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
