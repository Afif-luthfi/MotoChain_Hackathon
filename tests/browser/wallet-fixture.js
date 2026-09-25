import { Interface } from "ethers";
import fs from "node:fs";
import { digest } from "../../src/lib/schema.js";
const abi = new Interface(
  JSON.parse(fs.readFileSync("src/generated/MotochainService.json")).abi,
);
export async function mockOwnerPassport(page) {
  const owner = "0x1111111111111111111111111111111111111111",
    address = "0x3333333333333333333333333333333333333333";
  const data = {
    kind: "motor",
    name: "Motor uji",
    brand: "Honda",
    model: "Vario 160",
    year: "2023",
    color: "Hitam",
    marker: "",
  };
  await page.addInitScript(
    ({ owner, address }) => {
      localStorage.setItem("motochain.network", "testnet");
      localStorage.setItem("motochain.contract.testnet", address);
      window.ethereum = {
        request: async ({ method }) => {
          if (["eth_accounts", "eth_requestAccounts"].includes(method))
            return [owner];
          if (method === "eth_chainId") return "0x3c8";
          throw new Error("Test fixture does not send transactions");
        },
        on() {},
        removeListener() {},
      };
    },
    { owner, address },
  );
  await page.route("**/api/metadata/test-motor", (r) =>
    r.fulfill({ json: data }),
  );
  await page.route("https://rpc.bohr.life/**", async (route) => {
    const body = route.request().postDataJSON();
    const respond = (p) => {
      let result;
      if (p.method === "eth_chainId") result = "0x3c8";
      else if (p.method === "eth_call") {
        const call = abi.parseTransaction({ data: p.params[0].data });
        const values = {
          ownerMotorIds: [[1n]],
          serviceIds: [[]],
          WORKFLOW_VERSION: [2n],
          getMotor: [
            [
              owner,
              digest(data),
              "http://127.0.0.1:5180/api/metadata/test-motor",
              1789257600n,
            ],
          ],
        };
        result = abi.encodeFunctionResult(call.name, values[call.name]);
      } else
        return {
          jsonrpc: "2.0",
          id: p.id,
          error: { code: -32601, message: "Unsupported test RPC" },
        };
      return { jsonrpc: "2.0", id: p.id, result };
    };
    await route.fulfill({
      json: Array.isArray(body) ? body.map(respond) : respond(body),
    });
  });
}
