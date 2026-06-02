/**
 * page.tsx — Main page for the Real Estate Fractional Ownership dApp.
 *
 * Dark-themed UI with WalletConnect at top and MainFeature below.
 */

"use client";

import React, { useState } from "react";
import WalletConnect from "@/components/WalletConnect";
import MainFeature from "@/components/MainFeature";

export default function Home() {
  const [publicKey, setPublicKey] = useState<string | null>(null);

  const handleConnect = (key: string) => {
    setPublicKey(key);
  };

  const handleDisconnect = () => {
    setPublicKey(null);
  };

  return (
    <main className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <div className="logo-icon">🏛️</div>
            <div className="logo-text">
              <h1>RealToken</h1>
              <span className="logo-subtitle">Fractional Real Estate on Stellar</span>
            </div>
          </div>
          <div className="network-badge">
            <span className="network-dot" />
            Stellar Testnet
          </div>
        </div>
      </header>

      {/* Wallet Connection */}
      <section className="wallet-section">
        <WalletConnect
          publicKey={publicKey}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
        />
      </section>

      {/* Main Content */}
      <section className="content-section">
        {publicKey ? (
          <MainFeature publicKey={publicKey} />
        ) : (
          <div className="connect-prompt">
            <div className="prompt-icon">🔐</div>
            <h2>Connect Your Wallet</h2>
            <p>
              Connect your Freighter wallet to interact with the Real Estate
              Token contract on the Stellar Testnet.
            </p>
            <div className="prompt-steps">
              <div className="step">
                <span className="step-number">1</span>
                <span>Install <a href="https://freighter.app" target="_blank" rel="noopener noreferrer">Freighter</a> browser extension</span>
              </div>
              <div className="step">
                <span className="step-number">2</span>
                <span>Switch to <strong>Testnet</strong> in Settings → Network</span>
              </div>
              <div className="step">
                <span className="step-number">3</span>
                <span>Click &quot;Connect Wallet&quot; above</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="app-footer">
        <p>
          Built on{" "}
          <a
            href="https://stellar.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            Stellar
          </a>{" "}
          with{" "}
          <a
            href="https://soroban.stellar.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            Soroban
          </a>{" "}
          smart contracts • Testnet Only
        </p>
      </footer>
    </main>
  );
}
