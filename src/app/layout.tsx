import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Hybro",
  description: "AI-powered fitness coaching platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" className={cn("font-sans", geist.variable)}>
        <body className={inter.className}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
