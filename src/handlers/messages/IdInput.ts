import type { MyContext } from '../../types/context.js';
import { completePurchaseWithId } from '../../services/purchaseService.js';

export async function handleIdInput(ctx: MyContext): Promise<void> {
  const text = ctx.msg?.text;
  if (!text) return;

  await completePurchaseWithId(ctx, text);
}
