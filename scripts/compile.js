import fs from "node:fs";
import solc from "solc";
const source = fs.readFileSync(
  new URL("../contracts/MotochainService.sol", import.meta.url),
  "utf8",
);
const input = {
  language: "Solidity",
  sources: { "MotochainService.sol": { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "paris",
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};
const output = JSON.parse(solc.compile(JSON.stringify(input)));
for (const error of output.errors || []) console.error(error.formattedMessage);
if (output.errors?.some((e) => e.severity === "error")) process.exit(1);
const artifact = output.contracts["MotochainService.sol"].MotochainService;
fs.mkdirSync("src/generated", { recursive: true });
fs.writeFileSync(
  "src/generated/MotochainService.json",
  JSON.stringify(
    { abi: artifact.abi, bytecode: "0x" + artifact.evm.bytecode.object },
    null,
    2,
  ),
);
console.log("MotochainService compiled successfully.");
