// Fetches real Kuru Flow routes for the KaddCopyKuru mainnet fork test (quoted with the vault as `userAddress`; the
// router pays msg.sender, so the vault's balance check is what binds the output to it).
//   eval "$(node script/kuru-quotes.mjs)" && forge test --match-contract KaddCopyKuruFork --fork-url https://rpc.monad.xyz
const API = "https://ws.kuru.io";
const VAULT = "0x00000000000000000000000000000000004adD01"; // where the test deploys the vault
const TOKEN = process.env.TOKEN || "0x350035555e10d9afaf1566aaebfced5ba6c27777"; // CHOG
const MON = "0x0000000000000000000000000000000000000000";
const AMOUNT = 10n ** 18n / 2n; // 0.5 MON per copied buy

const { token } = await (await fetch(`${API}/api/generate-token`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ user_address: VAULT }) })).json();
const quote = async (tokenIn, tokenOut, amount) => {
  const r = await fetch(`${API}/api/quote`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ userAddress: VAULT, tokenIn, tokenOut, amount: String(amount), slippageTolerance: 300 }),
  });
  const j = await r.json();
  if (j.status !== "success") throw new Error(`quote failed: ${JSON.stringify(j).slice(0, 200)}`);
  return j;
};
const buy = await quote(MON, TOKEN, AMOUNT);
await new Promise((r) => setTimeout(r, 1100)); // Kuru Flow: 1 request/second
const sell = await quote(TOKEN, MON, BigInt(buy.minOut)); // sell what the buy guarantees
const hex = (s) => `0x${s.replace(/^0x/, "")}`;
console.log(`export KURU_ROUTER=${buy.transaction.to} KURU_TOKEN=${TOKEN} KURU_BUY_AMOUNT=${AMOUNT} KURU_BUY_VALUE=${buy.transaction.value || 0}`);
console.log(`export KURU_BUY_MINOUT=${buy.minOut} KURU_BUY_DATA=${hex(buy.transaction.calldata)}`);
console.log(`export KURU_SELL_ROUTER=${sell.transaction.to} KURU_SELL_AMOUNT=${buy.minOut} KURU_SELL_MINOUT=${sell.minOut} KURU_SELL_DATA=${hex(sell.transaction.calldata)}`);
