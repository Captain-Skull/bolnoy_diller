import { database } from "../firebase.js";
import type { MyContext } from "../../types/context.js";
import type { CodeEntry } from "../../types/models.js";

export async function getAvailableCodes(
  productLabel: string,
  limit?: number
): Promise<Record<string, CodeEntry>> {
  let query: any = database
    .ref(`codes/${productLabel}`)
    .orderByChild("used")
    .equalTo(false);

  if (limit) {
    query = query.limitToFirst(limit);
  }

  const snapshot = await query.once("value");
  return snapshot.val() || {};
}

export async function countAvailableCodes(
  productLabel: string
): Promise<number> {
  const snapshot = await database
    .ref(`codes/${productLabel}`)
    .orderByChild("used")
    .equalTo(false)
    .once("value");

  return snapshot.numChildren();
}

export async function markCodesAsUsed(
  productLabel: string,
  codeKeys: string[]
): Promise<void> {
  const updates: Record<string, boolean> = {};
  codeKeys.forEach((key) => {
    updates[`codes/${productLabel}/${key}/used`] = true;
  });
  await database.ref().update(updates);
}

export async function addCodes(
  productLabel: string,
  codes: string[]
): Promise<void> {
  const updates: Record<string, object> = {};

  codes.forEach((code) => {
    const newKey = database.ref(`codes/${productLabel}`).push().key!;
    updates[newKey] = {
      code,
      used: false,
      addedAt: Date.now(),
    };
  });

  await database.ref(`codes/${productLabel}`).update(updates);
}

export async function getAllAvailableCodesCount(): Promise<
  Record<string, number>
> {
  const snapshot = await database.ref("codes").once("value");
  const codesData = snapshot.val() || {};
  const counts: Record<string, number> = {};

  Object.entries(codesData).forEach(
    ([label, productCodes]: [string, any]) => {
      counts[label] = Object.values(productCodes).filter(
        (c: any) => c.used === false
      ).length;
    }
  );

  return counts;
}

export async function sendUnusedCodes(
  ctx: MyContext,
  productLabel: string
): Promise<void> {
  try {
    const codes = await getAvailableCodes(productLabel);
    const codeEntries = Object.values(codes);

    let message = `📋 Текущие неиспользованные коды для ${productLabel} UC:\n`;

    if (codeEntries.length === 0) {
      message += "Пусто";
    } else {
      codeEntries.forEach((codeData, index) => {
        message += `${index + 1}. <code>${codeData.code}</code>\n`;
      });
    }

    if (ctx.chat) {
      await ctx.api.sendMessage(ctx.chat.id, message, {
        parse_mode: "HTML",
      });
    }
  } catch (error) {
    console.error("Ошибка получения кодов:", error);
    if (ctx.chat) {
      await ctx.api.sendMessage(
        ctx.chat.id,
        "❌ Ошибка при получении неиспользованных кодов"
      );
    }
  }
}