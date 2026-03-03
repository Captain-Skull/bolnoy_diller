import type { MyContext } from '../../types/context.js';
import { getOrders } from '../../database/repo/orderRepo.js';
import { returnKeyboard } from '../../keyboards/common.js';
import { formatOrderStatus } from '../../utils/formatters.js';
import type { Order } from '../../types/models.js';
import { deleteCryptobotDeposit } from '../../database/repo/depostiRepo.js';
import { resetState } from '../../utils/helpers.js';
import { sendProfileMessage } from '../../services/profileService.js';

export async function handleProfile(ctx: MyContext, data: string): Promise<void> {
  const chatId = ctx.chat!.id;
  const messageId = ctx.msg!.message_id;

  if (data === 'my-profile') {
    sendProfileMessage(ctx);
    return;
  }

  if (data === 'reset-cb-deposit') {
    const chatId = ctx.chat!.id;
    resetState(ctx);
    await deleteCryptobotDeposit(chatId);
    await sendProfileMessage(ctx);
    return;
  }

  if (data === 'my-orders') {
    try {
      const orders = await getOrders(chatId);

      if (!orders) {
        await ctx.api.sendMessage(chatId, '📭 У вас еще нет заказов');
        return;
      }

      const ordersList = (Object.entries(orders) as [string, Order][])
        .map(([orderId, order]) => {
          let details = '';

          if (order.type === 'codes' && order.codes) {
            const codesText = Object.entries(order.codes)
              .map(([label, codes]) => `➥ ${label} UC:\n${(codes as string[]).join('\n')}`)
              .join('\n\n');
            details = `\n🔑 Полученные коды:\n${codesText}`;
          } else if (order.pubgId) {
            details = `\n🆔 Игровой ID: ${order.pubgId}`;
          }

          return (
            `🆔 Заказ #${orderId}\n` +
            `📅 Дата: ${new Date(order.timestamp).toLocaleDateString()}\n` +
            `🛍 Товаров: ${order.items.length}\n` +
            `💵 Сумма: ${order.total}$\n` +
            `📊 Статус: ${formatOrderStatus(order.status)} ${order.status}` +
            details
          );
        })
        .join('\n\n────────────────\n');

      await ctx.api.sendMessage(chatId, `📋 История ваших заказов:\n\n${ordersList}`, {
        parse_mode: 'HTML',
        reply_markup: returnKeyboard,
      });

      await ctx.api.deleteMessage(chatId, messageId);
    } catch (error) {
      console.error('Ошибка получения заказов:', error);
      await ctx.api.sendMessage(chatId, '❌ Ошибка загрузки истории заказов');
    }
  }
}
