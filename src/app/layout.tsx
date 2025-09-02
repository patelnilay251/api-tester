import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { EnvironmentProvider } from "@/contexts/EnvContext";
import { HistoryProvider } from "@/contexts/HistoryContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "API Tester",
  description: "Fast and simple API testing tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} ${playfair.variable} antialiased font-inter`}
      >
        <ThemeProvider>
          <EnvironmentProvider>
            <HistoryProvider>
              {children}
            </HistoryProvider>
          </EnvironmentProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
