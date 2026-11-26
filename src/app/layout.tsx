import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import Script from 'next/script';
import './globals.css';
import AppShell from '@/components/shell/AppShell';
import { AppProvider } from '@/context/AppContext';

export const metadata: Metadata = {
  applicationName: 'Campus Lost & Found',
  title: 'Campus Lost & Found',
  description: 'Sistem Informasi Kehilangan & Temuan Barang Kampus',
  appleWebApp: {
    capable: true,
    title: 'Lost & Found',
    statusBarStyle: 'default',
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#2563eb',
  colorScheme: 'light',
};

// Aplikasi ini menyimpan seluruh state di sisi klien (mode demo),
// sehingga navigasi dibiarkan blocking alih-alih diprerender statis.
export const instant = false;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body className="antialiased">
        <Script id="pwa-install-capture" strategy="beforeInteractive">
          {`window.addEventListener('beforeinstallprompt', function (event) {
  event.preventDefault();
  window.__pwaInstallPrompt = event;
  window.dispatchEvent(new Event('pwa-install-available'));
});`}
        </Script>
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
