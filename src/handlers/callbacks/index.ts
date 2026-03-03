import { Bot } from 'grammy';
import type { MyContext } from '../../types/context.js';
import { handleNavigation } from './navigation.js';
import { handleShop } from './shop.js';
import { handleProfile } from './profile.js';
import { handleDeposit } from './deposit.js';
import { handleAdmin } from './admin.js';
import { handleModeration } from './moderation.js';

export function registerCallbacks(bot: Bot<MyContext>): void {
  bot.on('callback_query:data', async ctx => {
    const data = ctx.callbackQuery.data;

    try {
      if (data === 'return' || data === 'main-message' || data === 'open-shop' || data.startsWith('open-catalog_')) {
        return await handleNavigation(ctx, data);
      }

      if (data.startsWith('cart_')) {
        return await handleShop(ctx, data);
      }

      if (data === 'my-profile' || data === 'reset-cb-deposit' || data === 'my-orders') {
        return await handleProfile(ctx, data);
      }

      if (data === 'deposit' || data.startsWith('deposit-with-')) {
        return await handleDeposit(ctx, data);
      }

      if (
        [
          'admin-panel',
          'manage-category',
          'manage-balances',
          'manage-admins',
          'manage-codes',
          'send-broadcast',
          'edit-payment-details',
          'add-admin',
          'remove-admin',
        ].includes(data) ||
        data.startsWith('manage-products_') ||
        data.startsWith('edit-product_') ||
        data.startsWith('delete-product') ||
        data.startsWith('add-product_') ||
        data.startsWith('add-codes_') ||
        data.startsWith('select-payment-method_')
      ) {
        return await handleAdmin(ctx, data);
      }

      // Модерация
      if (
        data.startsWith('confirm_') ||
        data.startsWith('reject_') ||
        data.startsWith('order-completed_') ||
        data.startsWith('order-declined_')
      ) {
        return await handleModeration(ctx, data);
      }

      await ctx.answerCallbackQuery();
    } catch (error) {
      console.error('Callback error:', error);
    }
  });
}
