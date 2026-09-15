import type { Metadata, Viewport } from "next";
import { Italiana, Red_Hat_Text } from "next/font/google";
import "./globals.css";

const display = Italiana({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
});

const text = Red_Hat_Text({
  variable: "--font-text",
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "noctiluca",
  description:
    "A deep-sea dive lit by messages from strangers. Read the lights people left at the depths where they wrote them, and leave one of your own.",
};

export const viewport: Viewport = {
  themeColor: "#01060b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable}`}>
      <body>{children}</body>
    </html>
  );
}
