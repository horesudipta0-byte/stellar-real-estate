# 🏛️ RealToken — Real Estate Fractional Ownership on Stellar

A decentralized application (dApp) for tokenizing real estate assets on the Stellar blockchain using Soroban smart contracts. The deployer issues a fixed supply of property tokens representing fractional ownership. Token holders can list their fractions for sale at a fixed price in XLM. The contract handles buy/sell directly on-chain while the frontend shows property details, your ownership percentage, and buy/sell/transfer forms.

> **⚠️ TESTNET ONLY** — This project is designed for the Stellar Testnet. Never use Mainnet URLs, keys, or passphrases.

---

## Tech Stack

| Layer           | Technology                                   |
|-----------------|----------------------------------------------|
| Smart Contract  | Rust + Soroban SDK v21.0.0                   |
| Frontend        | Next.js 14 (App Router) + TypeScript         |
| Styling         | Vanilla CSS (dark theme, responsive)         |
| Stellar SDK     | @stellar/stellar-sdk (latest)                |
| Wallet          | Freighter browser extension (@stellar/freighter-api) |
| Network         | Stellar Testnet                              |

---

## Prerequisites

Before starting, make sure you have the following installed:

### 1. Rust Toolchain
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

### 2. WebAssembly Target
```bash
rustup target add wasm32-unknown-unknown
```

### 3. Stellar CLI
```bash
cargo install --locked stellar-cli --features opt
```

