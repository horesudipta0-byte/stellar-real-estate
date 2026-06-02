export interface PropertyInfo {
  name: string;
  location: string;
  value: number; // in stroops (1 XLM = 10,000,000 stroops)
  total_supply: number;
}

export interface SaleListing {
  seller: string;
  amount: number;
  price_per_token: number; // in stroops
}

export interface NetworkConfig {
  rpcUrl: string;
  networkPassphrase: string;
  horizonUrl: string;
}

export interface TransactionResult {
  hash: string;
  status: string;
}

export interface WalletState {
  publicKey: string | null;
  isConnected: boolean;
}
