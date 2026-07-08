import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChatLog VN Studio",
  description: "AI chat logs to visual novel scenes"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
