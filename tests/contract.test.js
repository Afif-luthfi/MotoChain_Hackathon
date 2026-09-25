import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ganache from "ganache";
import { BrowserProvider, ContractFactory, id, ZeroHash } from "ethers";
let engine, provider, owner, stranger, contract;
before(async () => {
  engine = ganache.provider({
    logging: { quiet: true },
    wallet: { totalAccounts: 2 },
    chain: { hardfork: "shanghai" },
  });
  provider = new BrowserProvider(engine, undefined, { cacheTimeout: -1 });
  owner = await provider.getSigner(0);
  stranger = await provider.getSigner(1);
  const artifact = JSON.parse(
    fs.readFileSync("src/generated/MotochainService.json"),
  );
  contract = await new ContractFactory(
    artifact.abi,
    artifact.bytecode,
    owner,
  ).deploy();
  await contract.waitForDeployment();
});
after(async () => {
  await provider.destroy();
  await engine.disconnect();
});
test("owner-only immediate service records, immutable history and pagination", async () => {
  assert.equal(await contract.WORKFLOW_VERSION(), 2n);
  await (
    await contract.registerMotor(id("motor"), "https://example.org/motor")
  ).wait();
  await assert.rejects(
    contract
      .connect(stranger)
      .submitService(1, id("x"), "https://example.org/x"),
  );
  await assert.rejects(
    contract.submitService(99, id("x"), "https://example.org/x"),
  );
  await assert.rejects(contract.submitService(1, ZeroHash, "x"));
  await assert.rejects(contract.submitService(1, id("x"), ""));
  await assert.rejects(contract.registerMotor(id("x"), "x".repeat(301)));
  await (
    await contract.submitService(1, id("first"), "https://example.org/first")
  ).wait();
  const first = await contract.getRecord(1);
  assert.equal(first.issuer, await owner.getAddress());
  assert.equal(first.status, 1n);
  assert.ok(first.submittedAt > 0n);
  assert.equal(first.submittedAt, first.decidedAt);
  await (
    await contract.submitService(1, id("second"), "https://example.org/second")
  ).wait();
  assert.equal((await contract.getRecord(1)).digest, id("first"));
  assert.equal(contract.interface.getFunction("decideService"), null);
  assert.equal(contract.interface.getFunction("setMechanic"), null);
  assert.deepEqual(Array.from(await contract.serviceIds(1, 0, 1)), [1n]);
  assert.deepEqual(Array.from(await contract.serviceIds(1, 1, 1)), [2n]);
  assert.deepEqual(Array.from(await contract.serviceIds(1, 9, 1)), []);
  await assert.rejects(contract.serviceIds(1, 0, 101));
  await assert.rejects(contract.getRecord(99));
  await (
    await contract
      .connect(stranger)
      .registerMotor(id("other"), "https://example.org/other")
  ).wait();
  await assert.rejects(
    contract.submitService(2, id("x"), "https://example.org/x"),
  );
  await (
    await contract
      .connect(stranger)
      .submitService(2, id("own"), "https://example.org/own")
  ).wait();
  assert.deepEqual(
    Array.from(
      await contract.ownerMotorIds(await stranger.getAddress(), 0, 100),
    ),
    [2n],
  );
});
