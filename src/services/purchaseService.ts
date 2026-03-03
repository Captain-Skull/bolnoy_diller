import type { MyContext } from '../types/context.js';
import { UserState, ProductCategory } from '../types/enums.js';
import { getAvailableCodes, markCodesAsUsed, countAvailableCodes } from '../database/repo/codeRepo.js';
import { getBalance, subtractBalance } from '../database/repo/userRepo.js';
import { getProducts } from '../database/repo/productRepo.js';
import { saveOrder } from '../database/repo/orderRepo.js';
import { sendOrderNotification } from './notificationService.js';
import { returnKeyboard, toMainMenuKeyboard } from '../keyboards/common.js';
import { orderModerationKeyboard } from '../keyboards/admin.js';
import { getUserTag, resetState } from '../utils/helpers.js';
import { depositKeyboard } from '../keyboards/deposit.js';

export async function initPurchaseWithId(ctx: MyContext, category: ProductCategory): Promise<void> {
  const chatId = ctx.chat!.id;
  const cart = ctx.session.cart;

  if (!cart || cart.items.length === 0) return;

  if (getBalance(chatId) < cart.total) {
    await ctx.api.sendMessage(chatId, '❌ Недостаточно средств! Пополните свой баланс.', {
      reply_markup: depositKeyboard,
    });
    return;
  }

  ctx.session.state = {
    type: UserState.AWAITING_ID,
    productType: category,
  };

  await ctx.editMessageCaption({
    caption: '✦ Отправьте ID для зачисления товара!',
    reply_markup: returnKeyboard,
  });
}

export async function completePurchaseWithId(ctx: MyContext, pubgId: string): Promise<void> {
  const chatId = ctx.chat!.id;
  const state = ctx.session.state;
  const cart = ctx.session.cart;

  if (!cart || cart.items.length === 0) {
    await ctx.reply('❌ Корзина пуста!');
    return;
  }

  const type = state.productType!;
  const userTag = getUserTag(ctx);
  const balance = getBalance(chatId);

  if (balance < cart.total) {
    await ctx.api.sendMessage(chatId, '❌ Недостаточно средств! Пополните баланс.', {
      reply_markup: depositKeyboard,
    });
    return;
  }

  const products = getProducts(type);
  const itemsDetails = cart.items.reduce<Record<string, number>>((acc, item) => {
    acc[item.label] = (acc[item.label] || 0) + 1;
    return acc;
  }, {});

  const itemsText = Object.entries(itemsDetails)
    .map(([label, count]) => {
      const product = products.find(p => p.label === label);
      return `➥ ${label} × ${count} = ${(product?.price || 0) * count}$`;
    })
    .join('\n');

  const newBalance = await subtractBalance(chatId, cart.total);

  const orderNumber = Date.now().toString(36).toUpperCase() + chatId.toString().slice(-4);

  const orderData = {
    orderId: orderNumber,
    userId: chatId,
    type: type,
    pubgId,
    items: cart.items,
    total: cart.total,
    status: 'pending',
    timestamp: Date.now(),
    userInfo: {
      username: userTag,
      balanceBefore: balance,
      balanceAfter: newBalance,
    },
  };

  await saveOrder(chatId, orderNumber, orderData);

  const orderText =
    `✅Новый заказ\n🧾#${orderNumber}\nКатегория: ${type}\n` +
    `🛍Товары:\n${itemsText}\n💵Стоимость: ${cart.total}$\n` +
    `🆔: <code>${pubgId}</code>\n` +
    `🪪Пользователь: ${userTag} (ID: ${chatId})\n` +
    `⚠️Выберите действие ниже`;

  await sendOrderNotification(orderText, orderModerationKeyboard(chatId, orderNumber, cart.total));

  await ctx.reply('✅ ID успешно отправлен, ожидайте подтверждение администратора', {
    reply_markup: toMainMenuKeyboard,
  });

  resetState(ctx);
}

export async function purchaseCodes(ctx: MyContext): Promise<void> {
  const chatId = ctx.chat!.id;
  const messageId = ctx.msg?.message_id;
  const cart = ctx.session.cart;
  const firstName = ctx.chat?.first_name || '';
  const lastName = ctx.chat?.last_name || '';

  if (!cart || cart.items.length === 0) {
    await ctx.api.sendMessage(chatId, '❌ Корзина пуста!');
    return;
  }

  const balance = getBalance(chatId);

  if (balance < cart.total) {
    await ctx.api.sendMessage(chatId, '❌ Недостаточно средств! Пополните баланс.', {
      reply_markup: depositKeyboard,
    });
    return;
  }

  const requiredCodes = cart.items.reduce<Record<string, number>>((acc, item) => {
    acc[item.label] = (acc[item.label] || 0) + 1;
    return acc;
  }, {});

  for (const [label, count] of Object.entries(requiredCodes)) {
    const available = await countAvailableCodes(label);
    if (available < count) {
      await ctx.api.sendMessage(chatId, '❌ Недостаточно кодов для выполнения заказа');
      return;
    }
  }

  const codesToSend: Record<string, string[]> = {};

  for (const [label, count] of Object.entries(requiredCodes)) {
    const codes = await getAvailableCodes(label, count);
    const codeKeys = Object.keys(codes);
    codesToSend[label] = codeKeys.map(key => codes[key].code);
    await markCodesAsUsed(label, codeKeys);
  }

  const newBalance = await subtractBalance(chatId, cart.total);

  const orderNumber = Date.now().toString(36).toUpperCase() + chatId.toString().slice(-4);

  await saveOrder(chatId, orderNumber, {
    orderId: orderNumber,
    userId: chatId,
    type: 'codes',
    codes: codesToSend,
    items: cart.items,
    total: cart.total,
    status: 'confirmed',
    timestamp: Date.now(),
    userInfo: {
      username: `${firstName} ${lastName}`.trim(),
      balanceBefore: balance,
      balanceAfter: newBalance,
    },
  });

  let codesMessage = '';
  for (const [label, codes] of Object.entries(codesToSend)) {
    const formatted = codes.map(c => `<code>${c}</code>`).join('\n');
    codesMessage += `➥ ${label} UC:\n${formatted}\n\n`;
  }

  await ctx.api.sendMessage(chatId, `✅ Ваши коды:\n\n${codesMessage}`, {
    parse_mode: 'HTML',
  });

  if (messageId) {
    try {
      await ctx.api.deleteMessage(chatId, messageId);
    } catch (error) {
      console.error(error);
    }
  }

  await sendOrderNotification(
    `✅ Новый заказ кодами #${orderNumber}\n` +
      `Пользователь: ${firstName} ${lastName} (ID: ${chatId})\n` +
      `Коды:\n\n${codesMessage}` +
      `Сумма: ${cart.total}$`,
  );

  resetState(ctx);
}
