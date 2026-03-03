import type { MyContext } from '../../types/context.js';
import { showPaymentMethods, startCardDeposit, startBybitDeposit, startCryptobotDeposit } from '../../services/depositService.js';

export async function handleDeposit(ctx: MyContext, data: string): Promise<void> {
  const messageId = ctx.msg!.message_id;

  switch (data) {
    case 'deposit':
      await showPaymentMethods(ctx, messageId);
      break;
    case 'deposit-with-card':
      await startCardDeposit(ctx);
      break;
    case 'deposit-with-bybit':
      await startBybitDeposit(ctx);
      break;
    case 'deposit-with-cryptobot':
      await startCryptobotDeposit(ctx, messageId);
      break;
  }
}
