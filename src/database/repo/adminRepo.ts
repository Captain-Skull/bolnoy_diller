import { database } from "../firebase.js";
import { cache } from "../cache.js";
import { ADMIN_CHAT_ID } from "../../config/env.js";

export function isAdmin(userId: string | number): boolean {
  return cache.admins[String(userId)] === true;
}

export async function addAdmin(userId: string | number): Promise<void> {
  cache.admins[String(userId)] = true;
  await database.ref("admins").set(cache.admins);
}

export async function removeAdmin(userId: string | number): Promise<boolean> {
  const id = String(userId);

  if (id === ADMIN_CHAT_ID) return false;

  delete cache.admins[id];
  await database.ref("admins").set(cache.admins);
  return true;
}

export function getAdminIds(): string[] {
  return Object.keys(cache.admins);
}