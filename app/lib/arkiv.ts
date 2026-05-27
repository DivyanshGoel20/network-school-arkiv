import {
  createWalletClient,
  createPublicClient,
  http,
} from "@arkiv-network/sdk";
import { privateKeyToAccount } from "@arkiv-network/sdk/accounts";
import { braga } from "@arkiv-network/sdk/chains";
import { ExpirationTime, jsonToPayload } from "@arkiv-network/sdk/utils";
import { eq } from "@arkiv-network/sdk/query";

/**
 * Unique project attribute required by Arkiv to identify our app's data.
 */
export const PROJECT_ATTRIBUTE = {
  key: "project",
  value: process.env.NEXT_PUBLIC_PROJECT_ID || "arkiv-casebook-mystery-2026",
} as const;

// Braga testnet resources
export const BRAGA_CONFIG = {
  chainId: 60138453102,
  rpcUrl: "https://braga.hoodi.arkiv.network/rpc",
  faucetUrl: "https://braga.hoodi.arkiv.network/faucet/",
  explorerUrl: "https://explorer.braga.hoodi.arkiv.network/",
};

// Default Anvil developer private key (fallback only)
export const DEFAULT_DEMO_PRIVATE_KEY = process.env.NEXT_PUBLIC_DEFAULT_PRIVATE_KEY || "";

/**
 * Gets or dynamically generates a completely fresh, unique private key for the user.
 * Persists the key in localStorage so they retain their funded address across page reloads.
 * This completely bypasses testnet faucet blacklisting of public dev keys.
 */
export function getOrGeneratePrivateKey(): string {
  const defaultKey = DEFAULT_DEMO_PRIVATE_KEY || "";
  const isCustomEnvKey = defaultKey && defaultKey !== "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  
  if (isCustomEnvKey) {
    return defaultKey;
  }

  if (typeof window === "undefined") {
    return defaultKey;
  }
  
  let key = localStorage.getItem("arkiv_cluedo_priv_key");
  if (!key) {
    try {
      const bytes = new Uint8Array(32);
      if (window.crypto) {
        window.crypto.getRandomValues(bytes);
      } else {
        for (let i = 0; i < 32; i++) bytes[i] = Math.floor(Math.random() * 256);
      }
      key = "0x" + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem("arkiv_cluedo_priv_key", key);
    } catch (e) {
      console.warn("Failed to generate secure random key, falling back to default key:", e);
      key = defaultKey;
    }
  }
  
  return key;
}

/**
 * Safely derives the Ethereum address from any private key using the Arkiv accounts SDK.
 */
export function getAddressFromPrivateKey(privateKey: string): string {
  try {
    const formattedKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
    const account = privateKeyToAccount(formattedKey as `0x${string}`);
    return account.address;
  } catch (error) {
    console.error("Failed to derive address from private key:", error);
    return "0x0000000000000000000000000000000000000000";
  }
}

// Public client is safe for server/client use and handles queries
export const publicClient = createPublicClient({
  chain: braga,
  transport: http(BRAGA_CONFIG.rpcUrl),
});

/**
 * Creates a wallet client for write operations using a private key.
 */
export function getWalletClient(privateKey: string) {
  const formattedKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  return createWalletClient({
    chain: braga,
    transport: http(BRAGA_CONFIG.rpcUrl),
    account: privateKeyToAccount(formattedKey as `0x${string}`),
  });
}

/**
 * Executes a write operation to the Arkiv Braga testnet.
 * Encapsulates status tracking for the transaction ledger.
 */
export async function safeArkivWrite<T>(
  writeFn: () => Promise<T>,
  onTxLogged: (tx: { status: "pending" | "success" | "error"; txHash?: string; error?: string }) => void
): Promise<T> {
  onTxLogged({ status: "pending" });
  try {
    const result = await writeFn();
    
    // Extract transaction hash if it exists
    let txHash: string | undefined;
    if (result && typeof result === "object") {
      if ("txHash" in result) txHash = (result as any).txHash;
      else if ("hash" in result) txHash = (result as any).hash;
    }
    
    onTxLogged({ status: "success", txHash });
    return result;
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    console.warn(`Arkiv Braga transaction sync: ${errorMessage.includes("insufficient funds") ? "Insufficient gas (Braga Faucet required)" : errorMessage}`);
    onTxLogged({ status: "error", error: errorMessage });
    throw error; // Rethrow to let the caller know
  }
}