### 4. Node.js 18+
Download from [nodejs.org](https://nodejs.org/) or use nvm:
```bash
nvm install 18
nvm use 18
```

### 5. Freighter Wallet
Install the Freighter browser extension from [https://freighter.app](https://freighter.app).
After installing, open it and switch to **Testnet** mode:
- Click the gear icon (Settings)
- Go to **Network**
- Select **Testnet**

---

## Project Structure

```
stellar-real-estate/
├── contracts/
│   ├── src/
│   │   └── lib.rs              # Soroban smart contract (all logic)
│   └── Cargo.toml              # Rust dependencies
├── frontend/
│   ├── app/
│   │   ├── globals.css         # Global styles (dark theme)
│   │   ├── layout.tsx          # Root layout with metadata
│   │   └── page.tsx            # Main page component
│   ├── components/
│   │   ├── WalletConnect.tsx   # Freighter wallet connection UI
│   │   └── MainFeature.tsx     # All contract interaction forms
│   ├── lib/
│   │   ├── stellar.ts          # Stellar network helpers
│   │   └── contract.ts         # Typed contract function wrappers
│   ├── types/
│   │   └── index.ts            # TypeScript type definitions
│   ├── package.json            # Frontend dependencies
│   ├── tsconfig.json           # TypeScript configuration
│   └── next.config.js          # Next.js + Stellar SDK webpack config
├── .env.example                # Environment variable template
└── README.md                   # This file
```

---

## Step 1 — Build the Smart Contract

```bash
cd contracts
cargo build --target wasm32-unknown-unknown --release
```

This compiles the Soroban smart contract to a WebAssembly (.wasm) file. The output binary will be located at:

```
contracts/target/wasm32-unknown-unknown/release/real_estate_token.wasm
```

> **Note:** The file name is derived from the `name` field in `Cargo.toml` with hyphens replaced by underscores.

---

## Step 2 — Set Up a Testnet Identity

```bash
stellar keys generate --global my-key --network testnet
```

This creates a new Stellar keypair and automatically funds it with 10,000 XLM from Friendbot on the Testnet.

To see your public key:
```bash
stellar keys address my-key
```

> **Tip:** Save this key — you'll use `my-key` as the `--source` for all contract operations.

---

## Step 3 — Deploy Contract to Testnet

```bash
cd contracts
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/real_estate_token.wasm \
  --source my-key \
  --network testnet
```

This deploys the compiled WASM to the Stellar Testnet and returns a **Contract ID** — a long string like `CABC123...XYZ`. **Copy this ID!** You will need it in Step 5.

Example output:
```
CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2OOTGNIH
```

### Optional: Initialize via CLI

You can also initialize the contract from the command line:
```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source my-key \
  --network testnet \
  -- \
  initialize \
  --admin <YOUR_PUBLIC_KEY> \
  --total_supply 1000 \
  --property_name "Sunset Villa #42" \
  --property_value 5000000000000 \
  --property_location "123 Blockchain Ave, Crypto City"
```

> Note: `property_value` is in stroops (1 XLM = 10,000,000 stroops). 5000000000000 = 500,000 XLM.

---

## Step 4 — Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

This installs Next.js, React, the Stellar SDK, and the Freighter API.

---

## Step 5 — Configure Environment Variables

```bash
cp ../.env.example .env.local
```

Open `.env.local` in your editor and paste the Contract ID from Step 3:

```env
NEXT_PUBLIC_CONTRACT_ID=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2OOTGNIH
NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
```

> **⚠️ Important:** After modifying `.env.local`, you MUST restart the dev server. Next.js does not hot-reload environment variables.

---

## Step 6 — Run the Frontend

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Step 7 — Using the App

### First-Time Setup
1. **Install Freighter** at [https://freighter.app](https://freighter.app) and create a wallet
2. **Switch to Testnet** in Freighter: Settings → Network → Testnet
3. **Connect your wallet** by clicking "🔗 Connect Wallet" in the app
4. **Fund your wallet** by clicking "💧 Get Testnet XLM" — this gives you 10,000 free test XLM

### Initializing the Contract
If the contract hasn't been initialized yet, you'll see an initialization form:
1. Enter the property name, location, total token supply, and valuation in XLM
2. Click "🚀 Initialize Contract"
3. Approve the transaction in Freighter
4. The contract will mint all tokens to your address (you're the admin)

### Listing Tokens for Sale
1. Enter the number of tokens you want to sell
2. Set the price per token in XLM
3. Click "📝 List for Sale"
4. Approve the transaction in Freighter

### Buying Tokens
1. Enter the seller's Stellar public key (G...)
2. Enter the number of tokens you want to buy
3. Click "🛒 Buy Tokens"
4. Both buyer and seller must approve the transaction
5. Token ownership is transferred on-chain

### Transferring Tokens
1. Enter the recipient's public key
2. Enter the number of tokens to transfer
3. Click "📤 Transfer Tokens"
4. Approve in Freighter

### Looking Up Listings
1. Enter any seller's public key in the lookup form
2. Click "🔍 Lookup" to see their active listing details

---

## Smart Contract Functions

| Function | Type | Parameters | Description |
|----------|------|------------|-------------|
| `initialize` | Write | `admin`, `total_supply`, `property_name`, `property_value`, `property_location` | One-time setup: stores property metadata and mints all tokens to admin |
| `get_balance` | Read | `owner` (Address) | Returns the token balance for any address |
| `get_property_info` | Read | (none) | Returns property name, location, valuation, and total supply |
| `get_total_supply` | Read | (none) | Returns the total number of tokens |
| `get_admin` | Read | (none) | Returns the admin's address |
| `list_for_sale` | Write | `seller`, `amount`, `price_per_token` | List tokens for sale at a fixed price in stroops |
| `cancel_listing` | Write | `seller` | Remove an active sale listing |
| `get_listing` | Read | `seller` (Address) | Returns the active listing for a seller |
| `buy_tokens` | Write | `buyer`, `seller`, `amount` | Purchase tokens from a seller's listing |
| `transfer` | Write | `from`, `to`, `amount` | Direct token transfer between addresses |

> **Note:** All prices/values are in **stroops** internally (1 XLM = 10,000,000 stroops). The frontend converts between XLM and stroops automatically.

---

## Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `Transaction simulation failed` | Contract not deployed or wrong CONTRACT_ID | Verify CONTRACT_ID in `.env.local` matches the deployed contract |
| `Freighter not found` | Freighter extension not installed | Install from [freighter.app](https://freighter.app) and refresh |
| `Account not found` | Wallet not funded on Testnet | Click "💧 Get Testnet XLM" to fund via Friendbot |
| `wasm32 target not found` | Missing WebAssembly build target | Run: `rustup target add wasm32-unknown-unknown` |
| `Error(Contract, #1)` | Contract not initialized | Initialize the contract first via the UI or CLI |
| `Error(Contract, #2)` | Contract already initialized | The contract can only be initialized once — proceed normally |
| `Error(Contract, #3)` | Not authorized | Only the admin (initializer) can perform this action |
| `Error(Contract, #4)` | Insufficient token balance | You don't have enough tokens for this operation |
| `Error(Contract, #5)` | No active listing | The seller hasn't listed any tokens for sale |
| `Error(Contract, #6)` | Insufficient listed amount | The seller's listing has fewer tokens than you requested |
| `Error(Contract, #7)` | Invalid amount | Amount must be greater than zero |
| `Error(Contract, #8)` | Cannot buy own tokens | You can't buy tokens from your own listing |
| `Bad union switch` | SDK/Freighter version mismatch | The app handles this by submitting raw XDR via fetch instead of parsing |
| `.env.local changes not reflecting` | Next.js caches env vars | Stop dev server (Ctrl+C) and restart (`npm run dev`) |

---

## Testnet Resources

- **Stellar Testnet Explorer:** [https://stellar.expert/explorer/testnet](https://stellar.expert/explorer/testnet)
- **Stellar Lab** (manual transactions): [https://lab.stellar.org](https://lab.stellar.org)
- **Friendbot** (free testnet XLM): `https://friendbot.stellar.org/?addr=YOUR_PUBLIC_KEY`
- **Soroban Docs:** [https://soroban.stellar.org](https://soroban.stellar.org)
- **Freighter Wallet:** [https://freighter.app](https://freighter.app)

---

## Architecture Notes

### Token Transfer Model
This contract uses a **simplified token transfer model** where:
- Token ownership is tracked on-chain via `Balance(Address)` storage keys
- Listings (sell orders) are stored on-chain via `Listing(Address)` keys
- The `buy_tokens` function transfers token ownership from seller to buyer
- **XLM payment** is handled via Freighter transaction authorization (both parties must sign)
- For a production system, you would integrate the Stellar Asset Contract (SAC) for atomic XLM swaps

### Storage
- **Instance storage** (`env.storage().instance()`): Admin, property metadata, initialization flag
- **Persistent storage** (`env.storage().persistent()`): Balances and listings per address

### Security
- All write operations require `require_auth()` from the relevant parties
- Double-initialization is prevented by the `Initialized` flag
- Overflow protection on all arithmetic operations
- Buyers cannot buy their own tokens

---

## License

MIT License — for educational purposes on Stellar Testnet only.
