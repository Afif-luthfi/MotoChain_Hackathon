import { DEFAULT_API_URL } from "../src/lib/api-config.js";
const value = process.env.VITE_API_URL ?? DEFAULT_API_URL;
if (!value)
  throw Error("Set VITE_API_URL to the public Supabase Edge Function URL.");
const url = new URL(value);
if (
  url.protocol !== "https:" ||
  url.username ||
  url.password ||
  url.search ||
  url.hash ||
  ["localhost", "127.0.0.1"].includes(url.hostname) ||
  ![
    "/",
    "/functions/v1/motochain-api",
    "/functions/v1/motochain-api/",
  ].includes(url.pathname)
)
  throw Error(
    "VITE_API_URL must be a public HTTPS origin or the Motochain Supabase Edge Function URL.",
  );
console.log("Vercel backend URL configuration validated.");
