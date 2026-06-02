/**
 * WalletConnect.tsx — Freighter wallet connection component.
 *
 * Features:
 *   - Connect / disconnect Freighter wallet
 *   - Show truncated public key (first 4 + ... + last 4 chars)
 *   - "Get Testnet XLM" button that calls Friendbot
 *   - Loading and error states
 */

"use client";

import React, { useState, useCallback } from "react";
import { getFreighterPublicKey, fundWithFriendbot } from "@/lib/stellar";

interface WalletConnectProps {
  publicKey: string | null;
  onConnect: (key: string) => void;
  onDisconnect: () => void;
}

export default function WalletConnect({
  publicKey,
  onConnect,
  onDisconnect,
}: WalletConnectProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fundingMessage, setFundingMessage] = useState<string | null>(null);

  // Truncate a Stellar public key for display: GABC...WXYZ
  const truncateKey = (key: string): string => {
    if (key.length <= 12) return key;
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  };

  // Handle wallet connection
  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    setFundingMessage(null);

    try {
      const key = await getFreighterPublicKey();
      if (key) {
        onConnect(key);
      } else {
        setError("Could not retrieve public key from Freighter.");
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to connect wallet";
      setError(message);
    } finally {
      setIsConnecting(false);
    }
  }, [onConnect]);

  // Handle disconnect
  const handleDisconnect = useCallback(() => {
    setError(null);
    setFundingMessage(null);
    onDisconnect();
  }, [onDisconnect]);

  // Fund connected wallet via Friendbot
  const handleFund = useCallback(async () => {
    if (!publicKey) return;

    setIsFunding(true);
    setError(null);
    setFundingMessage(null);

    try {
      await fundWithFriendbot(publicKey);
      setFundingMessage("✅ Account funded with 10,000 Testnet XLM!");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to fund account";
      if (message.includes("createAccountAlreadyExist")) {
        setFundingMessage("ℹ️ Account already funded.");
      } else {
        setError(message);
      }
    } finally {
      setIsFunding(false);
    }
  }, [publicKey]);

  return (
    <div className="wallet-connect">
      {/* Error display */}
      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="error-dismiss"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Funding success message */}
      {fundingMessage && (
        <div className="success-banner">
          <span>{fundingMessage}</span>
          <button
            onClick={() => setFundingMessage(null)}
            className="success-dismiss"
            aria-label="Dismiss message"
          >
            ✕
          </button>
        </div>
      )}

      <div className="wallet-actions">
        {publicKey ? (
          <>
            {/* Connected state */}
            <div className="wallet-info">
              <div className="wallet-status">
                <span className="status-dot connected" />
                <span className="status-label">Connected</span>
              </div>
              <span className="wallet-address" title={publicKey}>
                {truncateKey(publicKey)}
              </span>
            </div>

            <div className="wallet-buttons">
              <button
                onClick={handleFund}
                disabled={isFunding}
                className="btn btn-secondary"
              >
                {isFunding ? (
                  <>
                    <span className="spinner" />
                    Funding...
                  </>
                ) : (
                  "💧 Get Testnet XLM"
                )}
              </button>

              <button
                onClick={handleDisconnect}
                className="btn btn-outline"
              >
                Disconnect
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Disconnected state */}
            <div className="wallet-info">
              <div className="wallet-status">
                <span className="status-dot disconnected" />
                <span className="status-label">Not Connected</span>
              </div>
            </div>

            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="btn btn-primary"
            >
              {isConnecting ? (
                <>
                  <span className="spinner" />
                  Connecting...
                </>
              ) : (
                "🔗 Connect Wallet"
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
