'use client';

import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { useApp } from '@/context/AppContext';

const DISMISS_KEY = 'pwa-install-dismissed-at';
const DISMISS_DAYS = 14;

// Ajakan memasang aplikasi. Tampil hanya bila browser menyediakan dialog
// pemasangan (Chromium) atau pengguna memakai Safari di iOS.
export default function PwaInstallCard() {
  const { showToast } = useApp();
  // Nilai awal "standalone/dismissed" sengaja aman untuk SSR (kartu tersembunyi),
  // lalu disinkronkan sekali setelah mount dari API browser di dalam efek.
  const [env, setEnv] = useState<{
    standalone: boolean;
    ios: boolean;
    dismissed: boolean;
    prompt: BeforeInstallPromptEvent | null;
  }>({ standalone: true, ios: false, dismissed: true, prompt: null });
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    const userAgent = window.navigator.userAgent;
    const iosDevice =
      /iPad|iPhone|iPod/.test(userAgent) ||
      (userAgent.includes('Macintosh') && window.navigator.maxTouchPoints > 1);

    let dismissedNow = false;
    try {
      const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) ?? 0);
      dismissedNow = Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000;
    } catch {
      dismissedNow = false;
    }

    // Pembacaan API browser hanya mungkin dilakukan setelah mount, jadi nilai
    // awal ditulis di dalam efek (aman SSR karena state awal sudah default).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnv({
      standalone,
      ios: iosDevice,
      dismissed: dismissedNow,
      prompt: window.__pwaInstallPrompt ?? null,
    });

    const syncPrompt = () =>
      setEnv((prev) => ({ ...prev, prompt: window.__pwaInstallPrompt ?? null }));

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      const prompt = event as BeforeInstallPromptEvent;
      window.__pwaInstallPrompt = prompt;
      setEnv((prev) => ({ ...prev, prompt }));
    };

    const handleInstalled = () => {
      window.__pwaInstallPrompt = undefined;
      setEnv((prev) => ({ ...prev, prompt: null, standalone: true }));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('pwa-install-available', syncPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('pwa-install-available', syncPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Penyimpanan lokal bisa diblokir; ajakan tetap ditutup untuk sesi ini.
    }
    setEnv((prev) => ({ ...prev, dismissed: true }));
  };

  const handleInstall = async () => {
    if (!env.prompt || installing) return;

    setInstalling(true);
    try {
      await env.prompt.prompt();
      const choice = await env.prompt.userChoice;

      if (choice.outcome === 'accepted') {
        window.__pwaInstallPrompt = undefined;
        setEnv((prev) => ({ ...prev, prompt: null, standalone: true }));
        showToast(
          'Aplikasi Terpasang',
          'Lost & Found sekarang bisa dibuka dari layar utama.',
          'success'
        );
      } else {
        window.__pwaInstallPrompt = undefined;
        setEnv((prev) => ({ ...prev, prompt: null }));
        showToast(
          'Pemasangan Dibatalkan',
          'Anda bisa memasangnya nanti lewat menu browser.',
          'info'
        );
      }
    } catch {
      window.__pwaInstallPrompt = undefined;
      showToast('Pemasangan Gagal', 'Coba lagi lewat menu browser.', 'error');
    } finally {
      setInstalling(false);
    }
  };

  if (env.standalone || env.dismissed || (!env.prompt && !env.ios)) return null;

  return (
    <div className="px-4 pt-2">
      <section
        aria-labelledby="pwa-install-title"
        className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
            {env.ios ? (
              <Share className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Download className="w-5 h-5" aria-hidden="true" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h2 id="pwa-install-title" className="text-xs font-extrabold text-slate-800">
              Pasang Aplikasi di HP
            </h2>
            <p className="text-[11px] text-slate-600 mt-0.5">
              {env.ios
                ? 'Akses cepat seperti aplikasi native: Ketuk tombol Bagikan (Share), lalu pilih "Tambahkan ke Layar Utama".'
                : env.prompt
                  ? 'Pasang ke layar utama HP Anda untuk akses cepat tanpa membuka browser.'
                  : 'Buka menu browser (titik tiga ⋮ di Chrome) lalu pilih "Tambahkan ke Layar Utama" / "Install Aplikasi".'}
            </p>

            {env.ios ? (
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-800 text-[11px] font-bold">
                <Share className="w-3.5 h-3.5" /> Bagikan &gt; Tambahkan ke Layar Utama
              </div>
            ) : env.prompt ? (
              <button
                type="button"
                onClick={handleInstall}
                disabled={installing}
                className="mt-2.5 min-h-11 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                {installing ? 'Memproses...' : 'Pasang Sekarang'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  showToast(
                    'Cara Pasang Manual',
                    'Ketuk ikon titik tiga (⋮) di pojok kanan atas browser Anda, lalu pilih "Tambahkan ke Layar Utama" atau "Install Aplikasi".',
                    'info'
                  );
                }}
                className="mt-2.5 min-h-11 px-3.5 py-2 rounded-xl border border-blue-600 bg-blue-50 text-blue-800 text-xs font-bold transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Petunjuk Pemasangan
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Tutup ajakan pasang aplikasi"
            className="w-11 h-11 -m-2 flex items-center justify-center text-slate-500 hover:text-slate-700 rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  );
}
