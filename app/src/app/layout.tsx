import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Laptop draft · Halaga local prototype",
  description: "Practice describing a laptop with made-up sample data.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
