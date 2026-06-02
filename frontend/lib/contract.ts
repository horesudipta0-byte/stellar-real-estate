/**
 * contract.ts — Typed wrappers for every smart contract function.
 *
 * Uses SorobanRpc.Server (not the deprecated Server class) for all RPC calls.
 * Read-only calls use simulateTransaction; write calls simulate first, then
 * assemble and submit via signAndSubmitTransaction.
 *
 * CRITICAL PITFALLS (from troubleshooting guide):
 * - assembleTransaction() takes exactly 2 args: (tx, simResponse) — NOT 3.
 *   Passing networkPassphrase as arg 2 silently breaks it.
 * - scValToNative() on booleans: always use strict === true check, because
 *   the ScVal object itself is truthy even when representing `false`.
 * - Contract error codes: parse "#N" from error messages to show friendly errors.
 */

import * as StellarSdk from "@stellar/stellar-sdk";
import { getNetworkConfig, signAndSubmitTransaction } from "./stellar";

const { rpc, TransactionBuilder, Networks, xdr, scValToNative, nativeToScVal, Address } = StellarSdk;

// ---------------------------------------------------------------------------
// Contract ID from environment variables
// ---------------------------------------------------------------------------
const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID || "";

// ---------------------------------------------------------------------------
// Soroban RPC Server instance (SorobanRpc.Server, NOT the old Server class)
// ---------------------------------------------------------------------------
function getServer(): StellarSdk.rpc.Server {
  const { rpcUrl } = getNetworkConfig();
  return new rpc.Server(rpcUrl, { allowHttp: false });
}

// ---------------------------------------------------------------------------
// Helper: build a Soroban contract call transaction
// ---------------------------------------------------------------------------
async function buildContractCallTx(
  sourcePublicKey: string,
  method: string,
  args: StellarSdk.xdr.ScVal[]
): Promise<StellarSdk.Transaction> {
  const { networkPassphrase } = getNetworkConfig();
  const server = getServer();

  // Fetch the source account from the network
  const sourceAccount = await server.getAccount(sourcePublicKey);

  // Build the contract invocation operation
  const contract = new StellarSdk.Contract(CONTRACT_ID);
  const operation = contract.call(method, ...args);

  // Build the transaction
  const tx = new TransactionBuilder(sourceAccount, {
    fee: "1000000", // 0.1 XLM max fee — generous for testnet
    networkPassphrase,
  })
    .addOperation(operation)
    .setTimeout(300) // 5-minute timeout
    .build();

  return tx;
}

// ---------------------------------------------------------------------------
// Helper: simulate a read-only contract call and return the native result
// ---------------------------------------------------------------------------
async function simulateReadOnly(
  sourcePublicKey: string,
  method: string,
  args: StellarSdk.xdr.ScVal[]
): Promise<unknown> {
  const server = getServer();
  const tx = await buildContractCallTx(sourcePublicKey, method, args);

  const simulated = await server.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(simulated)) {
    const errorMsg = simulated.error;
    throw new Error(`Simulation failed: ${errorMsg}`);
  }

  if (
    rpc.Api.isSimulationSuccess(simulated) &&
    simulated.result
  ) {
    return scValToNative(simulated.result.retval);
  }

  throw new Error("Simulation returned no result");
}

// ---------------------------------------------------------------------------
// Helper: simulate, assemble, sign and submit a write transaction
//
// CRITICAL: assembleTransaction takes exactly 2 args (tx, simResponse).
// Do NOT pass networkPassphrase as the second argument.
// ---------------------------------------------------------------------------
async function submitWriteTransaction(
  sourcePublicKey: string,
  method: string,
  args: StellarSdk.xdr.ScVal[]
): Promise<{ hash: string; status: string }> {
  const server = getServer();
  const tx = await buildContractCallTx(sourcePublicKey, method, args);

  // Simulate to get footprint and resource estimates
  const simulated = await server.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(simulated)) {
    const errorMsg = simulated.error;
    handleContractError(errorMsg);
    throw new Error(`Simulation failed: ${errorMsg}`);
  }

  // Assemble the transaction with simulation results
  // PITFALL: Only 2 arguments! (tx, simResponse) — NOT (tx, networkPassphrase, simResponse)
  const assembled = rpc.assembleTransaction(tx, simulated).build();

  // Convert to XDR for Freighter signing
  const txXdr = assembled.toXDR();

  // Sign with Freighter and submit
  return await signAndSubmitTransaction(txXdr);
}

// ---------------------------------------------------------------------------
// Error handler: map Soroban error codes to friendly messages
// ---------------------------------------------------------------------------
function handleContractError(errorMsg: string): void {
  const errorMap: Record<string, string> = {
    "#1": "Contract is not initialized. Please initialize the contract first.",
    "#2": "Contract is already initialized.",
    "#3": "Not authorized. Only the admin can perform this action.",
    "#4": "Insufficient token balance.",
    "#5": "No active listing found for this seller.",
    "#6": "Not enough tokens listed for the requested amount.",
    "#7": "Invalid amount. Amount must be greater than zero.",
    "#8": "You cannot buy your own tokens.",
    "#9": "Arithmetic overflow — values too large.",
  };

  for (const [code, message] of Object.entries(errorMap)) {
    if (errorMsg.includes(code)) {
      throw new Error(message);
    }
  }
}

// ============================================================================
// CONTRACT FUNCTION WRAPPERS
// ============================================================================

