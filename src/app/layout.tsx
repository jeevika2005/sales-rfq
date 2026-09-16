import type { Metadata } from "next";
import "./globals.css";

// Brand guide calls for the native system-ui stack (no webfont dependency
// for body chrome) — defined once as --font-sans in globals.css.

export const metadata: Metadata = {
  title: "Sales RFQ",
  description: "Industrial valve RFQ quoting",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
