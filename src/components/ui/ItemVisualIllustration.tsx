'use client';

import { Briefcase, CreditCard, Key, Package, Smartphone, Tag } from 'lucide-react';

interface ItemVisualIllustrationProps {
  theme: string;
  isBlurred?: boolean;
  category?: string;
}

// Ilustrasi visual barang kampus pengganti foto asli bila pelapor tidak mengunggah foto.
export default function ItemVisualIllustration({
  theme,
  isBlurred,
  category,
}: ItemVisualIllustrationProps) {
  const renderGraphic = () => {
    switch (theme) {
      case 'ktm':
        return (
          <div className="w-48 h-28 bg-blue-800 rounded-xl p-3 text-white shadow-md border border-blue-400/30 flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/20 pb-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center text-[8px] font-bold text-blue-950">
                  ID
                </div>
                <span className="text-[9px] font-bold tracking-wider uppercase">
                  Kartu Tanda Mahasiswa
                </span>
              </div>
              <CreditCard className="w-3.5 h-3.5 text-blue-200" />
            </div>
            <div className="flex items-center gap-2.5 my-auto">
              <div className="w-10 h-12 rounded bg-blue-200 flex items-center justify-center text-blue-900 font-bold text-[10px] shrink-0">
                FOTO
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-bold leading-none">IDENTITAS KAMPUS</div>
                <div className="text-[9px] text-blue-100 font-mono">NIM TERLINDUNGI</div>
                <div className="text-[8px] bg-white/20 px-1.5 py-0.5 rounded inline-block">
                  KAMPUS PNUP
                </div>
              </div>
            </div>
          </div>
        );
      case 'wallet':
        return (
          <div className="w-44 h-28 bg-stone-800 rounded-xl p-3 text-amber-100 shadow-md border border-amber-700/50 flex flex-col justify-between relative">
            <div className="w-full border-b border-dashed border-amber-600/40 pb-1 flex justify-between items-center">
              <span className="text-[9px] uppercase tracking-widest text-amber-200">
                Dompet / Kartu
              </span>
              <Briefcase className="w-3.5 h-3.5 text-amber-300" />
            </div>
            <div className="flex gap-1.5 items-center my-auto">
              <div className="w-12 h-8 rounded bg-emerald-700 border border-emerald-500/40 text-[8px] p-1 font-bold text-white">
                KARTU
              </div>
              <div className="w-12 h-8 rounded bg-blue-700 border border-blue-500/40 text-[8px] p-1 font-bold text-white">
                ATM
              </div>
              <div className="w-12 h-8 rounded bg-rose-800 border border-rose-500/40 text-[8px] p-1 font-bold text-white">
                ISI
              </div>
            </div>
            <div className="w-full border-t border-dashed border-amber-600/40 pt-1 text-[8px] text-amber-200 text-right">
              Ilustrasi Kategori Dompet
            </div>
          </div>
        );
      case 'key':
        return (
          <div className="flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 border-2 border-slate-600 flex flex-col items-center justify-center shadow-md relative">
              <Key className="w-8 h-8 text-amber-400" />
              <span className="text-[8px] text-slate-200 font-mono mt-0.5">KUNCI</span>
              <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow">
                <Tag className="w-3 h-3" />
              </div>
            </div>
          </div>
        );
      case 'tumbler':
        return (
          <div className="flex flex-col items-center justify-center">
            <div className="w-12 h-28 rounded-t-lg rounded-b-xl bg-neutral-800 border border-neutral-600 flex flex-col items-center justify-between p-1.5 shadow-md">
              <div className="w-10 h-3 bg-neutral-400 rounded-sm" />
              <span className="text-[8px] text-neutral-200 font-bold tracking-widest rotate-90">
                BARANG
              </span>
              <div className="w-8 h-4 bg-amber-400 rounded-sm text-[7px] text-neutral-950 font-bold flex items-center justify-center">
                UMUM
              </div>
            </div>
          </div>
        );
      case 'charger':
        return (
          <div className="flex items-center justify-center gap-2">
            <div className="w-24 h-16 rounded-lg bg-slate-900 border border-slate-700 p-2 flex flex-col justify-between shadow-md">
              <span className="text-[9px] font-bold text-blue-300 tracking-wider">ELEKTRONIK</span>
              <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className="w-2/3 h-full bg-blue-500" />
              </div>
              <span className="text-[8px] text-slate-300 font-mono">PERANGKAT</span>
            </div>
          </div>
        );
      default:
        return (
          <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-inner">
            {category === 'Elektronik' ? (
              <Smartphone className="w-8 h-8" />
            ) : (
              <Package className="w-8 h-8" />
            )}
          </div>
        );
    }
  };

  return (
    <div
      aria-hidden="true"
      className="w-full h-40 bg-slate-100 relative flex items-center justify-center overflow-hidden"
    >
      <div
        className={`transition-all duration-300 ${
          isBlurred ? 'blur-md scale-105 select-none pointer-events-none' : 'blur-0 scale-100'
        }`}
      >
        {renderGraphic()}
      </div>
    </div>
  );
}
