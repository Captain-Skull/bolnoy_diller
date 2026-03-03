import { Bot } from 'grammy';
import type { MyContext } from '../../types/context.js';
import { UserState } from '../../types/enums.js';
import { DEPOSIT_GROUP_ID, CRYPTOBOT_ID } from '../../config/env.js';
import { handleIdInput } from './IdInput.js';
import { handleDepositInput } from './depositInput.js';
import { handleAdminInput } from './adminInput.js';
import { processCryptobotPayment } from '../../services/depositService.js';
import { isAdmin } from '../../database/repo/adminRepo.js';
import { bot as botInstance } from '../../bot.js';

const messageRoutes: Record<string, (ctx: MyContext) => Promise<void>> = {
  [UserState.AWAITING_ID]: handleIdInput,
  [UserState.AWAITING_DEPOSIT_CARD]: handleDepositInput,
  [UserState.AWAITING_DEPOSIT_BYBIT]: handleDepositInput,
  [UserState.AWAITING_RECEIPT]: handleDepositInput,
  [UserState.AWAITING_PRODUCT_PRICE]: handleAdminInput,
  [UserState.AWAITING_NEW_PRODUCT_LABEL]: handleAdminInput,
  [UserState.AWAITING_NEW_PRODUCT_PRICE]: handleAdminInput,
  [UserState.AWAITING_CREDENTIALS]: handleAdminInput,
  [UserState.AWAITING_USER_FOR_BALANCE]: handleAdminInput,
  [UserState.AWAITING_NEW_BALANCE]: handleAdminInput,
  [UserState.AWAITING_BROADCAST]: handleAdminInput,
  [UserState.AWAITING_ADD_ADMIN]: handleAdminInput,
  [UserState.AWAITING_REMOVE_ADMIN]: handleAdminInput,
  [UserState.AWAITING_CODES]: handleAdminInput,
};

export function registerMessages(bot: Bot<MyContext>): void {
  bot.on('message:text', async ctx => {
    try {
      const chatId = ctx.chat.id;

      if (chatId.toString() === DEPOSIT_GROUP_ID && ctx.msg.from?.id.toString() === CRYPTOBOT_ID) {
        await processCryptobotPayment(ctx);
        return;
      }

      if (isAdmin(chatId) && ctx.msg.reply_to_message) {
        const forwardFrom = (ctx.msg.reply_to_message as any).forward_from;
        if (forwardFrom) {
          await botInstance.api.sendMessage(forwardFrom.id, `Ответ от администратора: ${ctx.msg.text}`);

          await ctx.reply(`Ответ от @${ctx.chat.username || chatId} пользователю с ID ${forwardFrom.id} был отправлен.`);
          return;
        }
      }

      const state = ctx.session.state;
      if (!state || state.type === UserState.DEFAULT) return;

      const handler = messageRoutes[state.type];
      if (handler) {
        await handler(ctx);
      }
    } catch (error: any) {
      if (error?.description?.includes('403')) {
        console.log('Бот заблокирован пользователем');
      } else {
        console.error('Message error:', error);
      }
    }
  });
}
