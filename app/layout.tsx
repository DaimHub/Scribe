import { Cause, Geist_Mono, Inter } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ACCENT_BOOTSTRAP_SCRIPT } from "@/lib/accent";
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

// The Scribe brand face. Loaded at ExtraBold (800) only — the single weight
// the wordmark uses — and exposed as --font-brand (see globals.css / Wordmark).
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
        fontMono.variable,
        "font-sans",
        inter.variable,
        cause.variable,
      )}
    >
      <head>
        {/* Apply the saved accent hue synchronously, before first paint, so
            users who picked a non-default colour don't see an indigo flash. */}
        <script dangerouslySetInnerHTML={{ __html: ACCENT_BOOTSTRAP_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <TooltipProvider delay={150}>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
