import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RealToken — Fractional Real Estate on Stellar",
  description:
    "Tokenize real estate assets on the Stellar blockchain. Buy, sell, and transfer fractional property ownership with on-chain settlement.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
