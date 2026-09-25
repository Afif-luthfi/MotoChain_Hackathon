import { BrowserProvider, Contract, JsonRpcProvider, isAddress } from "ethers";
import artifact from "../generated/MotochainService.json";
import { canonical, digest, uploadMessage, validateMetadata } from "./schema";

export const networks = {
  testnet: {
    id: 968,
    label: "BOT Testnet",
    rpc: "https://rpc.bohr.life",
    explorer: "https://scan.bohr.life",
    contract: import.meta.env.VITE_TESTNET_CONTRACT || "",
  },
  mainnet: {
    id: 677,
    label: "BOT Mainnet",
    rpc: "https://rpc.botchain.ai",
    explorer: "https://scan.botchain.ai",
    contract: import.meta.env.VITE_MAINNET_CONTRACT || "",
  },
};
export function contractAddress(network) {
  if (!networks[network]) return "";
  return (
    networks[network]?.contract ||
    localStorage.getItem("motochain.contract." + network) ||
    ""
  );
}
export function configured(network) {
  return isAddress(contractAddress(network));
}
function publicContract(network) {
  if (!configured(network))
    throw new Error(
      "Kontrak jaringan ini belum dikonfigurasi. Buka Pengaturan jaringan.",
    );
  return new Contract(
    contractAddress(network),
    artifact.abi,
    new JsonRpcProvider(networks[network].rpc, networks[network].id, {
      staticNetwork: true,
    }),
  );
}
export async function connectWallet(network) {
  if (!networks[network])
    throw new Error(
      "Jaringan tidak didukung. Pilih BOT Testnet atau BOT Mainnet.",
    );
  if (!window.ethereum)
    throw new Error(
      "Dompet belum tersedia. Buka lewat browser MetaMask atau pasang ekstensi MetaMask.",
    );
  {
    const net = networks[network];
    const chainId = "0x" + net.id.toString(16);
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId }],
      });
    } catch (error) {
      if (error.code !== 4902) throw error;
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId,
            chainName: net.label,
            nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
            rpcUrls: [net.rpc],
            blockExplorerUrls: [net.explorer],
          },
        ],
      });
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId }],
      });
    }
  }
  const accounts = await window.ethereum.request({
    method: "eth_requestAccounts",
  });
  return accounts[0];
}
async function metadata(uri, expectedDigest) {
  try {
    const url = new URL(uri);
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      )
    )
      throw new Error("Alamat data tidak didukung.");
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    if (!response.ok) throw new Error("Data belum tersedia.");
    const raw = await response.text();
    if (raw.length > 12000) throw new Error("Data terlalu besar.");
    const data = validateMetadata(JSON.parse(raw));
    if (digest(data) !== expectedDigest)
      return {
        data: null,
        integrity: false,
        dataError: "Isi catatan tidak cocok dengan bukti blockchain.",
      };
    return { data, integrity: true };
  } catch {
    return {
      data: null,
      integrity: false,
      dataError: "Data belum tersedia atau tidak valid. Coba muat ulang.",
    };
  }
}
async function allPages(method, ...args) {
  const ids = [];
  for (let offset = 0; offset < 10000; offset += 100) {
    const page = await method(...args, offset, 100);
    ids.push(...page);
    if (page.length < 100) return ids;
  }
  throw new Error("Terlalu banyak data untuk tampilan MVP ini.");
}
async function motorData(contract, id) {
  const m = await contract.getMotor(id);
  return {
    id: String(id),
    owner: m.owner,
    digest: m.digest,
    uri: m.uri,
    createdAt: Number(m.createdAt),
    ...(await metadata(m.uri, m.digest)),
  };
}
export async function chainMotors(network, owner) {
  const contract = publicContract(network);
  return Promise.all(
    (await allPages(contract.ownerMotorIds, owner)).map((id) =>
      motorData(contract, id),
    ),
  );
}
export async function chainPassport(network, id, account) {
  const contract = publicContract(network);
  const motor = await motorData(contract, id);
  const ids = await allPages(contract.serviceIds, id);
  const records = await Promise.all(
    ids.map(async (recordId) => {
      const r = await contract.getRecord(recordId);
      return {
        id: String(recordId),
        motorId: id,
        issuer: r.issuer,
        digest: r.digest,
        uri: r.uri,
        status: Number(r.status),
        submittedAt: Number(r.submittedAt),
        decidedAt: Number(r.decidedAt),
        ...(await metadata(r.uri, r.digest)),
      };
    }),
  );
  let workflowVersion = 1;
  try {
    workflowVersion = Number(await contract.WORKFLOW_VERSION());
  } catch {}
  return { ...motor, records, workflowVersion };
}
export async function recordProof(network, record) {
  const contract = publicContract(network);
  const latest = await contract.runner.getBlockNumber();
  // A timestamp binary search avoids asking RPCs for an unbounded chain-wide log range.
  async function atTime(timestamp) {
    let low = 0,
      high = latest + 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      const block = await contract.runner.getBlock(middle);
      if (!block) throw new Error("Blok tidak tersedia.");
      if (block.timestamp < timestamp) low = middle + 1;
      else high = middle;
    }
    return low;
  }
  const start = await atTime(record.submittedAt);
  const end = Math.min(latest, (await atTime(record.submittedAt + 1)) - 1);
  const submitted = await contract.queryFilter(
    contract.filters.ServiceSubmitted(record.motorId, record.id),
    start,
    Math.max(start, end),
  );
  if (!submitted.length)
    throw new Error("Bukti belum ditemukan oleh RPC. Coba kembali.");
  return {
    submitted: submitted[0].transactionHash,
  };
}
export async function chainWrite(network, action, args, account, progress) {
  if (!configured(network)) throw new Error("Kontrak belum dikonfigurasi.");
  const connected = await connectWallet(network);
  if (connected.toLowerCase() !== account.toLowerCase())
    throw new Error("Akun berubah. Periksa kembali formulir sebelum mengirim.");
  const provider = new BrowserProvider(window.ethereum, undefined, {
    cacheTimeout: -1,
  });
  const signer = await provider.getSigner();
  const contract = new Contract(contractAddress(network), artifact.abi, signer);
  try {
    if (Number(await contract.WORKFLOW_VERSION()) !== 2) throw new Error();
  } catch {
    throw new Error(
      "Kontrak ini masih versi lama. Deploy MotochainService versi 2, lalu perbarui alamat di Pengaturan jaringan. Data kontrak lama tetap ada.",
    );
  }
  if (
    action === "submit" &&
    (await contract.getMotor(args.motorId)).owner.toLowerCase() !==
      connected.toLowerCase()
  )
    throw new Error("Hanya pemilik motor yang dapat menyimpan catatan.");
  let method, params;
  if (action === "register" || action === "submit") {
    validateMetadata(args.data);
    const hash = digest(args.data),
      timestamp = Date.now();
    progress("Setujui tanda tangan untuk menyimpan catatan publik.");
    const signature = await signer.signMessage(uploadMessage(hash, timestamp));
    const base = import.meta.env.VITE_API_URL || location.origin;
    const response = await fetch(base.replace(/\/$/, "") + "/api/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: JSON.parse(canonical(args.data)),
        timestamp,
        signature,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Penyimpanan gagal.");
    if (result.hash !== hash)
      throw new Error("Sidik digital penyimpanan tidak cocok.");
    const uri = new URL(result.path, base).href;
    if (network === "mainnet" && new URL(uri).protocol !== "https:")
      throw new Error(
        "Mainnet memerlukan penyimpanan HTTPS publik. Konfigurasikan VITE_API_URL.",
      );
    method =
      action === "register" ? contract.registerMotor : contract.submitService;
    params = action === "register" ? [hash, uri] : [args.motorId, hash, uri];
  } else {
    throw new Error("Tindakan tidak didukung.");
  }
  const estimate = await method.estimateGas(...params);
  const fee = await provider.getFeeData();
  if (
    (await provider.getBalance(connected)) <
    (estimate * (fee.maxFeePerGas || fee.gasPrice || 0n) * 12n) / 10n
  )
    throw new Error("Saldo BOT belum cukup untuk biaya transaksi.");
  progress("Konfirmasi transaksi di dompet.");
  const tx = await method(...params);
  localStorage.setItem("motochain.pending." + network, tx.hash);
  progress("Transaksi dikirim. Menunggu konfirmasi jaringan…");
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error("Transaksi gagal di jaringan.");
  localStorage.removeItem("motochain.pending." + network);
  if (action === "register") {
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed?.name === "MotorRegistered")
          return String(parsed.args.motorId);
      } catch {
        /* Other contracts can emit logs in the same receipt. */
      }
    }
  }
}
export async function pendingStatus(network) {
  const hash = localStorage.getItem("motochain.pending." + network);
  if (!hash) return null;
  const provider = new JsonRpcProvider(networks[network].rpc);
  const receipt = await provider.getTransactionReceipt(hash);
  if (receipt) localStorage.removeItem("motochain.pending." + network);
  return {
    hash,
    status: receipt
      ? receipt.status === 1
        ? "Transaksi sebelumnya berhasil. Muat ulang data."
        : "Transaksi sebelumnya gagal."
      : "Transaksi sebelumnya masih menunggu konfirmasi.",
  };
}
export function friendlyError(error) {
  if (error.code === 4001 || error.code === "ACTION_REJECTED")
    return "Permintaan dibatalkan di dompet. Data belum dikonfirmasi.";
  if (error.code === "INSUFFICIENT_FUNDS")
    return "Saldo BOT belum cukup untuk biaya transaksi.";
  return (
    error.reason ||
    error.shortMessage ||
    error.message ||
    "Terjadi gangguan. Coba kembali."
  );
}
