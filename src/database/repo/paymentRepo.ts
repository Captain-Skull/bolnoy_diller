import { database } from "../firebase.js";
import { cache } from "../cache.js";
import type { PaymentDetails } from "../../types/models.js";

export function getPaymentDetails(): PaymentDetails {
  return cache.paymentDetails;
}

export async function updatePaymentDetails(
  method: string,
  value: string
): Promise<void> {
  (cache.paymentDetails as any)[method] = value;
  await database.ref("paymentDetails").update(cache.paymentDetails);
}