import type { OrderStatus } from './enums.js';

export interface Product {
  label: string;
  price: number;
}

export interface PaymentDetails {
  card: string;
  ByBit: string;
  CryptoBot: string;
}

export interface PendingCheck {
  amount: number;
  userTag: string;
  userId: number;
}

export interface CryptobotDeposit {
  userId: number;
  messageId: number;
  username: string;
}

export interface CodeEntry {
  code: string;
  used: boolean;
  addedAt: number;
}

export interface Order {
  orderId: string;
  userId: number;
  type: string;
  pubgId?: string;
  codes?: Record<string, string[]>;
  items: Product[];
  total: number;
  status: OrderStatus;
  timestamp: number;
  userInfo: {
    username: string;
    balanceBefore: number;
    balanceAfter: number;
  };
  confirmedAt?: number;
}
