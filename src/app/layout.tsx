import type { Metadata } from "next";
import { Inter, Crimson_Pro } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import { NotificationProvider } from "@/components/NotificationProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const crimsonPro = Crimson_Pro({
  variable: "--font-crimson-pro",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Project Tavern | AI Roleplay",
  description: "A premium, aesthetic AI roleplay experience.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${crimsonPro.variable}`}>
      <body style={{ display: 'flex', flexDirection: 'row' }}>
        <NotificationProvider>
          <Sidebar />
          <main style={{ 
            flex: 1, 
            marginLeft: 'var(--sidebar-width)', 
            minHeight: '100vh',
            padding: '40px',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            zIndex: 1
          }}>
            {children}
          </main>
        </NotificationProvider>
      </body>
    </html>
  );
}
