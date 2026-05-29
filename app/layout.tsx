import {
  Atkinson_Hyperlegible,
  Cause,
  Geist,
  Geist_Mono,
  Inter,
  JetBrains_Mono,
  Lora,
} from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ACCENT_BOOTSTRAP_SCRIPT } from "@/lib/accent";
import { FONTS_BOOTSTRAP_SCRIPT } from "@/lib/fonts";
import { cn } from "@/lib/utils";

// Each selectable face is bundled at build time and exposed under its own
// private --font-* variable. The semantic --font-ui / --font-mono-user
// variables (globals.css :root, overridable by the font picker) decide which
// one the `font-sans` / `font-mono` Tailwind tokens resolve to. See lib/fonts.ts.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })

// Editorial serif preset (shown as "Serif" in the picker).
const lora = Lora({ subsets: ["latin"], variable: "--font-serif-face" })

// High-legibility / accessibility preset. Non-variable face — weights required.
const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-hyperlegible",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
})

// The Scribe brand face. Loaded at ExtraBold (800) only — the single weight
// the wordmark uses — and exposed as --font-brand (see globals.css / Wordmark).
// Intentionally NOT user-switchable.
const cause = Cause({
  subsets: ["latin"],
  weight: "800",
  variable: "--font-brand",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        "font-sans",
        inter.variable,
        geist.variable,
        lora.variable,
        atkinson.variable,
        geistMono.variable,
        jetbrainsMono.variable,
        cause.variable,
      )}
    >
      <head>
        {/* Apply the saved accent hue and fonts synchronously, before first
            paint, so users who customised them don't see a flash of defaults. */}
        <script dangerouslySetInnerHTML={{ __html: ACCENT_BOOTSTRAP_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: FONTS_BOOTSTRAP_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <TooltipProvider delay={150}>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
