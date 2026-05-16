import "./globals.css"; // CRITICAL: Do not remove this, or your site loses all styling!
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import LogoHomeButton from "./components/LogoHomeButton";
import { Bebas_Neue, Inter } from "next/font/google";

const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// ─── VIEWPORT (separated from Metadata per Next.js 14+ best practice) ────────
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#080A0F" },
    { media: "(prefers-color-scheme: light)", color: "#080A0F" },
  ],
};

// ─── BASE URL (single source of truth) ───────────────────────────────────────
const BASE_URL = "https://omoggle.games";
const OG_IMAGE = `${BASE_URL}/og-image.jpg`;

// ─── METADATA ────────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  // ── Core ──────────────────────────────────────────────────────────────────
  title: {
    default: "Omoggle — 1v1 Mog Battle Arena | Omegle Alternative",
    template: "%s | Omoggle",
  },
  description:
    "Enter the arena. Omoggle is the #1 competitive 1v1 video chat platform for mogging battles, looksmaxxing ranked play, and live audience voting. Mog or be mogged.",

  // ── Keyword strategy ──────────────────────────────────────────────────────
  keywords: [
    "omoggle", "ommogle", "omgl", "omegl", "omegel", "omegle alternative",
    "omegle replacement", "omegle games", "omegle 2024", "omegle 2025",
    "random video chat", "anonymous video chat", "stranger video chat",
    "chatroulette alternative", "mogging", "mog battle", "looksmaxxing",
    "looksmax arena", "who mogs", "1v1 looks battle", "face rating",
    "face rating live", "canthal tilt", "hunter eyes game", "jawline battle",
    "mewing competition", "sigma looks", "looksmatch", "looksmaxxing community",
    "what is mogging", "how to mog", "am i attractive live vote",
    "rate my looks live", "face battle online", "who is more attractive game",
    "1v1 video battle platform",
  ],

  // ── Canonical + alternates ────────────────────────────────────────────────
  alternates: {
    canonical: BASE_URL,
  },

  // ── Authors / publisher ───────────────────────────────────────────────────
  authors: [{ name: "Omoggle", url: BASE_URL }],
  creator: "Omoggle",
  publisher: "Omoggle Games",
  generator: "Next.js",

  // ── Robots ────────────────────────────────────────────────────────────────
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // ── OpenGraph ─────────────────────────────────────────────────────────────
  openGraph: {
    type: "website",
    locale: "en_US",
    url: BASE_URL,
    siteName: "Omoggle",
    title: "Omoggle — Face The Competition. Mog or Be Mogged.",
    description:
      "The premier competitive 1v1 video chat arena. Live audience voting, global rankings, and anonymous battles. Who mogs? You decide.",
    images: [
      {
        url: OG_IMAGE,
        secureUrl: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Omoggle Arena — 1v1 Mog Battle Platform",
        type: "image/jpeg",
      },
    ],
  },

  // ── Twitter / X ───────────────────────────────────────────────────────────
  twitter: {
    card: "summary_large_image",
    site: "@omoggle",
    creator: "@omoggle",
    title: "Omoggle | Mog or Be Mogged",
    description:
      "Enter the arena. 1v1 video chat battles with live audience voting. The best Omegle alternative for the looksmaxxing community.",
    images: {
      url: OG_IMAGE,
      alt: "Omoggle — 1v1 Mog Battle Arena",
    },
  },

  // ── Verification ───────────────────────────────────────────────────────────
  verification: {
    google: "IowW72JZPNaIgMjlKjJBiWKcuv3kKwG4Wp3iqi9p0Ic",
  },

  // ── Icons ─────────────────────────────────────────────────────────────────
  // Next.js serves src/app/icon.png as /icon.png automatically (192x192).
  // The explicit list below ensures Google, browsers, and PWA all pick the right size.
  icons: {
    // Primary favicon — shown on browser tabs
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    // Shortcut icon — explicitly tells crawlers (including Googlebot) which icon to use
    shortcut: [{ url: "/android-chrome-192x192.png", type: "image/png" }],
    // Apple touch icon — iOS home screen
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.json",
  category: "games",
};

// ─── JSON-LD STRUCTURED DATA ─────────────────────────────────────────────────
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${BASE_URL}/#website`,
      url: BASE_URL,
      name: "Omoggle",
      description: "Competitive 1v1 video chat arena for mogging battles and looksmaxxing ranked play.",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${BASE_URL}/search?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Organization",
      "@id": `${BASE_URL}/#organization`,
      name: "Omoggle",
      url: BASE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/logo.png`,
        width: 512,
        height: 512,
      },
      sameAs: [
        "https://twitter.com/omoggle",
        "https://www.tiktok.com/@omoggle",
        "https://www.youtube.com/@omoggle",
        "https://discord.gg/omoggle",
        "https://reddit.com/r/omoggle",
      ],
    },
    {
      "@type": "VideoGame",
      "@id": `${BASE_URL}/#game`,
      name: "Omoggle",
      url: BASE_URL,
      description: "Omoggle is a competitive 1v1 video chat battle platform where users compete in live mogging battles judged by real-time audience voting.",
      genre: ["Social Game", "Competition", "Video Chat"],
      gamePlatform: ["Web Browser", "iOS", "Android"],
      applicationCategory: "Game",
      operatingSystem: "Any",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.8",
        reviewCount: "2104",
        bestRating: "5",
        worstRating: "1",
      },
    },
    {
      "@type": "FAQPage",
      "@id": `${BASE_URL}/#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "What is Omoggle?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Omoggle is a competitive 1v1 video chat platform where users battle anonymously and are judged by live audience voting. It is the leading Omegle alternative for the mogging and looksmaxxing community.",
          },
        },
        {
          "@type": "Question",
          name: "What is mogging?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Mogging refers to one person visually dominating another in terms of physical appearance, particularly facial features. The term comes from 'to mog' — to outcompete someone in looks. Omoggle turns this concept into a structured competitive platform.",
          },
        },
        {
          "@type": "Question",
          name: "Is Omoggle free to use?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Omoggle is free to enter and battle. No account is required for standard 1v1 battles. Create an account to track your rank, build a win streak, and appear on the global leaderboard.",
          },
        },
        {
          "@type": "Question",
          name: "How does the ranking system work?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Omoggle uses an ELO-based ranking system. Win battles and earn points. Climb from Common through Ascendant, Signal, and Apex tiers. Rankings are updated in real time after every battle.",
          },
        },
        {
          "@type": "Question",
          name: "Is Omoggle a good Omegle alternative?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Omoggle is the best Omegle alternative for users who want structured competitive video chat. Unlike Omegle, Omoggle features ranked matchmaking, live audience voting, private rooms, solo calibration scans, and a global leaderboard.",
          },
        },
      ],
    },
  ],
};

// ─── ROOT LAYOUT ─────────────────────────────────────────────────────────────
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${bebas.variable} ${inter.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <link rel="dns-prefetch" href="https://discord.gg" />
      </head>

      <body>
        <LogoHomeButton />
        {children}

        {/* --- GA4 Analytics Setup --- */}
        {process.env.NODE_ENV === "production" && (
          <>
            <Script
              src="https://www.googletagmanager.com/gtag/js?id=G-SQ0GMRNGJ6"
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){window.dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', 'G-SQ0GMRNGJ6', {
                  page_path: window.location.pathname,
                });
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}