import type { Metadata } from "next";
import { Bebas_Neue, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const bebas = Bebas_Neue({
  weight: "400",
  variable: "--font-bebas",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Omoggle - MOG OR BE MOGGED",
  description: "Real-time looksmaxxing battles via P2P video chat",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${bebas.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen bg-[#09090B] text-zinc-200 antialiased">
        {children}
      </body>
    </html>
  );
}