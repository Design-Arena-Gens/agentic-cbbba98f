import "./globals.css";
import { Inter } from "next/font/google";
import { clsx } from "clsx";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-slate-950">
      <body
        className={clsx(
          inter.className,
          "min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 antialiased"
        )}
      >
        {children}
      </body>
    </html>
  );
}
