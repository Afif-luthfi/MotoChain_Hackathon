import { digest, validateMetadata } from "./schema.js";

export async function loadMetadata(
  uri,
  expectedDigest,
  apiBase,
  fetchImpl = fetch,
) {
  const unavailable = {
    data: null,
    integrity: false,
    dataError: "Data belum tersedia atau tidak valid. Coba muat ulang.",
  };
  if (!/^0x[a-f0-9]{64}$/.test(expectedDigest)) return unavailable;
  let source, backup;
  try {
    source = new URL(uri);
    const local = ["localhost", "127.0.0.1"].includes(source.hostname);
    if (source.protocol !== "https:" && !(source.protocol === "http:" && local))
      return unavailable;
    backup = new URL(
      apiBase.replace(/\/$/, "") + "/api/metadata/" + expectedDigest,
    );
    if (
      backup.protocol !== "https:" &&
      !(
        backup.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(backup.hostname)
      )
    )
      return unavailable;
    // Migrated localhost records are read from Supabase first on every device.
    const candidates =
      local && backup.protocol === "https:"
        ? [backup.href, source.href]
        : [source.href, backup.href];
    for (const url of new Set(candidates)) {
      let response;
      try {
        response = await fetchImpl(url, {
          signal: AbortSignal.timeout(10000),
          credentials: "omit",
          referrerPolicy: "no-referrer",
        });
        if (!response.ok) continue;
        const raw = await response.text();
        if (raw.length > 12000) return unavailable;
        const data = validateMetadata(JSON.parse(raw));
        if (digest(data) !== expectedDigest)
          return {
            data: null,
            integrity: false,
            dataError: "Isi catatan tidak cocok dengan bukti blockchain.",
          };
        return { data, integrity: true };
      } catch {
        /* Try the content-addressed migration copy if the source is unavailable. */
      }
    }
  } catch {
    return unavailable;
  }
  return unavailable;
}
