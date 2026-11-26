export interface ParsedIdentityDoc {
  nama: string;
  nim: string;
  jurusan: string;
  phone?: string;
  documentType: 'ktm' | 'siakad' | 'other';
  rawText?: string;
}

// Ekstraksi teks pintar untuk foto fisik KTM maupun screenshot halaman Biodata SIAKAD.
export function parseIdentityText(raw: string): ParsedIdentityDoc {
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const upperRaw = raw.toUpperCase();
  const isSiakad =
    upperRaw.includes('SIAKAD') ||
    upperRaw.includes('BIODATA') ||
    upperRaw.includes('STATUS AKADEMIK') ||
    upperRaw.includes('TAHUN ANGKATAN') ||
    upperRaw.includes('SEMESTER BERJALAN');
  const isKtm =
    upperRaw.includes('KARTU TANDA MAHASISWA') ||
    upperRaw.includes('STUDENT CARD') ||
    upperRaw.includes('KTM');

  let nim = '';
  let nama = '';
  let jurusan = '';
  let phone = '';

  // 1. Ekstraksi NIM (format SIAKAD: baris "NIM" lalu baris nilai di bawahnya)
  for (let i = 0; i < lines.length - 1; i++) {
    if (/^(?:NIM|N\.I\.M|NPM|NOMOR\s*INDUK(?:\s*MAHASISWA)?)\s*\*?[:\.]?$/i.test(lines[i])) {
      const candidate = lines[i + 1].replace(/[^0-9A-Z]/gi, '');
      if (candidate.length >= 5 && /\d{5,}/.test(candidate)) {
        nim = candidate;
        break;
      }
    }
  }

  // Format satu baris: "NIM : 47125005"
  if (!nim) {
    const nimLabelMatch = raw.match(
      /(?:NIM|N\.I\.M|NO\.?\s*INDUK(?:\s*MAHASISWA)?|NOMOR\s*INDUK|STUDENT\s*ID|NPM)[:\s\.\-]+([A-Z0-9\.\-\/]{5,20})/i
    );
    if (nimLabelMatch?.[1] && /\d{5,}/.test(nimLabelMatch[1])) {
      nim = nimLabelMatch[1].replace(/[^0-9A-Z]/gi, '');
    }
  }

  // Cadangan: deretan 7-12 digit angka (hindari 08... no HP dan 16 digit NIK)
  if (!nim || nim.length < 5) {
    const digitMatches = raw.match(/\b\d{7,12}\b/g);
    if (digitMatches && digitMatches.length > 0) {
      const nonPhone = digitMatches.find((d) => !d.startsWith('08') && !d.startsWith('628'));
      if (nonPhone) {
        nim = nonPhone;
      }
    }
  }

  // 2. Ekstraksi Nama (format SIAKAD: baris "Nama" lalu baris nilai di bawahnya)
  const sanitizeName = (val: string): string =>
    val
      .replace(/\b(?:NIM|N\.I\.M|NPM|PRODI|PROGRAM\s*STUDI|JURUSAN|FAKULTAS|TTL|TEMPAT|TANGGAL|JENIS|ALAMAT)\b.*$/i, '')
      .replace(/[^A-Za-z\s\.\,\']/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/[\.\,\-\:\s]+$/g, '')
      .trim();

  for (let i = 0; i < lines.length - 1; i++) {
    if (/^(?:NAMA(?:\s*LENGKAP)?|NAME)\s*\*?[:\.]?$/i.test(lines[i])) {
      const nextLine = sanitizeName(lines[i + 1]);
      if (nextLine.length >= 3 && nextLine.length <= 55 && !/\d/.test(nextLine)) {
        nama = nextLine;
        break;
      }
    }
  }

  // Format satu baris: "Nama : RAIHAN ABDILLAH" (jangan menyeberangi baris baru)
  if (!nama) {
    const namaLabelMatch = raw.match(
      /(?:NAMA(?:\s*LENGKAP)?|NAME)[ \t:\.\-]+([A-Za-z \t\.\,\'\`]{3,55})/i
    );
    if (namaLabelMatch?.[1]) {
      const cleaned = sanitizeName(namaLabelMatch[1]);
      if (cleaned.length >= 3 && !/^(?:LENGKAP|MAHASISWA|BIODATA|SAYA)$/i.test(cleaned)) {
        nama = cleaned;
      }
    }
  }

  // 3. Ekstraksi Program Studi / Jurusan
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^(?:PRODI|PROGRAM\s*STUDI|JURUSAN|DEPARTEMEN|FAKULTAS)\s*\*?[:\.]?$/i.test(line)) {
      if (i + 1 < lines.length) {
        const nextClean = lines[i + 1]
          .replace(/[^A-Za-z0-9\s\.\,\'\(\)\/\-]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (nextClean.length >= 3) {
          jurusan = nextClean;
          break;
        }
      }
    }

    const match = line.match(
      /(?:PRODI|PROGRAM\s*STUDI|JURUSAN|DEPARTEMEN|FAKULTAS)[ \t:\.\-]+([A-Za-z0-9 \t\.\,\'\(\)\/\-]{3,85})/i
    );
    if (match?.[1]) {
      let val = match[1]
        .replace(/[^A-Za-z0-9\s\.\,\'\(\)\/\-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        if (
          !/(?:NAMA|NIM|PRODI|JURUSAN|KARTU|MAHASISWA|TAHUN|SEMESTER|KELAS|STATUS|\b\d{6,}\b)/i.test(
            nextLine
          ) &&
          nextLine.length < 35 &&
          nextLine.length > 2
        ) {
          const nextClean = nextLine
            .replace(/[^A-Za-z0-9\s\.\,\'\(\)\/\-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (nextClean) {
            val += ' ' + nextClean;
          }
        }
      }
      jurusan = val;
      break;
    }
  }

  // 4. Ekstraksi No. HP (opsional dari Biodata SIAKAD)
  const phoneMatch = raw.match(/\b(08\d{8,12})\b/);
  if (phoneMatch?.[1]) {
    phone = phoneMatch[1];
  }

  // Heuristik cadangan nama jika masih kosong
  if (!nama) {
    const ignoredKeywords = [
      'KARTU',
      'TANDA',
      'MAHASISWA',
      'UNIVERSITAS',
      'INSTITUT',
      'POLITEKNIK',
      'SEKOLAH',
      'TINGGI',
      'REPUBLIK',
      'INDONESIA',
      'KEMENTERIAN',
      'STUDENT',
      'CARD',
      'IDENTITY',
      'BLU',
      'KAMPUS',
      'MERDEKA',
      'SIAKAD',
      'BIODATA',
      'AKADEMIK',
      'JADWAL',
      'ABSENSI',
      'NILAI',
      'TUGAS',
      'MAGANG',
      'PEMBAYARAN',
      'HOME',
      'CHOOSE',
    ];

    for (const line of lines) {
      const upper = line.toUpperCase();
      const hasIgnored = ignoredKeywords.some((kw) => upper.includes(kw));
      const hasDigits = /\d/.test(line);
      if (!hasIgnored && !hasDigits && line.length >= 4 && line.length <= 40) {
        if (/^[A-Za-z\s\.\,\']+$/.test(line)) {
          nama = line.trim();
          break;
        }
      }
    }
  }

  const documentType: 'ktm' | 'siakad' | 'other' = isSiakad
    ? 'siakad'
    : isKtm
      ? 'ktm'
      : 'other';

  return { nama, nim, jurusan, phone, documentType, rawText: raw.substring(0, 800) };
}
