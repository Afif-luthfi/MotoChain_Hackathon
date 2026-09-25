import { BrowserProvider } from "ethers";
let session;
export function clearAiAuthorization() {
  session = undefined;
}
export async function aiAuthorization(api) {
  if (!window.ethereum)
    throw new Error("Hubungkan MetaMask untuk memverifikasi akses AI.");
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const wallet = (await signer.getAddress()).toLowerCase();
  if (
    session?.wallet === wallet &&
    session.api === api &&
    session.expires > Date.now() + 5000
  )
    return { Authorization: "Bearer " + session.token };
  async function post(route, body) {
    const response = await fetch(api + route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "Verifikasi akses AI gagal.");
    return data;
  }
  const challenge = await post("/api/auth/challenge", { wallet });
  const signature = await signer.signMessage(challenge.message);
  const login = await post("/api/auth/session", {
    nonce: challenge.nonce,
    signature,
  });
  session = { ...login, wallet, api };
  return { Authorization: "Bearer " + login.token };
}
