import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Giri23', description: '毎日の活動をメッツ・時で記録する' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="ja"><body>{children}</body></html>; }