// ---------------------------------------------------------------------------
// initialize — write call: set up the property token contract
// ---------------------------------------------------------------------------
export async function initializeContract(
  adminPublicKey: string,
  totalSupply: number,
  propertyName: string,
  propertyValue: number, // in stroops
  propertyLocation: string
): Promise<{ hash: string; status: string }> {
  const args = [
    new Address(adminPublicKey).toScVal(),
    nativeToScVal(totalSupply, { type: "u64" }),
    nativeToScVal(propertyName, { type: "string" }),
    nativeToScVal(propertyValue, { type: "u64" }),
    nativeToScVal(propertyLocation, { type: "string" }),
  ];

  return await submitWriteTransaction(adminPublicKey, "initialize", args);
}

// ---------------------------------------------------------------------------
// getBalance — read-only: get token balance for an address
// ---------------------------------------------------------------------------
export async function getBalance(
  callerPublicKey: string,
  ownerPublicKey: string
): Promise<number> {
  const args = [new Address(ownerPublicKey).toScVal()];

  const result = await simulateReadOnly(callerPublicKey, "get_balance", args);
  return Number(result);
}

// ---------------------------------------------------------------------------
// getPropertyInfo — read-only: get property metadata
// ---------------------------------------------------------------------------
export interface PropertyInfo {
  name: string;
  location: string;
  value: number; // in stroops
  total_supply: number;
}

export async function getPropertyInfo(
  callerPublicKey: string
): Promise<PropertyInfo> {
  const result = await simulateReadOnly(callerPublicKey, "get_property_info", []);

  // The result comes back as a map/object from scValToNative
  const data = result as Record<string, unknown>;
  return {
    name: String(data.name || data["name"] || ""),
    location: String(data.location || data["location"] || ""),
    value: Number(data.value || data["value"] || 0),
    total_supply: Number(data.total_supply || data["total_supply"] || 0),
  };
}

// ---------------------------------------------------------------------------
// getTotalSupply — read-only: returns total token supply
// ---------------------------------------------------------------------------
export async function getTotalSupply(callerPublicKey: string): Promise<number> {
  const result = await simulateReadOnly(callerPublicKey, "get_total_supply", []);
  return Number(result);
}

// ---------------------------------------------------------------------------
// getAdmin — read-only: returns the admin address
// ---------------------------------------------------------------------------
export async function getAdmin(callerPublicKey: string): Promise<string> {
  const result = await simulateReadOnly(callerPublicKey, "get_admin", []);
  return String(result);
}

// ---------------------------------------------------------------------------
// listForSale — write call: list tokens for sale at a given price
// ---------------------------------------------------------------------------
export async function listForSale(
  sellerPublicKey: string,
  amount: number,
  pricePerToken: number // in stroops (1 XLM = 10,000,000)
): Promise<{ hash: string; status: string }> {
  const args = [
    new Address(sellerPublicKey).toScVal(),
    nativeToScVal(amount, { type: "u64" }),
    nativeToScVal(pricePerToken, { type: "u64" }),
  ];

  return await submitWriteTransaction(sellerPublicKey, "list_for_sale", args);
}

// ---------------------------------------------------------------------------
// cancelListing — write call: remove an active listing
// ---------------------------------------------------------------------------
export async function cancelListing(
  sellerPublicKey: string
): Promise<{ hash: string; status: string }> {
  const args = [new Address(sellerPublicKey).toScVal()];

  return await submitWriteTransaction(sellerPublicKey, "cancel_listing", args);
}

// ---------------------------------------------------------------------------
// getListing — read-only: get a seller's active listing
// ---------------------------------------------------------------------------
export interface SaleListing {
  seller: string;
  amount: number;
  price_per_token: number; // in stroops
}

export async function getListing(
  callerPublicKey: string,
  sellerPublicKey: string
): Promise<SaleListing | null> {
  try {
    const args = [new Address(sellerPublicKey).toScVal()];
    const result = await simulateReadOnly(callerPublicKey, "get_listing", args);

    const data = result as Record<string, unknown>;
    return {
      seller: String(data.seller || ""),
      amount: Number(data.amount || 0),
      price_per_token: Number(data.price_per_token || 0),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    // Error #5 = NoActiveListing — not an error, just means no listing
    if (message.includes("#5")) {
      return null;
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// buyTokens — write call: buy tokens from a seller's listing
// ---------------------------------------------------------------------------
export async function buyTokens(
  buyerPublicKey: string,
  sellerPublicKey: string,
  amount: number
): Promise<{ hash: string; status: string }> {
  const args = [
    new Address(buyerPublicKey).toScVal(),
    new Address(sellerPublicKey).toScVal(),
    nativeToScVal(amount, { type: "u64" }),
  ];

  return await submitWriteTransaction(buyerPublicKey, "buy_tokens", args);
}

// ---------------------------------------------------------------------------
// transfer — write call: transfer tokens directly (no sale)
// ---------------------------------------------------------------------------
export async function transferTokens(
  fromPublicKey: string,
  toPublicKey: string,
  amount: number
): Promise<{ hash: string; status: string }> {
  const args = [
    new Address(fromPublicKey).toScVal(),
    new Address(toPublicKey).toScVal(),
    nativeToScVal(amount, { type: "u64" }),
  ];

  return await submitWriteTransaction(fromPublicKey, "transfer", args);
}
