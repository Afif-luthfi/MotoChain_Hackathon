import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Contract, JsonRpcProvider, isAddress, ZeroAddress } from "ethers";
import QRCode from "qrcode";
import {
  networks,
  contractAddress,
  connectWallet,
  chainMotors,
  chainPassport,
  chainWrite,
  recordProof,
  pendingStatus,
  friendlyError,
} from "./lib/chain";
import { validateMetadata } from "./lib/schema";
import ReceiptAssistant from "./ReceiptAssistant";
import "./styles.css";

const same = (a, b) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());
const short = (a) =>
  a ? a.slice(0, 6) + "…" + a.slice(-4) : "Hubungkan dompet";
const passportUrl = (network, id) => `#/passport/${network}/${id}`;
const go = (path) => {
  location.hash = path;
};
const labels = {
  name: "Nama panggilan motor",
  brand: "Merek",
  model: "Model",
  year: "Tahun kendaraan",
  color: "Warna",
  marker: "Penanda fisik",
  date: "Tanggal servis",
  odometer: "Pembacaan odometer (km)",
  complaint: "Keluhan atau kebutuhan servis",
  action: "Pekerjaan yang dilakukan",
  parts: "Komponen yang diganti",
};
function Notice({ children, error = false }) {
  return (
    <div
      className={"notice" + (error ? " error" : "")}
      role={error ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
function Field({ name, value, onChange, required = true, ...props }) {
  const id = React.useId();
  return (
    <div className="field">
      <label htmlFor={id}>
        {labels[name]}
        {!required && <small> opsional</small>}
      </label>
      <input
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        maxLength={600}
        {...props}
      />
    </div>
  );
}
function App() {
  const [route, setRoute] = useState(location.hash || "#/");
  const [network, setNetwork] = useState(
    localStorage.getItem("motochain.network") || "testnet",
  );
  const [account, setAccount] = useState("");
  const [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0),
    [menu, setMenu] = useState(false),
    [pending, setPending] = useState(null);
  const parts = route.split("?")[0].replace(/^#\/?/, "").split("/");
  const page = parts[0] || "home";
  const routeNetwork = ["passport", "service", "workshop"].includes(page)
    ? parts[1]
    : network;
  const unsupportedNetwork =
    ["passport", "service", "workshop"].includes(page) &&
    !["testnet", "mainnet"].includes(routeNetwork);
  const activeNetwork = ["testnet", "mainnet"].includes(routeNetwork)
    ? routeNetwork
    : "testnet";
  const actor = account;
  useEffect(() => {
    const change = () => {
      setRoute(location.hash || "#/");
      setMenu(false);
      setError("");
      setNotice("");
      window.scrollTo(0, 0);
    };
    addEventListener("hashchange", change);
    return () => removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    setNetwork(activeNetwork);
    localStorage.setItem("motochain.network", activeNetwork);
  }, [activeNetwork]);
  useEffect(() => {
    const update = (accounts) => {
      setAccount(accounts[0] || "");
      setRevision((n) => n + 1);
    };
    const chain = () => {
      setAccount("");
      setNotice(
        "Jaringan dompet berubah. Hubungkan kembali untuk memeriksa jaringan.",
      );
    };
    const wallet = window.ethereum;
    wallet
      ?.request({ method: "eth_accounts" })
      .then(update)
      .catch(() => {});
    wallet?.on?.("accountsChanged", update);
    wallet?.on?.("chainChanged", chain);
    return () => {
      wallet?.removeListener?.("accountsChanged", update);
      wallet?.removeListener?.("chainChanged", chain);
    };
  }, []);
  useEffect(() => {
    let active = true;
    setPending(null);
    pendingStatus(activeNetwork)
      .then((p) => {
        if (active) setPending(p);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [activeNetwork, revision]);
  async function connect() {
    setError("");
    try {
      setAccount(await connectWallet(activeNetwork));
      setRevision((n) => n + 1);
    } catch (e) {
      setError(friendlyError(e));
    }
  }
  async function mutate(action, args, next) {
    if (busy) return false;
    setBusy(true);
    setError("");
    setNotice("Memeriksa dompet…");
    try {
      if (!actor) throw new Error("Hubungkan dompet pemilik terlebih dahulu.");
      const result = await chainWrite(
        activeNetwork,
        action,
        args,
        actor,
        setNotice,
      );
      setRevision((n) => n + 1);
      setNotice("Transaksi berhasil dikonfirmasi.");
      next?.(result);
      return true;
    } catch (e) {
      setNotice("");
      setError(friendlyError(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  const ctx = {
    network: activeNetwork,
    actor,
    busy,
    revision,
    connect,
    mutate,
    setError,
    setNotice,
  };
  const id = ["passport", "service"].includes(page) ? parts[2] : undefined;
  return (
    <>
      <a
        className="skip"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main").focus();
        }}
      >
        Lewati ke konten
      </a>
      <header>
        <a className="wordmark" href="#/">
          motochain<span>service</span>
        </a>
        <button
          className="mobile-menu secondary"
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          Menu
        </button>
        <nav className={menu ? "open" : ""} aria-label="Navigasi utama">
          <a
            href="#/garage"
            className={["home", "garage"].includes(page) ? "active" : ""}
            aria-current={
              ["home", "garage"].includes(page) ? "page" : undefined
            }
          >
            Garasi Saya
          </a>
          <a
            href={`#/service/${activeNetwork}`}
            className={page === "service" ? "active" : ""}
            aria-current={page === "service" ? "page" : undefined}
          >
            Tambah Catatan Servis
          </a>
          <a
            href="#/check"
            className={["check", "passport"].includes(page) ? "active" : ""}
            aria-current={
              ["check", "passport"].includes(page) ? "page" : undefined
            }
          >
            Cek Paspor Motor
          </a>
          <a href="#/guide">Panduan</a>
          <a href="#/settings">Jaringan</a>
        </nav>
        <div className="header-actions">
          <label className="sr-only" htmlFor="network">
            Pilih jaringan
          </label>
          <select
            id="network"
            value={activeNetwork}
            disabled={busy}
            onChange={(e) => {
              setNetwork(e.target.value);
              localStorage.setItem("motochain.network", e.target.value);
              setAccount("");
              go("/garage");
            }}
          >
            <option value="testnet">BOT Testnet</option>
            <option value="mainnet">BOT Mainnet</option>
          </select>
          {
            <button
              className="secondary"
              disabled={busy}
              title={account}
              onClick={connect}
            >
              {short(account)}
            </button>
          }
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        {import.meta.env.VITE_PREVIEW_ONLY === "true" && (
          <Notice>
            Preview tampilan: backend belum terhubung. Pendaftaran motor,
            penyimpanan catatan, dan Gemini belum aktif di tautan ini. Riwayat
            dengan alamat data lokal mungkin belum dapat dibuka.
          </Notice>
        )}
        {error && <Notice error>{error}</Notice>}
        {notice && <Notice>{notice}</Notice>}
        {pending && (
          <Notice>
            {pending.status}{" "}
            <a
              href={`${networks[activeNetwork].explorer}/tx/${pending.hash}`}
              target="_blank"
              rel="noreferrer"
            >
              Periksa transaksi
            </a>
            <button
              className="text-button"
              onClick={() => setRevision((n) => n + 1)}
            >
              Periksa ulang
            </button>
          </Notice>
        )}
        {!isAddress(contractAddress(activeNetwork)) && (
          <Notice>
            Kontrak {networks[activeNetwork].label} belum dikonfigurasi.{" "}
            <a href="#/settings">Buka Pengaturan jaringan</a>.
          </Notice>
        )}
        {unsupportedNetwork && (
          <Notice error>
            Tautan ini menggunakan jaringan yang tidak didukung.{" "}
            <a href="#/garage">Buka Garasi Saya</a> dan pilih jaringan BOT.
          </Notice>
        )}
        {!unsupportedNetwork &&
          ["home", "garage", "passport", "service", "workshop"].includes(
            page,
          ) && (
            <OwnerPage
              key={`${page}:${activeNetwork}:${actor}:${id || ""}`}
              id={id}
              mode={
                page === "service"
                  ? "service"
                  : page === "passport"
                    ? "detail"
                    : "garage"
              }
              ctx={ctx}
            />
          )}
        {page === "register" && (
          <Register key={`${activeNetwork}:${actor}`} ctx={ctx} />
        )}
        {page === "settings" && (
          <Settings ctx={ctx} refresh={() => setRevision((n) => n + 1)} />
        )}
        {page === "guide" && <Guide />}
        {page === "check" && <PassportSearch ctx={ctx} />}
        {![
          "home",
          "garage",
          "passport",
          "service",
          "workshop",
          "register",
          "settings",
          "guide",
          "check",
        ].includes(page) && (
          <div className="empty">
            <h1>Halaman tidak ditemukan</h1>
            <a href="#/">Buka garasi</a>
          </div>
        )}
      </main>
      <footer>
        <a className="footer-brand" href="#/">
          Motochain Service
        </a>
        <p>Dicatat pemilik. Kondisi fisik tetap perlu diperiksa.</p>
        <div>
          <a href="https://botchain.ai" target="_blank" rel="noreferrer">
            BOT Chain
          </a>
          <a href="https://scan.botchain.ai" target="_blank" rel="noreferrer">
            Explorer
          </a>
        </div>
      </footer>
    </>
  );
}
function PassportSearch({ ctx }) {
  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <p className="section-label">Riwayat servis terbuka</p>
          <h1>Cek Paspor Motor</h1>
          <p>
            Masukkan ID paspor pada jaringan yang dipilih untuk membaca riwayat
            servis motor.
          </p>
        </div>
      </div>
      <p>
        Tidak perlu menghubungkan dompet. Kamu juga bisa memindai QR paspor yang
        dibagikan pemilik menggunakan kamera ponsel untuk membuka tautannya.
      </p>
      <form
        className="passport-search"
        onSubmit={(e) => {
          e.preventDefault();
          go(passportUrl(ctx.network, new FormData(e.currentTarget).get("id")));
        }}
      >
        <label htmlFor="find-passport">Cari ID paspor blockchain</label>
        <input
          id="find-passport"
          name="id"
          required
          pattern="[1-9][0-9]*"
          inputMode="numeric"
          placeholder="Contoh ID paspor: 2"
        />
        <button className="secondary">Buka paspor</button>
      </form>

      <p className="caption">
        Riwayat dicatat oleh pemilik, bukan verifikasi bengkel atau jaminan
        kondisi motor. Hanya pemilik yang dapat menambahkan catatan.
      </p>
    </section>
  );
}
function OwnerPage({ id, ctx, mode }) {
  const [motors, setMotors] = useState({ loading: true });
  const [state, setState] = useState({});
  const [selected, setSelected] = useState(id || "");
  useEffect(() => {
    let active = true;
    if (!ctx.actor) {
      setMotors({ items: [] });
      return;
    }
    chainMotors(ctx.network, ctx.actor)
      .then((items) => {
        if (!active) return;
        setMotors({ items });
      })
      .catch((e) => {
        if (active) setMotors({ error: friendlyError(e) });
      });
    return () => {
      active = false;
    };
  }, [ctx.network, ctx.actor, ctx.revision, id]);
  useEffect(() => {
    let active = true;
    if (!selected) {
      setState({});
      return;
    }
    if (!/^[1-9]\d*$/.test(selected)) {
      setState({ error: "Nomor paspor tidak valid." });
      return;
    }
    setState({ loading: true });
    chainPassport(ctx.network, selected, ctx.actor)
      .then((motor) => {
        if (active) setState({ motor });
      })
      .catch((e) => {
        if (active) setState({ error: friendlyError(e) });
      });
    return () => {
      active = false;
    };
  }, [selected, ctx.actor, ctx.network, ctx.revision]);
  const motor = state.motor;
  const publicView =
    mode === "detail" && (!motor || !same(motor.owner, ctx.actor));
  return (
    <section
      className={`page owner-page ${mode === "garage" ? "garage-overview" : ""}`}
    >
      <div className="page-heading">
        <div>
          <p className="section-label">
            {publicView ? "Riwayat servis terbuka" : "Buku servis milikmu"}
          </p>
          <h1>
            {mode === "service"
              ? "Tambah Catatan Servis"
              : mode === "detail"
                ? publicView
                  ? "Paspor Motor Publik"
                  : "Informasi motor saya"
                : "Garasi Saya"}
          </h1>
          <p>
            {mode === "service"
              ? "Pilih motor, baca nota dengan Gemini, lalu periksa dan simpan catatan."
              : mode === "detail"
                ? "Identitas motor dan seluruh riwayat servisnya."
                : "Pilih motor untuk melihat informasi dan riwayat servis."}
          </p>
        </div>
        <a className="button" href="#/register">
          Daftarkan motor
        </a>
      </div>
      {!ctx.actor && mode !== "detail" && (
        <Notice>
          <button onClick={ctx.connect}>Hubungkan dompet pemilik</button>
          <p>Paspor publik tetap dapat dibaca tanpa dompet.</p>
        </Notice>
      )}
      <div className={publicView ? "public-passport-layout" : "owner-layout"}>
        {!publicView && (
          <aside className="owner-motors">
            <h2>Motor saya</h2>
            <p className="caption">Nomor motor mengikuti urutan di dompetmu.</p>
            {motors.loading && <p role="status">Mengambil daftar motor…</p>}
            {motors.error && <Notice error>{motors.error}</Notice>}
            {motors.items?.length === 0 && (
              <p>Belum ada motor terdaftar untuk dompet ini.</p>
            )}
            <div className="garage-motor-list">
              {motors.items?.map((m, index) => (
                <a
                  key={m.id}
                  className={selected === m.id ? "selected" : ""}
                  aria-current={selected === m.id ? "page" : undefined}
                  href={
                    mode === "service"
                      ? `#/service/${ctx.network}/${m.id}`
                      : passportUrl(ctx.network, m.id)
                  }
                >
                  <span>Motor #{index + 1}</span>
                  <strong>
                    {m.data?.brand} {m.data?.model || "Data belum tersedia"}
                  </strong>
                  <small>{m.data?.name}</small>
                  <span className="inline-link">
                    {mode === "service"
                      ? "Pilih motor ini"
                      : "Informasi & riwayat servis"}
                  </span>
                </a>
              ))}
            </div>
            {ctx.actor && (
              <p className="caption">
                Dompet aktif <span className="address">{ctx.actor}</span>
              </p>
            )}
          </aside>
        )}
        {publicView && (
          <a className="back" href="#/check">
            ← Cek paspor motor lain
          </a>
        )}
        <div className="owner-content" hidden={mode === "garage"}>
          {state.loading && <p role="status">Memeriksa paspor dan catatan…</p>}
          {state.error && <Notice error>{state.error}</Notice>}
          {!selected && !state.loading && (
            <div className="empty">
              <h2>
                {mode === "service"
                  ? "Pilih motor yang diservis."
                  : "Mulai dari motormu."}
              </h2>
              <p>
                {mode === "service"
                  ? "Pilih motor dari daftar. Catatan akan tersimpan pada motor yang kamu pilih."
                  : "Daftarkan motor untuk menyimpan catatan servis pertamanya."}
              </p>
            </div>
          )}
          {motor && (
            <MotorBook key={motor.id} motor={motor} ctx={ctx} mode={mode} />
          )}
        </div>
      </div>
    </section>
  );
}
function MotorBook({ motor, ctx, mode }) {
  const owner = same(motor.owner, ctx.actor),
    legacy = motor.workflowVersion !== 2;
  const [qr, setQr] = useState(""),
    [copied, setCopied] = useState("");
  const url =
    location.origin + location.pathname + passportUrl(ctx.network, motor.id);
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(url, { width: 180, margin: 2 }).then((v) => {
      if (active) setQr(v);
    });
    return () => {
      active = false;
    };
  }, [url]);
  return (
    <>
      <div className="owner-motor-heading">
        <div>
          <p className="section-label">
            ID Paspor Blockchain: #{motor.id} · {networks[ctx.network].label}
          </p>
          <h2>
            {motor.data?.brand} {motor.data?.model || "Data belum tersedia"}
          </h2>
          <p>
            {motor.data?.year} / {motor.data?.color} / {motor.data?.name}
          </p>
        </div>
        <span>{motor.records.length} catatan</span>
      </div>
      {!motor.integrity && (
        <Notice error>
          Identitas motor tidak dapat diverifikasi. Periksa paspor sebelum
          melanjutkan.
        </Notice>
      )}
      {mode !== "service" && (
        <details className="share-passport">
          <summary>Bagikan paspor dan lihat pemilik</summary>
          <p>
            Pemilik: <span className="address">{motor.owner}</span>
          </p>
          {qr && (
            <img
              src={qr}
              alt={`QR untuk paspor motor ${motor.id}`}
              width="180"
              height="180"
            />
          )}
          <label className="field">
            <span>Tautan paspor</span>
            <input readOnly value={url} onFocus={(e) => e.target.select()} />
          </label>
          <button
            className="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied("Tautan disalin.");
              } catch {
                setCopied("Pilih dan salin tautan di atas.");
              }
            }}
          >
            Salin tautan
          </button>
          {copied && <p role="status">{copied}</p>}
        </details>
      )}
      {legacy && (
        <Notice>
          Paspor ini menggunakan kontrak lama dengan alur mekanik. Riwayat tetap
          dapat dibaca. Untuk alur satu pemilik, deploy kontrak versi 2 dan
          daftarkan motor pada kontrak baru.{" "}
          <a href="#/settings">Pengaturan jaringan</a>
        </Notice>
      )}
      {owner &&
        !legacy &&
        (mode === "service" ? (
          <>
            <a className="back" href={passportUrl(ctx.network, motor.id)}>
              Lihat informasi & riwayat motor
            </a>
            <ServiceForm motor={motor} ctx={ctx} />
          </>
        ) : (
          <a className="button" href={`#/service/${ctx.network}/${motor.id}`}>
            Tambah catatan untuk motor ini
          </a>
        ))}
      {!owner && !legacy && (
        <Notice>
          Paspor publik. Hanya dompet pemilik motor yang dapat menambahkan
          catatan.
        </Notice>
      )}
      {mode !== "service" && (
        <section className="owner-history">
          <p className="section-label">Buku servis</p>
          <h2>Riwayat servis</h2>
          <p className="caption">
            {legacy
              ? "Catatan historis dari kontrak lama."
              : "Catatan disimpan oleh pemilik; pembacaan Gemini bukan verifikasi bengkel atau kondisi motor."}
          </p>
          {!motor.records.length && (
            <div className="empty">Riwayat dimulai dari servis pertama.</div>
          )}
          {motor.records
            .slice()
            .reverse()
            .map((r) => (
              <article className="owner-record" key={r.id}>
                <p className="section-label">
                  {legacy
                    ? [
                        "Menunggu pada kontrak lama",
                        "Disetujui pada kontrak lama",
                        "Ditolak pada kontrak lama",
                      ][r.status]
                    : "Dicatat pemilik"}
                </p>
                {!r.integrity ? (
                  <Notice error>
                    Isi catatan tidak cocok dengan bukti atau belum tersedia.
                  </Notice>
                ) : (
                  <>
                    <h3>{r.data.action}</h3>
                    <p>
                      {r.data.date} ·{" "}
                      {Number(r.data.odometer).toLocaleString("id-ID")} km
                    </p>
                    <dl>
                      <dt>Keluhan</dt>
                      <dd>{r.data.complaint}</dd>
                      <dt>Komponen</dt>
                      <dd>{r.data.parts || "Tidak dicantumkan"}</dd>
                    </dl>
                  </>
                )}
                <details>
                  <summary>Asal catatan & bukti</summary>
                  <p>
                    Pencatat: <span className="address">{r.issuer}</span>
                  </p>
                  <p className="address">Sidik digital: {r.digest}</p>
                  <Proof record={r} ctx={ctx} />
                </details>
              </article>
            ))}
        </section>
      )}
    </>
  );
}
const blankService = () => ({
  kind: "service",
  date: "",
  odometer: "",
  complaint: "",
  action: "",
  parts: "",
});
function ServiceForm({ motor, ctx }) {
  const [data, setData] = useState(blankService),
    [reviewing, setReviewing] = useState(false),
    [assistantKey, setAssistantKey] = useState(0);
  function change(e) {
    setData((d) => ({ ...d, [e.target.name]: e.target.value }));
  }
  return (
    <section className="owner-entry">
      <h2>Tambah catatan servis</h2>
      <p>
        Foto atau teks nota hanya dikirim ke Gemini saat kamu menyetujui. Sumber
        nota tidak disimpan.
      </p>
      <fieldset disabled={ctx.busy} className="owner-fieldset">
        <div hidden={reviewing}>
          <ReceiptAssistant
            key={assistantKey}
            onApply={(values) =>
              setData((d) => ({
                ...d,
                ...Object.fromEntries(
                  Object.entries(values).filter(
                    ([k, v]) => k in d && k !== "kind" && v,
                  ),
                ),
              }))
            }
          />
        </div>
        {reviewing ? (
          <div className="review">
            <h3>Periksa catatan sebelum disimpan</h3>
            <dl>
              {Object.entries(data)
                .filter(([k]) => k !== "kind")
                .map(([k, v]) => (
                  <React.Fragment key={k}>
                    <dt>{labels[k]}</dt>
                    <dd>{v || "Tidak diisi"}</dd>
                  </React.Fragment>
                ))}
            </dl>
            <Notice>
              Siapa pun dapat membaca catatan ini melalui ID, tautan, atau QR
              paspor, termasuk orang yang tidak terhubung ke dompetmu. Catatan
              tidak dapat diedit setelah transaksi berhasil. Jangan sertakan
              data pribadi. Foto dan teks nota sumber tidak ikut disimpan.
            </Notice>
            <div className="actions">
              <button
                disabled={ctx.busy}
                onClick={async () => {
                  const ok = await ctx.mutate("submit", {
                    motorId: motor.id,
                    data,
                  });
                  if (ok) {
                    go(passportUrl(ctx.network, motor.id));
                    setData(blankService());
                    setReviewing(false);
                    setAssistantKey((n) => n + 1);
                  }
                }}
              >
                {ctx.busy ? "Menyimpan…" : "Simpan catatan"}
              </button>
              <button
                className="secondary"
                disabled={ctx.busy}
                onClick={() => setReviewing(false)}
              >
                Ubah catatan
              </button>
            </div>
          </div>
        ) : (
          <form
            className="form-sheet"
            onSubmit={(e) => {
              e.preventDefault();
              try {
                validateMetadata(data);
                setReviewing(true);
                ctx.setError("");
              } catch (e) {
                ctx.setError(e.message);
              }
            }}
          >
            <p className="caption">
              Periksa hasil AI dan lengkapi yang kosong. Kamu tetap dapat
              mengisi manual jika nota tidak terbaca.
            </p>
            <div className="form-grid">
              {Object.keys(data)
                .filter((k) => k !== "kind")
                .map((k) => (
                  <Field
                    key={k}
                    name={k}
                    value={data[k]}
                    onChange={change}
                    required={k !== "parts"}
                    type={
                      k === "date"
                        ? "date"
                        : k === "odometer"
                          ? "number"
                          : "text"
                    }
                    min={k === "odometer" ? "0" : undefined}
                    max={
                      k === "date"
                        ? new Date().toISOString().slice(0, 10)
                        : undefined
                    }
                  />
                ))}
            </div>
            <button>Periksa catatan</button>
          </form>
        )}
      </fieldset>
    </section>
  );
}
function Register({ ctx }) {
  const [data, setData] = useState({
      kind: "motor",
      name: "",
      brand: "",
      model: "",
      year: "",
      color: "",
      marker: "",
    }),
    [review, setReview] = useState(false);
  return (
    <section className="page form-page">
      <a className="back" href="#/garage">
        Kembali ke garasi
      </a>
      <h1>Mulai riwayat motor.</h1>
      <p>Daftarkan menggunakan dompet pemilik yang akan mencatat servis.</p>
      {!ctx.actor && (
        <Notice>
          <button onClick={ctx.connect}>Hubungkan dompet pemilik</button>
        </Notice>
      )}
      {review ? (
        <div className="review">
          <h2>Periksa sebelum mendaftarkan</h2>
          <dl>
            {Object.entries(data)
              .filter(([k]) => k !== "kind")
              .map(([k, v]) => (
                <React.Fragment key={k}>
                  <dt>{labels[k]}</dt>
                  <dd>{v || "Tidak diisi"}</dd>
                </React.Fragment>
              ))}
          </dl>
          <Notice>
            Identitas ini bersifat publik. Paspor mencatat pengelola, bukan
            bukti kepemilikan hukum.
          </Notice>
          <div className="actions">
            <button
              disabled={ctx.busy || !ctx.actor}
              onClick={() =>
                ctx.mutate("register", { data }, (id) =>
                  go(passportUrl(ctx.network, id)),
                )
              }
            >
              Konfirmasi pendaftaran
            </button>
            <button
              disabled={ctx.busy}
              className="secondary"
              onClick={() => setReview(false)}
            >
              Ubah isian
            </button>
          </div>
        </div>
      ) : (
        <form
          className="form-sheet"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              validateMetadata(data);
              setReview(true);
            } catch (e) {
              ctx.setError(e.message);
            }
          }}
        >
          <div className="form-grid">
            {Object.keys(data)
              .filter((k) => k !== "kind")
              .map((k) => (
                <Field
                  key={k}
                  name={k}
                  value={data[k]}
                  onChange={(e) => setData({ ...data, [k]: e.target.value })}
                  required={k !== "marker"}
                  type={k === "year" ? "number" : "text"}
                  min={k === "year" ? "1900" : undefined}
                  max={k === "year" ? new Date().getFullYear() + 1 : undefined}
                />
              ))}
          </div>
          <p className="caption">
            Jangan masukkan nomor polisi, nomor rangka lengkap atau dokumen
            pribadi.
          </p>
          <button disabled={!ctx.actor}>Periksa pendaftaran</button>
        </form>
      )}
    </section>
  );
}
function Proof({ record, ctx }) {
  const [state, setState] = useState({});
  return (
    <>
      {state.error && <Notice error>{state.error}</Notice>}
      {state.links ? (
        <a
          target="_blank"
          rel="noreferrer"
          href={`${networks[ctx.network].explorer}/tx/${state.links.submitted}`}
        >
          Bukti penyimpanan
        </a>
      ) : (
        <button
          className="secondary"
          disabled={state.loading}
          onClick={async () => {
            setState({ loading: true });
            try {
              setState({ links: await recordProof(ctx.network, record) });
            } catch (e) {
              setState({ error: friendlyError(e) });
            }
          }}
        >
          {state.loading ? "Mencari bukti…" : "Ambil bukti transaksi"}
        </button>
      )}
    </>
  );
}
function Settings({ ctx, refresh }) {
  const [working, setWorking] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false);
  return (
    <section className="page form-page">
      <h1>Pengaturan jaringan</h1>
      <Notice>
        Alamat kontrak menghubungkan aplikasi dengan data motor di jaringan BOT.
        Jika alamat sudah terisi dari konfigurasi aplikasi, kamu tidak perlu
        memasukkannya lagi.
      </Notice>
      {Object.entries(networks).map(([key, net]) => (
        <form
          key={key}
          className="form-sheet"
          onSubmit={async (e) => {
            e.preventDefault();
            const address = new FormData(e.currentTarget).get("address").trim();
            setWorking(true);
            setError(false);
            setMessage("Memeriksa kontrak…");
            const provider = new JsonRpcProvider(net.rpc);
            try {
              if (!isAddress(address) || address === ZeroAddress)
                throw new Error("Alamat kontrak tidak valid.");
              if ((await provider.getNetwork()).chainId !== BigInt(net.id))
                throw new Error("Jaringan RPC tidak sesuai.");
              if ((await provider.getCode(address)) === "0x")
                throw new Error("Tidak ada kontrak pada alamat ini.");
              const contract = new Contract(
                address,
                ["function WORKFLOW_VERSION() view returns(uint256)"],
                provider,
              );
              let version;
              try {
                version = await contract.WORKFLOW_VERSION();
              } catch {
                throw new Error(
                  "Kontrak versi lama atau tidak cocok. Deploy MotochainService versi 2.",
                );
              }
              if (version !== 2n)
                throw new Error("Kontrak bukan MotochainService versi 2.");
              localStorage.setItem("motochain.contract." + key, address);
              refresh();
              setMessage("Alamat kontrak versi 2 tersimpan untuk browser ini.");
            } catch (e) {
              setError(true);
              setMessage(friendlyError(e));
            } finally {
              provider.destroy();
              setWorking(false);
            }
          }}
        >
          <h2>{net.label}</h2>
          <p>
            Chain ID {net.id} ·{" "}
            <a href={net.explorer} target="_blank" rel="noreferrer">
              Explorer
            </a>
          </p>
          <label className="field">
            <span>Alamat kontrak Motochain Service</span>
            <input
              name="address"
              defaultValue={contractAddress(key)}
              placeholder="0x…"
              required
              readOnly={!!net.contract}
            />
          </label>
          {net.contract ? (
            <p>
              Alamat kontrak sudah dikonfigurasi untuk aplikasi ini. Lanjutkan
              ke <a href="#/garage">Garasi Saya</a> untuk membuka motor.
            </p>
          ) : (
            <button className="secondary" disabled={working}>
              Periksa & simpan alamat
            </button>
          )}
        </form>
      ))}
      {message && <Notice error={error}>{message}</Notice>}
      <p>
        Pengaturan browser tidak mengubah konfigurasi pengunjung lain. Jangan
        masukkan seed phrase atau private key.
      </p>
    </section>
  );
}
function Guide() {
  return (
    <section className="page form-page">
      <h1>Satu akun untuk buku servismu.</h1>
      <ol className="owner-guide">
        <li>Hubungkan dompet pemilik dan daftarkan motor.</li>
        <li>
          Buka Tambah Catatan Servis di navbar dan pilih motor. Unggah foto atau
          tempel teks nota.
        </li>
        <li>
          Setujui pengiriman ke Gemini, baca hasilnya, lalu Terapkan ke
          formulir. Foto dan teks sumber tidak disimpan.
        </li>
        <li>
          Periksa semua isian dan klik Simpan catatan. Untuk BOT, setujui tanda
          tangan penyimpanan dan transaksi dari akun yang sama.
        </li>
        <li>
          Catatan langsung tampil di riwayat. Bagikan paspor melalui tautan atau
          QR.
        </li>
      </ol>
      <Notice>
        Gemini membantu menyalin informasi, bukan membuktikan nota asli atau
        pekerjaan bengkel benar. Catatan berasal dari pemilik.
      </Notice>
      <h2>Kontrak yang sudah pernah dideploy</h2>
      <p>
        Versi lama menggunakan dua akun dan tetap menyimpan riwayatnya. Deploy
        ulang file MotochainService.sol terbaru dengan compiler 0.8.30,
        optimizer 200 runs dan EVM Paris, lalu atur alamat versi 2. Tidak ada
        pemindahan data otomatis.
      </p>
      <a href="#/settings">Buka Pengaturan jaringan</a>
    </section>
  );
}
createRoot(document.getElementById("root")).render(<App />);
