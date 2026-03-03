import { database } from "./firebase.js";
import { cache } from "./cache.js";
import { ADMIN_CHAT_ID } from "../config/env.js";

export async function initializeCache(): Promise<void> {
  const [
    adminsSnap,
    balancesSnap,
    codesSnap,
    idSnap,
    popularitySnap,
    subsSnap,
    paymentsSnap,
    pendingSnap,
    cryptoSnap,
  ] = await Promise.all([
    database.ref("admins").once("value"),
    database.ref("userBalances").once("value"),
    database.ref("productsCodes").once("value"),
    database.ref("productsId").once("value"),
    database.ref("productsPopularity").once("value"),
    database.ref("productsSubs").once("value"),
    database.ref("paymentDetails").once("value"),
    database.ref("pendingChecks").once("value"),
    database.ref("cryptobotDeposits").once("value"),
  ]);

  cache.admins = adminsSnap.val() || {};
  cache.userBalances = balancesSnap.val() || {};
  cache.productsCodes = codesSnap.val() || [];
  cache.productsId = idSnap.val() || [];
  cache.productsPopularity = popularitySnap.val() || [];
  cache.productsSubs = subsSnap.val() || [];
  cache.paymentDetails = paymentsSnap.val() || {};
  cache.pendingChecks = pendingSnap.val() || {};
  cache.cryptobotDeposits = cryptoSnap.val() || {};

  if (!Object.keys(cache.admins).length) {
    cache.admins[ADMIN_CHAT_ID] = true;
    await database.ref("admins").set(cache.admins);
  }

  console.log(
    `✅ Cache loaded: ${Object.keys(cache.userBalances).length} users, ` +
      `${Object.keys(cache.admins).length} admins, ` +
      `${cache.productsCodes.length} products`
  );
}