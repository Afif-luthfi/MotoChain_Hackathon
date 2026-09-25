if (process.env.VITE_PREVIEW_ONLY === "true") {
  if (process.env.VERCEL_ENV === "production")
    throw Error("Preview-only builds cannot be deployed to production.");
  console.log("Frontend preview only: AI and writes disabled.");
} else {
  const value = process.env.VITE_API_URL;
  if (!value)
    throw Error(
      "Set VITE_API_URL to your persistent backend HTTPS origin before deploying to Vercel.",
    );
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    ["localhost", "127.0.0.1"].includes(url.hostname)
  )
    throw Error("VITE_API_URL must be a public HTTPS origin without a path.");
  console.log("Vercel backend URL configuration validated.");
}
