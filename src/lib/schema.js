import { keccak256, toUtf8Bytes } from "ethers";

export function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  return (
    "{" +
    Object.keys(value)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + canonical(value[k]))
      .join(",") +
    "}"
  );
}
export function digest(value) {
  return keccak256(toUtf8Bytes(canonical(value)));
}
export function uploadMessage(hash, timestamp) {
  return `Motochain Service\nStore public metadata\nHash: ${hash}\nTimestamp: ${timestamp}`;
}
export function validateMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Data tidak valid.");
  const fields =
    value.kind === "motor"
      ? ["kind", "name", "brand", "model", "year", "color", "marker"]
      : value.kind === "service"
        ? ["kind", "date", "odometer", "complaint", "action", "parts"]
        : [];
  if (!fields.length || Object.keys(value).some((k) => !fields.includes(k)))
    throw new Error("Format data tidak didukung.");
  for (const key of fields) {
    if (typeof value[key] !== "string" || value[key].length > 600)
      throw new Error("Isian terlalu panjang atau tidak valid.");
    if (!["marker", "parts"].includes(key) && !value[key].trim())
      throw new Error("Lengkapi semua isian wajib.");
  }
  if (
    value.kind === "motor" &&
    (!/^\d{4}$/.test(value.year) ||
      +value.year < 1900 ||
      +value.year > new Date().getFullYear() + 1)
  )
    throw new Error("Tahun kendaraan tidak valid.");
  if (value.kind === "service") {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value.date) ||
      Number.isNaN(Date.parse(value.date)) ||
      new Date(value.date).toISOString().slice(0, 10) !== value.date ||
      value.date > new Date().toISOString().slice(0, 10)
    )
      throw new Error("Tanggal servis tidak valid atau belum terjadi.");
    if (!/^\d{1,7}$/.test(value.odometer))
      throw new Error(
        "Odometer harus berupa angka kilometer positif atau nol.",
      );
  }
  return value;
}
