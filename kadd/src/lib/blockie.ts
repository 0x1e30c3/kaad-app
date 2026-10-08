// Shared by the client avatar and server-rendered share images.
/**
 * Blockie identicon: the same algorithm as ethereum-blockies (what MetaMask and Etherscan show), so a wallet looks
 * the same here as in the user's wallet and on the explorer. Seeded by the lowercase address.
 */
export function blockie(address: string, size = 8) {
  const seed = [0, 0, 0, 0];
  const s = address.toLowerCase();
  for (let i = 0; i < s.length; i++) seed[i % 4] = ((seed[i % 4] << 5) - seed[i % 4] + s.charCodeAt(i)) | 0;
  const rand = () => {
    const t = seed[0] ^ (seed[0] << 11);
    seed[0] = seed[1];
    seed[1] = seed[2];
    seed[2] = seed[3];
    seed[3] = seed[3] ^ (seed[3] >> 19) ^ t ^ (t >> 8);
    return (seed[3] >>> 0) / ((1 << 31) >>> 0);
  };
  const color = () => {
    const h = Math.floor(rand() * 360);
    const sat = rand() * 60 + 40;
    const l = (rand() + rand() + rand() + rand()) * 25;
    return `hsl(${h} ${sat}% ${l}%)`;
  };
  const fg = color();
  const bg = color();
  const spot = color();
  const half = Math.ceil(size / 2);
  const cells: number[] = [];
  for (let y = 0; y < size; y++) {
    const row = Array.from({ length: half }, () => Math.floor(rand() * 2.3));
    cells.push(...row, ...row.slice(0, size - half).reverse());
  }
  return { fg, bg, spot, cells };
}
