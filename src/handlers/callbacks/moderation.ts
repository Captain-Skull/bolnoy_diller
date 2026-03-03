import { InlineKeyboard } from 'grammy';
import type { MyContext } from '../../types/context.js';
import { isAdmin } from '../../database/repo/adminRepo.js';
import { addBalance } from '../../database/repo/userRepo.js';
import { updateOrder } from '../../database/repo/orderRepo.js';
import { getPendingCheck } from '../../database/repo/depostiRepo.js';
import { confirmDeposit, rejectDeposit } from '../../services/depositService.js';
import { sendOrderNotification } from '../../services/notificationService.js';
import { bot } from '../../bot.js';
import { toMainMenuKeyboard } from '../../keyboards/common.js';

export async function handleModeration(ctx: MyContext, data: string): Promise<void> {
  const adminId = ctx.from?.id;

  if (!adminId || !isAdmin(adminId)) return;

  if (data.startsWith('confirm_')) {
    const userId = data.split('_')[1];
    const check = getPendingCheck(userId);

    if (check) {
      await confirmDeposit(userId, check.amount, check.userTag);
    }
    return;
  }

  if (data.startsWith('reject_')) {
    const userId = data.split('_')[1];
    const check = getPendingCheck(userId);

    if (check) {
      await rejectDeposit(userId, check.amount, check.userTag);
    }
    return;
  }

  if (data.startsWith('order-completed_')) {
    const [, userId, orderId] = data.split('_');

    try {
      await updateOrder(userId, orderId, {
        status: 'confirmed',
        confirmedAt: Date.now(),
        adminId: adminId,
      });

      await sendOrderNotification(`Заказ для пользователя с ID ${userId} был выполнен.`);

      await bot.api.sendMessage(userId, '✅ Заказ выполнен', {
        reply_markup: toMainMenuKeyboard,
      });

      await ctx.editMessageReplyMarkup({
        reply_markup: new InlineKeyboard(),
      });
    } catch (error) {
      console.error('Ошибка подтверждения заказа:', error);
    }
    return;
  }

  if (data.startsWith('order-declined_')) {
    const [, userId, orderId, amount] = data.split('_');

    try {
      await updateOrder(userId, orderId, {
        status: 'declined',
        confirmedAt: Date.now(),
        adminId: adminId,
      });

      await addBalance(userId, Math.round(parseFloat(amount) * 100) / 100);

      await sendOrderNotification(`❌ Заказ для пользователя с ID ${userId} был отменен.`);

      await bot.api.sendMessage(userId, '⛔️ Ваш заказ отклонён, причину узнайте у администратора', { reply_markup: toMainMenuKeyboard });

      await ctx.editMessageReplyMarkup({
        reply_markup: new InlineKeyboard(),
      });
    } catch (error) {
      console.error('Ошибка отмены заказа:', error);
    }
  }
}
