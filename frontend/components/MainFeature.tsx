/**
 * MainFeature.tsx — Primary dApp interface for the Real Estate Fractional Ownership Token.
 *
 * Displays:
 *   - Property details card (name, location, valuation, total supply)
 *   - User ownership percentage and token balance
 *   - Initialize contract form (admin only, one-time)
 *   - List tokens for sale form
 *   - Buy tokens form (enter seller address + amount)
 *   - Cancel listing button
 *   - Transfer tokens form
 *   - Active listing display
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  initializeContract,
  getBalance,
  getPropertyInfo,
  getTotalSupply,
  listForSale,
  cancelListing,
  getListing,
  buyTokens,
  transferTokens,
  type PropertyInfo,
  type SaleListing,
} from "@/lib/contract";

interface MainFeatureProps {
  publicKey: string;
}

export default function MainFeature({ publicKey }: MainFeatureProps) {
  // ---- State ----
  const [propertyInfo, setPropertyInfo] = useState<PropertyInfo | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [totalSupply, setTotalSupply] = useState<number>(0);
  const [myListing, setMyListing] = useState<SaleListing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // ---- Form state ----
  // Initialize
  const [initName, setInitName] = useState("Sunset Villa #42");
  const [initLocation, setInitLocation] = useState("123 Blockchain Ave, Crypto City");
  const [initSupply, setInitSupply] = useState("1000");
  const [initValue, setInitValue] = useState("500000"); // in XLM

  // List for sale
  const [listAmount, setListAmount] = useState("");
  const [listPrice, setListPrice] = useState(""); // price per token in XLM

  // Buy tokens
  const [buySellerAddress, setBuySellerAddress] = useState("");
  const [buyAmount, setBuyAmount] = useState("");

  // Transfer
  const [transferTo, setTransferTo] = useState("");
  const [transferAmount, setTransferAmount] = useState("");

  // Lookup listing
  const [lookupAddress, setLookupAddress] = useState("");
  const [lookupResult, setLookupResult] = useState<SaleListing | null>(null);

  // ---- Helper: convert XLM to stroops ----
  const xlmToStroops = (xlm: number): number => Math.floor(xlm * 10_000_000);

  // ---- Helper: convert stroops to XLM ----
  const stroopsToXlm = (stroops: number): string => {
    return (stroops / 10_000_000).toFixed(7);
  };

  // ---- Helper: show a message that auto-dismisses ----
  const showMessage = (type: "success" | "error" | "info", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 8000);
  };

  // ---- Load contract data ----
  const loadContractData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Try to load property info (will fail if not initialized)
      const info = await getPropertyInfo(publicKey);
      setPropertyInfo(info);
      setTotalSupply(info.total_supply);

      // Load user's balance
      const bal = await getBalance(publicKey, publicKey);
      setBalance(bal);

      // Try to load user's listing
      const listing = await getListing(publicKey, publicKey);
      setMyListing(listing);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "";
      // Error #1 = NotInitialized — contract needs to be initialized
      if (errMsg.includes("#1")) {
        setPropertyInfo(null);
      } else {
        console.error("Error loading contract data:", errMsg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    if (publicKey) {
      loadContractData();
    }
  }, [publicKey, loadContractData]);

  // ---- Action: Initialize Contract ----
  const handleInitialize = async () => {
    setActionLoading("initialize");
    try {
      const supply = parseInt(initSupply, 10);
      const value = xlmToStroops(parseFloat(initValue));

      if (isNaN(supply) || supply <= 0) {
        throw new Error("Supply must be a positive number");
      }
      if (isNaN(value) || value <= 0) {
        throw new Error("Property value must be a positive number");
      }

      await initializeContract(publicKey, supply, initName, value, initLocation);
      showMessage("success", "🎉 Contract initialized successfully! You are now the admin.");
      await loadContractData();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Initialization failed";
      if (errMsg.includes("#2") || errMsg.includes("already initialized")) {
        showMessage("info", "✅ Contract is already initialized. You can proceed.");
        await loadContractData();
      } else {
        showMessage("error", errMsg);
      }
    } finally {
      setActionLoading(null);
    }
  };

  // ---- Action: List Tokens for Sale ----
  const handleListForSale = async () => {
    setActionLoading("list");
    try {
      const amount = parseInt(listAmount, 10);
      const priceXlm = parseFloat(listPrice);

      if (isNaN(amount) || amount <= 0) {
        throw new Error("Amount must be a positive integer");
      }
      if (isNaN(priceXlm) || priceXlm <= 0) {
        throw new Error("Price must be a positive number");
      }

      const priceStroops = xlmToStroops(priceXlm);
      await listForSale(publicKey, amount, priceStroops);
      showMessage("success", `✅ Listed ${amount} tokens for sale at ${priceXlm} XLM each`);
      setListAmount("");
      setListPrice("");
      await loadContractData();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Listing failed";
      showMessage("error", errMsg);
    } finally {
      setActionLoading(null);
    }
  };

  // ---- Action: Cancel Listing ----
  const handleCancelListing = async () => {
    setActionLoading("cancel");
    try {
      await cancelListing(publicKey);
      showMessage("success", "✅ Listing cancelled successfully");
      await loadContractData();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Cancel failed";
      showMessage("error", errMsg);
    } finally {
      setActionLoading(null);
    }
  };

  // ---- Action: Buy Tokens ----
  const handleBuyTokens = async () => {
    setActionLoading("buy");
    try {
      const amount = parseInt(buyAmount, 10);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Amount must be a positive integer");
      }
      if (!buySellerAddress || buySellerAddress.length < 56) {
        throw new Error("Please enter a valid Stellar public key for the seller");
      }

      await buyTokens(publicKey, buySellerAddress, amount);
      showMessage("success", `✅ Successfully purchased ${amount} tokens!`);
      setBuyAmount("");
      setBuySellerAddress("");
      await loadContractData();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Purchase failed";
      showMessage("error", errMsg);
    } finally {
      setActionLoading(null);
    }
  };

  // ---- Action: Transfer Tokens ----
  const handleTransfer = async () => {
    setActionLoading("transfer");
    try {
      const amount = parseInt(transferAmount, 10);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Amount must be a positive integer");
      }
      if (!transferTo || transferTo.length < 56) {
        throw new Error("Please enter a valid Stellar public key for the recipient");
      }

      await transferTokens(publicKey, transferTo, amount);
      showMessage("success", `✅ Transferred ${amount} tokens successfully!`);
      setTransferAmount("");
      setTransferTo("");
      await loadContractData();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Transfer failed";
      showMessage("error", errMsg);
    } finally {
      setActionLoading(null);
    }
  };

  // ---- Action: Lookup Listing ----
  const handleLookupListing = async () => {
    setActionLoading("lookup");
    try {
      if (!lookupAddress || lookupAddress.length < 56) {
        throw new Error("Please enter a valid Stellar public key");
      }

      const listing = await getListing(publicKey, lookupAddress);
      setLookupResult(listing);
      if (!listing) {
        showMessage("info", "No active listing found for this address.");
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Lookup failed";
      showMessage("error", errMsg);
    } finally {
      setActionLoading(null);
    }
  };

  // ---- Ownership percentage ----
  const ownershipPercent =
    totalSupply > 0 ? ((balance / totalSupply) * 100).toFixed(2) : "0.00";

  // ---- Loading state ----
  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner-large" />
        <p className="loading-text">Loading contract data...</p>
      </div>
    );
  }

  // ---- Not initialized: show initialize form ----
  if (!propertyInfo) {
    return (
      <div className="main-feature">
        <div className="card initialize-card">
          <div className="card-header">
            <h2>🏗️ Initialize Property Token</h2>
            <p className="card-description">
              This contract hasn&apos;t been initialized yet. Set up the property
              details and mint the initial token supply.
            </p>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Property Name</label>
              <input
                type="text"
                value={initName}
                onChange={(e) => setInitName(e.target.value)}
                placeholder="e.g. Sunset Villa #42"
              />
            </div>

            <div className="form-group">
              <label>Property Location</label>
              <input
                type="text"
                value={initLocation}
                onChange={(e) => setInitLocation(e.target.value)}
                placeholder="e.g. 123 Blockchain Ave"
              />
            </div>

            <div className="form-group">
              <label>Total Token Supply</label>
              <input
                type="number"
                value={initSupply}
                onChange={(e) => setInitSupply(e.target.value)}
                placeholder="e.g. 1000"
                min="1"
              />
            </div>

            <div className="form-group">
              <label>Property Valuation (XLM)</label>
              <input
                type="number"
                value={initValue}
                onChange={(e) => setInitValue(e.target.value)}
                placeholder="e.g. 500000"
                min="1"
              />
            </div>
          </div>

          <button
            onClick={handleInitialize}
            disabled={actionLoading === "initialize"}
            className="btn btn-primary btn-full"
          >
            {actionLoading === "initialize" ? (
              <>
                <span className="spinner" /> Initializing...
              </>
            ) : (
              "🚀 Initialize Contract"
            )}
          </button>
        </div>

        {/* Global message */}
        {message && (
          <div className={`message-banner ${message.type}`}>
            <span>{message.text}</span>
          </div>
        )}
      </div>
    );
  }

  // ---- Main interface: property is initialized ----
  return (
    <div className="main-feature">
      {/* Global message banner */}
      {message && (
        <div className={`message-banner ${message.type}`}>
          <span>{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            className="message-dismiss"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Property Details Card */}
      <div className="card property-card">
        <div className="card-header">
          <h2>🏠 {propertyInfo.name}</h2>
          <span className="badge badge-active">Tokenized</span>
        </div>
        <div className="property-details">
          <div className="detail-row">
            <span className="detail-label">📍 Location</span>
            <span className="detail-value">{propertyInfo.location}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">💰 Valuation</span>
            <span className="detail-value highlight">
              {stroopsToXlm(propertyInfo.value)} XLM
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">🪙 Total Supply</span>
            <span className="detail-value">{propertyInfo.total_supply.toLocaleString()} tokens</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">📊 Token Value</span>
            <span className="detail-value">
              {totalSupply > 0
                ? stroopsToXlm(Math.floor(propertyInfo.value / totalSupply))
                : "0"}{" "}
              XLM / token
            </span>
          </div>
        </div>
      </div>

      {/* Ownership Card */}
      <div className="card ownership-card">
        <div className="card-header">
          <h2>👤 Your Ownership</h2>
        </div>
        <div className="ownership-display">
          <div className="ownership-stat">
            <span className="stat-value">{balance.toLocaleString()}</span>
            <span className="stat-label">Tokens Held</span>
          </div>
          <div className="ownership-stat">
            <span className="stat-value">{ownershipPercent}%</span>
            <span className="stat-label">Ownership</span>
          </div>
          <div className="ownership-stat">
            <span className="stat-value">
              {totalSupply > 0
                ? stroopsToXlm(Math.floor((propertyInfo.value * balance) / totalSupply))
                : "0"}
            </span>
            <span className="stat-label">Value (XLM)</span>
          </div>
        </div>
        {/* Ownership progress bar */}
        <div className="progress-bar-container">
          <div
            className="progress-bar-fill"
            style={{ width: `${Math.min(parseFloat(ownershipPercent), 100)}%` }}
          />
        </div>
      </div>

      {/* Active Listing Card */}
      {myListing && (
        <div className="card listing-card">
          <div className="card-header">
            <h2>📋 Your Active Listing</h2>
            <span className="badge badge-listing">For Sale</span>
          </div>
          <div className="property-details">
            <div className="detail-row">
              <span className="detail-label">Amount</span>
              <span className="detail-value">{myListing.amount} tokens</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Price per Token</span>
              <span className="detail-value highlight">
                {stroopsToXlm(myListing.price_per_token)} XLM
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Total Ask</span>
              <span className="detail-value">
                {stroopsToXlm(myListing.amount * myListing.price_per_token)} XLM
              </span>
            </div>
          </div>
          <button
            onClick={handleCancelListing}
            disabled={actionLoading === "cancel"}
            className="btn btn-danger btn-full"
          >
            {actionLoading === "cancel" ? (
              <>
                <span className="spinner" /> Cancelling...
              </>
            ) : (
              "❌ Cancel Listing"
            )}
          </button>
        </div>
      )}

      {/* Action Cards Grid */}
      <div className="actions-grid">
        {/* List for Sale */}
        <div className="card action-card">
          <div className="card-header">
            <h3>💵 List Tokens for Sale</h3>
          </div>
          <div className="form-group">
            <label>Number of Tokens</label>
            <input
              type="number"
              value={listAmount}
              onChange={(e) => setListAmount(e.target.value)}
              placeholder="e.g. 100"
              min="1"
              max={balance}
            />
          </div>
          <div className="form-group">
            <label>Price per Token (XLM)</label>
            <input
              type="number"
              value={listPrice}
              onChange={(e) => setListPrice(e.target.value)}
              placeholder="e.g. 1.5"
              min="0.0000001"
              step="0.0000001"
            />
          </div>
          {listAmount && listPrice && (
            <p className="form-hint">
              Total: {(parseInt(listAmount) * parseFloat(listPrice)).toFixed(7)} XLM
            </p>
          )}
          <button
            onClick={handleListForSale}
            disabled={actionLoading === "list" || !listAmount || !listPrice}
            className="btn btn-primary btn-full"
          >
            {actionLoading === "list" ? (
              <>
                <span className="spinner" /> Listing...
              </>
            ) : (
              "📝 List for Sale"
            )}
          </button>
        </div>

        {/* Buy Tokens */}
        <div className="card action-card">
          <div className="card-header">
            <h3>🛒 Buy Tokens</h3>
          </div>
          <div className="form-group">
            <label>Seller Address</label>
            <input
              type="text"
              value={buySellerAddress}
              onChange={(e) => setBuySellerAddress(e.target.value)}
              placeholder="G..."
              className="address-input"
            />
          </div>
          <div className="form-group">
            <label>Number of Tokens</label>
            <input
              type="number"
              value={buyAmount}
              onChange={(e) => setBuyAmount(e.target.value)}
              placeholder="e.g. 50"
              min="1"
            />
          </div>
          <button
            onClick={handleBuyTokens}
            disabled={actionLoading === "buy" || !buySellerAddress || !buyAmount}
            className="btn btn-primary btn-full"
          >
            {actionLoading === "buy" ? (
              <>
                <span className="spinner" /> Purchasing...
              </>
            ) : (
              "🛒 Buy Tokens"
            )}
          </button>
        </div>

        {/* Transfer Tokens */}
        <div className="card action-card">
          <div className="card-header">
            <h3>📤 Transfer Tokens</h3>
          </div>
          <div className="form-group">
            <label>Recipient Address</label>
            <input
              type="text"
              value={transferTo}
              onChange={(e) => setTransferTo(e.target.value)}
              placeholder="G..."
              className="address-input"
            />
          </div>
          <div className="form-group">
            <label>Number of Tokens</label>
            <input
              type="number"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              placeholder="e.g. 25"
              min="1"
              max={balance}
            />
          </div>
          <button
            onClick={handleTransfer}
            disabled={actionLoading === "transfer" || !transferTo || !transferAmount}
            className="btn btn-primary btn-full"
          >
            {actionLoading === "transfer" ? (
              <>
                <span className="spinner" /> Transferring...
              </>
            ) : (
              "📤 Transfer Tokens"
            )}
          </button>
        </div>

        {/* Lookup Listing */}
        <div className="card action-card">
          <div className="card-header">
            <h3>🔍 Lookup Seller Listing</h3>
          </div>
          <div className="form-group">
            <label>Seller Address</label>
            <input
              type="text"
              value={lookupAddress}
              onChange={(e) => setLookupAddress(e.target.value)}
              placeholder="G..."
              className="address-input"
            />
          </div>
          <button
            onClick={handleLookupListing}
            disabled={actionLoading === "lookup" || !lookupAddress}
            className="btn btn-secondary btn-full"
          >
            {actionLoading === "lookup" ? (
              <>
                <span className="spinner" /> Looking up...
              </>
            ) : (
              "🔍 Lookup"
            )}
          </button>
          {lookupResult && (
            <div className="lookup-result">
              <p><strong>Amount:</strong> {lookupResult.amount} tokens</p>
              <p><strong>Price:</strong> {stroopsToXlm(lookupResult.price_per_token)} XLM/token</p>
              <p><strong>Total:</strong> {stroopsToXlm(lookupResult.amount * lookupResult.price_per_token)} XLM</p>
            </div>
          )}
        </div>
      </div>

      {/* Refresh button */}
      <div className="refresh-section">
        <button
          onClick={loadContractData}
          disabled={isLoading}
          className="btn btn-outline"
        >
          🔄 Refresh Data
        </button>
      </div>
    </div>
  );
}
