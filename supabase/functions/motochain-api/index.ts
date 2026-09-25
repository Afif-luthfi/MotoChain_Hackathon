import { createSupabaseStore } from "../../../server/supabase-store.js";
import { createEdgeHandler } from "../../../server/edge-handler.js";

const env = (name: string) => Deno.env.get(name) || "";
const positive = (name: string, fallback: number) => {
  const value = Number(env(name) || fallback);
  if (!Number.isSafeInteger(value) || value < 1) throw Error("Invalid " + name);
  return value;
};
const url = env("SUPABASE_URL");
const key =
  env("SUPABASE_SERVICE_ROLE_KEY") ||
  JSON.parse(env("SUPABASE_SECRET_KEYS") || "{}").default;
const publicApiUrl = url + "/functions/v1/motochain-api";
const store = createSupabaseStore({
  url,
  key,
  options: {
    publicUrl: env("PUBLIC_URL") || publicApiUrl,
    allowedWallets: env("AI_ALLOWED_WALLETS"),
    allowAllWallets: true,
    maxBytes: positive("METADATA_MAX_BYTES", 104857600),
    maxFiles: positive("METADATA_MAX_FILES", 10000),
    uploadsPerDay: positive("METADATA_DAILY_LIMIT", 500),
    walletUploadsPerDay: positive("METADATA_WALLET_DAILY_LIMIT", 20),
  },
});

// Custom authentication: signed EVM metadata and hashed wallet sessions.
// Public GET endpoints need no Supabase Auth JWT.
Deno.serve(
  createEdgeHandler({
    store,
    publicApiUrl,
    apiKey: env("GEMINI_API_KEY"),
    model: env("GEMINI_MODEL") || "gemini-3.5-flash",
    dailyLimit: Math.min(positive("AI_DAILY_LIMIT", 50), 1000),
    walletDailyLimit: positive("AI_WALLET_DAILY_LIMIT", 10),
  }),
);
