// End-to-end check of /api/notes: valid save, read back + decrypt, replay of an older version, forged signature, wrong
// account, stale timestamp, malformed vault. Needs the dev server pointed at a Redis; this script brings its own:
//   KV_REST_API_URL=http://127.0.0.1:8790 KV_REST_API_TOKEN=test npm run dev -- -p 3123
//   npx tsx scripts/notes-e2e.mts
import http from "node:http";
import assert from "node:assert/strict";
import { createSecretVault, decryptSecretVault } from "../node_modules/@category-labs/mera/dist/secret.js"; // internal helpers: a vault without a real passkey
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { notesMessage } from "../src/lib/notesMessage.ts";

const BASE = process.env.BASE ?? "http://localhost:3123/api/notes";

// Stand-in for Upstash's REST API: GET / SET only.
const db = new Map<string, string>();
const kv = http.createServer((req, res) => {
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => {
    const [cmd, key, val] = JSON.parse(b);
    const result = cmd === "GET" ? (db.get(key) ?? null) : cmd === "SET" ? (db.set(key, val), "OK") : null;
    res.end(JSON.stringify({ result }));
  });
});
await new Promise<void>((ok) => kv.listen(8790, ok));
const me = privateKeyToAccount(generatePrivateKey());
const other = privateKeyToAccount(generatePrivateKey());
const prfOutput = crypto.getRandomValues(new Uint8Array(32));
const prfSalt = crypto.getRandomValues(new Uint8Array(32));
const credential = { credentialId: "AAAAAAAAAAAAAAAAAAAAAA", prfSalt, prfOutput } as unknown as Parameters<typeof createSecretVault>[0]["credential"];
const notes = { "0xfba31dfa3c6612abca9a27f65af77d9fed7e2db7": { text: "top perps trader, 3x max", at: 1 } };
const vault = JSON.stringify(await createSecretVault({ credential, secret: new TextEncoder().encode(JSON.stringify({ v: 1, notes })) }));

const post = async (signer: typeof me, at: number, v = vault, address = me.address) =>
  fetch(BASE, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address, at, vault: v, signature: await signer.signMessage({ message: notesMessage(address, at, v) }) }) });

const t = Date.now();
assert.equal((await post(me, t)).status, 200, "valid save");
const got = await (await fetch(`${BASE}?address=${me.address}`)).json();
assert.equal(got.ready, true);
assert.equal(got.vault, vault, "server returns the exact ciphertext");
assert.ok(!got.vault.includes("perps trader"), "no plaintext on the server");
const plain = JSON.parse(new TextDecoder().decode(await decryptSecretVault({ vault: JSON.parse(got.vault), prfOutput })));
assert.deepEqual(plain.notes, notes, "decrypts back with the same PRF output");
await assert.rejects(decryptSecretVault({ vault: JSON.parse(got.vault), prfOutput: crypto.getRandomValues(new Uint8Array(32)) }), "another key can't decrypt");
assert.equal((await post(me, t - 1000)).status, 409, "older version can't replace a newer one");
assert.equal((await post(other, t + 1000)).status, 401, "someone else's signature is rejected");
assert.equal((await post(me, t - 10 * 60_000)).status, 400, "stale timestamp is rejected");
assert.equal((await post(me, t + 2000, vault.replace("ciphertext", "cipher"))).status, 400, "malformed vault is rejected");
console.log("notes e2e: all checks passed");
kv.close();
