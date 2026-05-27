import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link"; // ✅ ADD THIS
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Task Ticketing System",
  description: "Web App for tracking tasks",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-screen bg-white dark:bg-gray-900 text-black dark:text-white">
        
        {/* ✅ Sidebar */}
        <div className="w-60 bg-gray-200 dark:bg-gray-900 text-black dark:text-white p-4">
          <h2 className="text-xl font-bold mb-6">Menu</h2>

          <nav className="flex flex-col space-y-2">
            <Link href="/" className="hover:bg-gray-300 dark:hover:bg-gray-700 p-2 rounded">
              Active Tickets
            </Link>

            <Link href="/analytics" className="hover:bg-gray-300 dark:hover:bg-gray-700 p-2 rounded">
              Analytics
            </Link>

            <Link href="/tickets" className="hover:bg-gray-300 dark:hover:bg-gray-700 p-2 rounded">
              Ticket History
            </Link>
          </nav>
        </div>

        {/* ✅ Main Content */}
        <div className="flex-1 bg-gray-100 dark:bg-gray-900">
          {children}
        </div>

      </body>
    </html>
  );
}