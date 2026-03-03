import { database } from "../firebase.js";
import { cache } from "../cache.js";

export function getBalance(userId: string | number): number {
  return cache.userBalances[String(userId)] || 0;
}

export async function setBalance(
  userId: string | number,
  balance: number
): Promise<void> {
  const id = String(userId);
  cache.userBalances[id] = balance;
  await database.ref(`userBalances/${id}`).set(balance);
}

export async function addBalance(
  userId: string | number,
  amount: number
): Promise<number> {
  const id = String(userId);
  const newBalance = (cache.userBalances[id] || 0) + amount;
  cache.userBalances[id] = newBalance;
  await database.ref(`userBalances/${id}`).set(newBalance);
  return newBalance;
}

export async function subtractBalance(
  userId: string | number,
  amount: number
): Promise<number> {
  const id = String(userId);
  const newBalance = (cache.userBalances[id] || 0) - amount;
  cache.userBalances[id] = newBalance;
  await database.ref(`userBalances/${id}`).set(newBalance);
  return newBalance;
}

export async function createUser(userId: string | number): Promise<void> {
  const id = String(userId);
  if (cache.userBalances[id] === undefined) {
    cache.userBalances[id] = 0;
    await database.ref(`userBalances/${id}`).set(0);
  }
}

export async function deleteUser(userId: string | number): Promise<void> {
  const id = String(userId);
  delete cache.userBalances[id];
  await database.ref(`userBalances/${id}`).remove();
}

export function userExists(userId: string | number): boolean {
  return cache.userBalances[String(userId)] !== undefined;
}

export function getAllUserIds(): string[] {
  return Object.keys(cache.userBalances);
}