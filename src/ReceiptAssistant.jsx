import React, { useEffect, useRef, useState } from "react";
import { aiAuthorization, clearAiAuthorization } from "./lib/ai-auth";
import { DEFAULT_API_URL } from "./lib/api-config";
const labels = {
  date: "Tanggal servis",
  odometer: "Odometer (km)",
  complaint: "Keluhan",
  action: "Pekerjaan",
  parts: "Komponen",
};
const api = (import.meta.env.VITE_API_URL ?? DEFAULT_API_URL).replace(
  /\/$/,
  "",
);
export default function ReceiptAssistant({ onApply }) {
  const [status, setStatus] = useState(null);
  const [text, setText] = useState("");
  const [image, setImage] = useState(null);
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [readingFile, setReadingFile] = useState(false);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState(false);
  const [applied, setApplied] = useState(false);
  const requestRef = useRef(null);
  const fileVersion = useRef(0);
  const inputRef = useRef(null);
  async function checkStatus() {
    if (import.meta.env.VITE_PREVIEW_ONLY === "true") {
      setStatus({ configured: false, preview: true });
      return;
    }
    try {
      const response = await fetch(api + "/api/ai/status", {
        signal: AbortSignal.timeout(6000),
      });
      if (!response.ok) throw new Error();
      setStatus(await response.json());
    } catch {
      setStatus({ configured: false, unavailable: true });
    }
  }
  useEffect(() => {
    checkStatus();
    return () => {
      requestRef.current?.abort();
      fileVersion.current++;
    };
  }, []);
  function clearResult() {
    setResult(null);
    setChecked(false);
    setApplied(false);
    setError("");
  }
  async function chooseFile(file) {
    const version = ++fileVersion.current;
    setReadingFile(false);
    clearResult();
    setImage(null);
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setError("Gunakan JPG, PNG, atau WebP maksimal 5 MB.");
      inputRef.current.value = "";
      return;
    }
    setReadingFile(true);
    const reader = new FileReader();
    reader.onload = () => {
      if (version !== fileVersion.current) return;
      setImage({
        mimeType: file.type,
        data: String(reader.result).split(",")[1],
        preview: String(reader.result),
        name: file.name,
      });
      setReadingFile(false);
    };
    reader.onerror = () => {
      if (version === fileVersion.current) {
        setError("Foto tidak dapat dibaca.");
        setReadingFile(false);
      }
    };
    reader.readAsDataURL(file);
  }
  async function extract() {
    if (busy) return;
    clearResult();
    setBusy(true);
    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 55000);
    try {
      const auth = status?.requiresAuth ? await aiAuthorization(api) : {};
      const response = await fetch(api + "/api/ai/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({
          text,
          image: image
            ? { mimeType: image.mimeType, data: image.data }
            : undefined,
          consent,
        }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (response.status === 401) clearAiAuthorization();
      if (!response.ok)
        throw new Error(data.error || "AI tidak dapat membaca nota.");
      setResult(data);
    } catch (e) {
      setError(
        e.name === "AbortError"
          ? "Pembacaan dihentikan atau terlalu lama. Coba lagi; isian manual tetap tersedia."
          : e.message,
      );
    } finally {
      clearTimeout(timeout);
      setBusy(false);
      requestRef.current = null;
    }
  }
  return (
    <section className="receipt-assistant" aria-labelledby="receipt-heading">
      <div className="receipt-heading">
        <div>
          <p className="section-label">Asisten nota · Gemini</p>
          <h2 id="receipt-heading">Dari nota ke catatan.</h2>
        </div>
        <span className="caption">Opsional</span>
      </div>
      <p>
        Unggah foto atau tempel teks nota. AI menyiapkan draf; kamu yang
        memeriksa pekerjaan servisnya.
      </p>
      {status === null ? (
        <p role="status">Memeriksa ketersediaan AI…</p>
      ) : !status.configured ? (
        <div className="notice">
          <p>
            {status.preview
              ? "Gemini belum aktif pada preview ini karena backend belum terhubung."
              : status.unavailable
                ? "Layanan AI belum dapat dihubungi."
                : "AI belum diaktifkan. Pengelola perlu menambahkan API key Gemini di server."}{" "}
            Formulir manual tetap bisa digunakan.
          </p>
          <button type="button" className="secondary" onClick={checkStatus}>
            Periksa status AI
          </button>
        </div>
      ) : (
        <p className="caption" role="status">
          Konfigurasi Gemini tersedia
          {status.localOnly ? " untuk akses dari komputer ini" : ""}. Koneksi
          diperiksa saat nota dikirim.
          {status.requiresAuth &&
            " MetaMask akan meminta tanda tangan untuk memverifikasi akses AI; tidak ada transaksi atau biaya gas."}
        </p>
      )}
      <div className="receipt-inputs">
        <label className="field">
          <span>
            Foto nota <small>opsional</small>
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(e) => chooseFile(e.target.files[0])}
          />
          <small>JPG, PNG, atau WebP · maksimal 5 MB</small>
        </label>
        {image && (
          <div className="receipt-preview">
            <img src={image.preview} alt="Pratinjau nota yang dipilih" />
            <div>
              <p>{image.name}</p>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => {
                  fileVersion.current++;
                  setImage(null);
                  inputRef.current.value = "";
                  clearResult();
                }}
              >
                Hapus foto
              </button>
            </div>
          </div>
        )}
        <label className="field">
          <span>
            Teks nota <small>opsional jika ada foto</small>
          </span>
          <textarea
            rows={4}
            maxLength={6000}
            value={text}
            disabled={busy}
            onChange={(e) => {
              setText(e.target.value);
              clearResult();
            }}
            placeholder="Tempel rincian servis dari nota di sini."
          />
        </label>
      </div>
      <label className="check-field">
        <input
          type="checkbox"
          checked={consent}
          disabled={busy}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>
          Saya sudah menyamarkan data pribadi dan setuju mengirim foto/teks ini
          ke Google Gemini untuk dibaca.
        </span>
      </label>
      <p className="caption">
        Jangan sertakan identitas, kontak, nomor polisi, atau nomor rangka.
        Aplikasi tidak menyimpan foto/teks sumber; hanya isian yang nanti kamu
        simpan menjadi catatan publik.
      </p>
      <div className="actions">
        <button
          type="button"
          disabled={
            busy ||
            readingFile ||
            !status?.configured ||
            !consent ||
            (!text.trim() && !image)
          }
          onClick={extract}
        >
          {busy ? "Gemini sedang membaca…" : "Baca nota dengan Gemini"}
        </button>
        {busy && (
          <button
            type="button"
            className="secondary"
            onClick={() => requestRef.current?.abort()}
          >
            Batalkan pembacaan
          </button>
        )}
      </div>
      {readingFile && <p role="status">Membaca berkas foto…</p>}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {result && (
        <div className="receipt-result">
          <h3>Draf dari Gemini</h3>
          <p className="caption">
            Belum disimpan. Isian kosong perlu dilengkapi sendiri.
          </p>
          <dl>
            {Object.entries(labels).map(([key, label]) => (
              <React.Fragment key={key}>
                <dt>{label}</dt>
                <dd>
                  {result.draft[key] || "Tidak terbaca / tidak tercantum"}
                </dd>
              </React.Fragment>
            ))}
          </dl>
          {result.warnings.length > 0 && (
            <div className="notice">
              <strong>Perlu diperiksa</strong>
              <ul>
                {result.warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          <label className="check-field">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            <span>
              Saya telah memeriksa draf dan ingin menerapkannya. Isian yang
              terisi dari AI akan menggantikan isian terkait pada formulir;
              isian yang kosong tetap dipertahankan.
            </span>
          </label>
          <button
            type="button"
            className="secondary"
            disabled={
              !checked || applied || !Object.values(result.draft).some(Boolean)
            }
            onClick={() => {
              onApply(result.draft);
              setApplied(true);
            }}
          >
            Terapkan ke formulir
          </button>
          {applied && (
            <p role="status">
              Draf diterapkan. Periksa formulir di bawah, lengkapi isian kosong,
              lalu periksa dan simpan catatan.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
