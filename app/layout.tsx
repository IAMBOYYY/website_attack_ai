import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nexus Swarm — Multi-Agent Orchestration',
  description: 'Bring your own API keys. Run a swarm of models against any target. Everything stays in your browser.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-void text-ink min-h-screen">{children}</body>
    </html>
  );
}
