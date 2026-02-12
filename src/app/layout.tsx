import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Connect 4 - Modern Online Game',
  description:
    'Play Connect 4 against the computer or friends online with beautiful animations and modern design.',
  keywords: [
    'connect4',
    'connect four',
    'online game',
    'board game',
    'puzzle game',
  ],
  authors: [{ name: 'Connect4 Team' }],
  openGraph: {
    title: 'Connect 4 - Modern Online Game',
    description: 'Play Connect 4 with friends or AI',
    type: 'website',
    locale: 'en_US',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#3b82f6',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
