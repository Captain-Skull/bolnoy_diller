import { database } from "../firebase.js";
import type { Order } from "../../types/models.js";

export async function saveOrder(
  userId: string | number,
  orderId: string,
  data: Record<string, any>
): Promise<void> {
  await database
    .ref("orders")
    .child(String(userId))
    .child(orderId)
    .set(data);
}

export async function getOrders(
  userId: string | number
): Promise<Record<string, Order> | null> {
  const snapshot = await database
    .ref("orders")
    .child(String(userId))
    .once("value");
  return snapshot.val();
}

export async function updateOrder(
  userId: string | number,
  orderId: string,
  data: Record<string, any>
): Promise<void> {
  await database
    .ref("orders")
    .child(String(userId))
    .child(orderId)
    .update(data);
}