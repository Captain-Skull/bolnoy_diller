import { database } from '../firebase.js';
import { cache } from '../cache.js';
import type { PendingCheck, CryptobotDeposit } from '../../types/models.js';

export function getPendingCheck(userId: string | number): PendingCheck | undefined {
  return cache.pendingChecks[String(userId)];
}

export async function setPendingCheck(userId: string | number, data: PendingCheck): Promise<void> {
  const id = String(userId);
  cache.pendingChecks[id] = data;
  await database.ref('pendingChecks').set(cache.pendingChecks);
}

export async function deletePendingCheck(userId: string | number): Promise<void> {
  const id = String(userId);
  delete cache.pendingChecks[id];
  await database.ref('pendingChecks').set(cache.pendingChecks);
}

export async function setCryptobotDeposit(userId: string | number, data: CryptobotDeposit): Promise<void> {
  const id = String(userId);
  cache.cryptobotDeposits[id] = data;
  await database.ref('cryptobotDeposits').set(cache.cryptobotDeposits);
}

export async function getCryptobotDeposit(username: string): Promise<(CryptobotDeposit & { odUserId: string }) | undefined> {
  const entry = Object.entries(cache.cryptobotDeposits).find(([, deposit]) => deposit.username === username);

  if (entry) {
    return { ...entry[1], odUserId: entry[0] };
  }
  return undefined;
}

export function getCryptobotDepositById(userId: string | number): CryptobotDeposit {
  const id = String(userId);
  return cache.cryptobotDeposits[id];
}

export async function deleteCryptobotDeposit(userId: string | number): Promise<void> {
  const id = String(userId);
  delete cache.cryptobotDeposits[id];
  await database.ref('cryptobotDeposits').set(cache.cryptobotDeposits);
}
