import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_BYTES = 5 * 1024 * 1024;

interface KtmExtractedData {
  nama: string;
  nim: string;
  jurusan: string;
  kampus?: string;
  documentType?: 'ktm' | 'siakad' | 'other';
  method: 'gemini';
}

function matchesImageMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 12) return false;
  if (mimeType === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }
  if (mimeType === 'image/webp') {
    return (
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  return false;
}

// Ekstraksi cepat via Gemini Vision jika API key tersedia di server (batas waktu 7 detik).
async function extractWithGemini(
  base64Data: string,
  mimeType: string,
  apiKey: string
): Promise<KtmExtractedData | null> {
  const promptText =
    'Analisis gambar bukti identitas mahasiswa ini. Gambar bisa berupa foto fisik Kartu Tanda Mahasiswa (KTM) ATAU screenshot halaman Biodata SIAKAD mahasiswa. Ekstrak data berikut: nama lengkap mahasiswa, NIM (Nomor Induk Mahasiswa/NPM, bukan NIK/NISN/No HP), jurusan atau program studi, nama universitas/kampus (jika ada), dan jenis dokumen ("ktm", "siakad", atau "other"). Kembalikan HANYA format JSON valid tanpa markdown code block: {"nama": "...", "nim": "...", "jurusan": "...", "kampus": "...", "documentType": "ktm"|"siakad"|"other"}. Jika suatu data tidak ditemukan, isi dengan string kosong.';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: promptText },
                { inline_data: { mime_type: mimeType, data: base64Data } },
              ],
            },
          ],
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.1,
          },
        }),
      }
    );

    if (!response.ok) return null;
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const parsed = JSON.parse(text);
    return {
      nama: parsed.nama || '',
      nim: String(parsed.nim || '').replace(/[^0-9A-Z]/gi, ''),
      jurusan: parsed.jurusan || '',
      kampus: parsed.kampus || '',
      documentType:
        parsed.documentType === 'ktm' || parsed.documentType === 'siakad'
          ? parsed.documentType
          : 'other',
      method: 'gemini',
    };
  } catch (err) {
    console.warn('Gemini vision unavailable or timed out, switching to browser OCR:', err instanceof Error ? err.message : 'error');
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Tidak terautentikasi.' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_active')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.is_active === false) {
      return NextResponse.json({ error: 'Akun dinonaktifkan.' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Berkas foto KTM atau screenshot SIAKAD tidak ditemukan' },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: 'Berkas harus berupa gambar JPG/PNG/WebP maksimal 5 MB.' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!matchesImageMagicBytes(buffer, file.type)) {
      return NextResponse.json(
        { error: 'Isi berkas tidak sesuai dengan format gambar yang didukung.' },
        { status: 400 }
      );
    }

    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (geminiKey) {
      const base64Data = buffer.toString('base64');
      const geminiResult = await extractWithGemini(base64Data, file.type, geminiKey);
      if (geminiResult && (geminiResult.nim || geminiResult.nama)) {
        return NextResponse.json({
          success: true,
          data: geminiResult,
        });
      }
    }

    return NextResponse.json({
      success: true,
      needsClientOcr: true,
    });
  } catch (error) {
    console.error('Error verifying identity document:', error);
    return NextResponse.json(
      {
        success: true,
        needsClientOcr: true,
      },
      { status: 200 }
    );
  }
}
