import type React from "react"
import { WalletProvider } from "@/components/wallet-provider"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"

export const metadata = {
  title: "BannerSOL - Custom Banners for Solana Projects",
  description: "Create custom banners for your Solana project with BannerSOL",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark">
          <WalletProvider>{children}</WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}



import './globals.css'