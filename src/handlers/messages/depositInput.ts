import type { MyContext } from '../../types/context.js';
import { UserState } from '../../types/enums.js';
import { handleCardAmountInput, handleBybitAmountInput, handleReceiptInput } from '../../services/depositService.js';

export async function handleDepositInput(ctx: MyContext): Promise<void> {
  const state = ctx.session.state;

  switch (state.type) {
    case UserState.AWAITING_DEPOSIT_CARD:
      await handleCardAmountInput(ctx);
      break;
    case UserState.AWAITING_DEPOSIT_BYBIT:
      await handleBybitAmountInput(ctx);
      break;
    case UserState.AWAITING_RECEIPT:
      await handleReceiptInput(ctx);
      break;
  }
}
