import type { PaymentDetails, PendingCheck, CryptobotDeposit } from "../types/models.js";
import type { Product } from "../types/models.js";

export interface AppCache {
  admins: Record<string, boolean>;
  userBalances: Record<string, number>;
  productsCodes: Product[];
  productsId: Product[];
  productsPopularity: Product[];
  productsSubs: Product[];
  paymentDetails: PaymentDetails;
  pendingChecks: Record<string, PendingCheck>;
  cryptobotDeposits: Record<string, CryptobotDeposit>;
}

export const cache: AppCache = {
  admins: {},
  userBalances: {},
  productsCodes: [],
  productsId: [],
  productsPopularity: [],
  productsSubs: [],
  paymentDetails: {
    card: "",
    CryptoBot: "",
    ByBit: "",
  },
  pendingChecks: {},
  cryptobotDeposits: {},
};