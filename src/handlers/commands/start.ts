import { Bot } from 'grammy';
import type { MyContext } from '../../types/context.js';
import { createUser } from '../../database/repo/userRepo.js';
import { sendMainMessage } from '../../services/mainMessage.js';
import { resetState } from '../../utils/helpers.js';
import { deleteCryptobotDeposit, getCryptobotDepositById } from '../../database/repo/depostiRepo.js';

export function registerStart(bot: Bot<MyContext>): void {
  bot.command('start', async ctx => {
    const chatId = ctx.chat.id;

    resetState(ctx);
    await createUser(chatId);
    if (ctx.from && getCryptobotDepositById(chatId)) {
      await deleteCryptobotDeposit(chatId);
    }
    await sendMainMessage(ctx);
  });
}
