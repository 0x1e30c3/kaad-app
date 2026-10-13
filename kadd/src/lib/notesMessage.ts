import { keccak256, toHex } from "viem";

/** The exact text an account signs to replace its private-notes vault: binds the address, the time and the vault bytes. */
export const notesMessage = (address: string, at: number, vault: string) =>
  `Kadd private notes v1\naccount: ${address.toLowerCase()}\nat: ${at}\nvault: ${keccak256(toHex(vault))}`;
