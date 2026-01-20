import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

const playfair = Playfair_Display({ 
  subsets: ["latin"],
  variable: "--font-playfair",
});

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://mundicollesi.com'),
  title: {
    default: "Mundi Collesi | Bespoke Hand-Painted Wallpapers",
    template: "%s | Mundi Collesi"
  },
  description: "Exquisite hand-painted wallpapers for the discerning few. Mundi Collesi creates bespoke, high-end wall coverings using silk, gold leaf, and traditional artistry.",
  keywords: ["hand-painted wallpaper", "bespoke wallpaper", "luxury wall coverings", "silk wallpaper", "gold leaf wallpaper", "mural art", "high-end interior design", "New Zealand luxury"],
  authors: [{ name: "Mundi Collesi" }],
  creator: "Mundi Collesi",
  icons: {
    // Google requires a square favicon that is at least 48x48 and crawlable.
    icon: [
      { url: "/icon.png", type: "image/png", sizes: "48x48" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
    shortcut: ["/favicon.ico"],
  },
  openGraph: {
    type: "website",
    locale: "en_NZ",
    url: "https://mundicollesi.com",
    title: "Mundi Collesi | The Art of Living",
    description: "Transforming residences into living galleries with exquisite hand-painted wallpapers.",
    siteName: "Mundi Collesi",
    images: [
      {
        url: "https://images.unsplash.com/photo-1615529182904-14819c35db37?q=80&w=2680&auto=format&fit=crop",
        width: 1200,
        height: 630,
        alt: "Mundi Collesi Luxury Wallpaper",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Mundi Collesi | Bespoke Hand-Painted Wallpapers",
    description: "Exquisite hand-painted wallpapers for the discerning few.",
    images: ["https://images.unsplash.com/photo-1615529182904-14819c35db37?q=80&w=2680&auto=format&fit=crop"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${playfair.variable} ${inter.variable} font-sans antialiased bg-white text-gray-900`}
      >
        <Navbar />
        <main className="min-h-screen">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
