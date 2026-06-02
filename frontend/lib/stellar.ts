/**
 * stellar.ts — Stellar network helpers for Freighter wallet integration.
 *
 * This module handles wallet connection, transaction signing, and Friendbot funding.
 * All endpoints target Stellar Testnet exclusively.
 *
 * IMPORTANT PITFALL NOTES (from troubleshooting guide):
 * - isConnected() returns { isConnected: boolean }, NOT a raw boolean
 * - signTransaction() returns { signedTxXdr, signerAddress }; do NOT parse it
 *   with TransactionBuilder.fromXDR (causes "Bad union switch" errors).
 *   Instead submit the raw base64 directly via fetch.
 * - assembleTransaction() takes exactly 2 args (tx, simResult), NOT 3
 * - getAddress() returns { address: string }, NOT getPublicKey / publicKey
 * - requestAccess() returns { address: string }
 */

import {
  isConnected as freighterIsConnected,
  requestAccess,
  getAddress as freighterGetAddress,
  signTransaction,
} from "@stellar/freighter-api";

// ---------------------------------------------------------------------------
// Network configuration — Stellar Testnet only
// ---------------------------------------------------------------------------
export function getNetworkConfig() {
  return {
    rpcUrl:
      process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org",
    networkPassphrase:
      process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ||
      "Test SDF Network ; September 2015",
    horizonUrl:
      process.env.NEXT_PUBLIC_HORIZON_URL ||
      "https://horizon-testnet.stellar.org",
  };
}

// ---------------------------------------------------------------------------
// getFreighterPublicKey — connect to Freighter and return the user's public key
//
// Pitfall: isConnected() returns an object { isConnected: boolean }, not a
// primitive boolean. A bare `if (await isConnected())` is ALWAYS truthy.
//
// Pitfall: The function is getAddress() (not getPublicKey), and it returns
// { address: string }, not { publicKey: string }.
// ---------------------------------------------------------------------------
export async function getFreighterPublicKey(): Promise<string | null> {
  try {
    // Check if Freighter extension is installed and connected
    const connectionResult = await freighterIsConnected();
    if (!connectionResult.isConnected) {
      // Try requesting access — Freighter may need user approval
      const accessResult = await requestAccess();
      if (accessResult.error) {
        throw new Error(
          "Freighter wallet is not installed or access was denied. Please install it from https://freighter.app"
        );
      }
      // requestAccess returns the address directly on success
      if (accessResult.address) {
        return accessResult.address;
      }
    }

    // Get the address from Freighter
    const addressResult = await freighterGetAddress();
    if (addressResult.error) {
      throw new Error(String(addressResult.error));
    }
    return addressResult.address || null;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to connect to Freighter";
    throw new Error(message);
  }
}

// ---------------------------------------------------------------------------
// signAndSubmitTransaction — sign an XDR transaction with Freighter and
// submit it to the Soroban RPC endpoint.
//
// CRITICAL PITFALL: Do NOT use TransactionBuilder.fromXDR() on the signed
// XDR returned by Freighter. It causes "Bad union switch" errors due to
// protocol version mismatches between the SDK and the extension.
// Instead, we send the raw base64 XDR directly via fetch to the JSON-RPC
// endpoint's sendTransaction method.
// ---------------------------------------------------------------------------
export async function signAndSubmitTransaction(
  xdr: string
): Promise<{ hash: string; status: string }> {
  const { networkPassphrase, rpcUrl } = getNetworkConfig();

  // Step 1: Sign the transaction with Freighter
  // signTransaction returns { signedTxXdr: string, signerAddress: string, error? }
  const signedResult = await signTransaction(xdr, {
    networkPassphrase,
  });

  if (signedResult.error) {
    throw new Error(`Freighter signing failed: ${signedResult.error}`);
  }

  const signedTxXdr = signedResult.signedTxXdr;

  // Step 2: Submit the raw signed XDR directly via JSON-RPC fetch
  // (Avoids "Bad union switch" errors from parsing the XDR)
  const sendResponse = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "sendTransaction",
      params: { transaction: signedTxXdr },
    }),
  });

  const sendResult = await sendResponse.json();

  if (sendResult.error) {
    throw new Error(
      `Transaction submission failed: ${JSON.stringify(sendResult.error)}`
    );
  }

  const txHash = sendResult.result?.hash;
  const txStatus = sendResult.result?.status;

  if (txStatus === "ERROR") {
    throw new Error(
      `Transaction failed on submission: ${JSON.stringify(sendResult.result)}`
    );
  }

  // Step 3: Poll for confirmation if status is PENDING
  if (txStatus === "PENDING") {
    const confirmedResult = await pollTransactionStatus(txHash, rpcUrl);
    return confirmedResult;
  }

  return { hash: txHash, status: txStatus };
}

// ---------------------------------------------------------------------------
// pollTransactionStatus — poll Soroban RPC until the tx is confirmed or failed
// ---------------------------------------------------------------------------
async function pollTransactionStatus(
  hash: string,
  rpcUrl: string,
  maxAttempts = 30,
  intervalMs = 2000
): Promise<{ hash: string; status: string }> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));

    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: { hash },
      }),
    });

    const result = await response.json();
    const status = result.result?.status;

    if (status === "SUCCESS") {
      return { hash, status: "SUCCESS" };
    }

    if (status === "FAILED") {
      throw new Error(
        `Transaction failed: ${JSON.stringify(result.result)}`
      );
    }

    // status is NOT_FOUND or still processing — continue polling
  }

  throw new Error(
    `Transaction ${hash} did not confirm after ${maxAttempts} attempts`
  );
}

// ---------------------------------------------------------------------------
// fundWithFriendbot — fund a Testnet account with free XLM via Friendbot
// ---------------------------------------------------------------------------
export async function fundWithFriendbot(publicKey: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://friendbot.stellar.org/?addr=${encodeURIComponent(publicKey)}`
    );

    if (!response.ok) {
      const text = await response.text();
      // Friendbot returns an error if the account is already funded
      if (text.includes("createAccountAlreadyExist")) {
        // Account already exists — not an error
        return true;
      }
      throw new Error(`Friendbot request failed: ${text}`);
    }

    return true;
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fund account via Friendbot";
    throw new Error(message);
  }
}
