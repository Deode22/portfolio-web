import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import { siteCopy } from "@/data/profile";
import { assetUrl, resolveAsset } from "@/lib/assets";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0A0B0A",
  width: "device-width",
  initialScale: 1,
};

/**
 * The OG card is only advertised when the file really exists: a zero-byte PNG
 * resolves over HTTP but renders as nothing, which is worse for a social
 * preview than omitting the image entirely.
 */
const ogImage = resolveAsset("images/og-image.png", "image");

export const metadata: Metadata = {
  metadataBase: new URL(siteCopy.siteOrigin),
  title: {
    default: `${siteCopy.name} — ${siteCopy.title}`,
    template: `%s — ${siteCopy.name}`,
  },
  description: siteCopy.description,
  authors: [{ name: siteCopy.name }],
  creator: siteCopy.name,
  keywords: [
    "Geospatial",
    "Forestry",
    "Data Engineering",
    "Earth Observation",
    "LiDAR",
    "Sentinel-2",
    "NDVI",
    "RUSLE",
    "Madrid",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteCopy.siteOrigin,
    title: `${siteCopy.name} — ${siteCopy.title}`,
    description: siteCopy.description,
    siteName: siteCopy.name,
    images: ogImage
      ? [
          {
            url: assetUrl(ogImage.path),
            width: 1200,
            height: 630,
            alt: siteCopy.name,
          },
        ]
      : [],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteCopy.name} — ${siteCopy.title}`,
    description: siteCopy.description,
    images: ogImage ? [assetUrl(ogImage.path)] : [],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn("dark h-full antialiased", inter.variable, spaceGrotesk.variable, jetbrains.variable)}
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <a
          href="#main"
          className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-50 focus-visible:bg-brand-strong focus-visible:px-3 focus-visible:py-2 focus-visible:text-brand-strong-foreground"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
