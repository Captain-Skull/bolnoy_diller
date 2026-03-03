import type { MyContext } from '../types/context.js';
import { UserState } from '../types/enums.js';
import { IMAGES } from '../config/constants.js';
import { addBalance } from '../database/repo/userRepo.js';
import {
  setPendingCheck,
  deletePendingCheck,
  setCryptobotDeposit,
  getCryptobotDeposit,
  deleteCryptobotDeposit,
} from '../database/repo/depostiRepo.js';
import { getPaymentDetails } from '../database/repo/paymentRepo.js';
import { sendDepositNotification } from './notificationService.js';
import { getCbrUsdRate, rubToUsd } from './currencyService.js';
import { bot } from '../bot.js';
import { DEPOSIT_GROUP_ID } from '../config/env.js';
import { getUserTag, resetState, safeRound } from '../utils/helpers.js';
import { cancelProfileKeyboard, openShopKeyboard, toMainMenuKeyboard } from '../keyboards/common.js';
import { cryptobotDepositKeyboard, depositConfirmKeyboard, paymentMehtodsKeyboard } from '../keyboards/deposit.js';

export async function showPaymentMethods(ctx: MyContext, messageId: number): Promise<void> {
  const chatId = ctx.chat!.id;
  const cbrData = await getCbrUsdRate();
  const usdRate = cbrData?.usdRate || 0;

  await ctx.api.editMessageMedia(
    chatId,
    messageId,
    {
      type: 'photo',
      media: IMAGES.payment,
      caption: `Курс ЦБ РФ: 1$ = ${usdRate}₽\nВыберите способ оплаты`,
    },
    {
      reply_markup: paymentMehtodsKeyboard,
    },
  );
}

export async function startCardDeposit(ctx: MyContext): Promise<void> {
  await ctx.editMessageMedia(
    {
      type: 'photo',
      media: IMAGES.amount,
      caption: 'Отправьте сумму, на которую хотите пополнить баланс (в рублях):',
    },
    {
      reply_markup: cancelProfileKeyboard,
    },
  );

  ctx.session.state = { type: UserState.AWAITING_DEPOSIT_CARD };
}

export async function startBybitDeposit(ctx: MyContext): Promise<void> {
  await ctx.editMessageMedia(
    {
      type: 'photo',
      media: IMAGES.amount,
      caption: 'Отправьте сумму, на которую хотите пополнить баланс (в $):',
    },
    {
      reply_markup: cancelProfileKeyboard,
    },
  );

  ctx.session.state = { type: UserState.AWAITING_DEPOSIT_BYBIT };
}

export async function startCryptobotDeposit(ctx: MyContext, messageId: number): Promise<void> {
  const chatId = ctx.chat!.id;
  const firstName = ctx.chat?.first_name || '';
  const lastName = ctx.chat?.last_name || '';
  const fullName = `${firstName}${lastName ? ' ' + lastName : ''}`.trim();

  await setCryptobotDeposit(chatId, {
    userId: chatId,
    messageId,
    username: fullName,
  });

  await ctx.editMessageMedia(
    {
      type: 'photo',
      media: IMAGES.amount,
      caption: '<b>➤ Оплатите счёт ниже на сумму которую хотите внести!</b>',
      parse_mode: 'HTML',
    },
    {
      reply_markup: cryptobotDepositKeyboard(),
    },
  );
}

export async function handleCardAmountInput(ctx: MyContext): Promise<void> {
  const chatId = ctx.chat!.id;
  const text = ctx.msg?.text;
  if (!text) return;

  const amount = parseFloat(text);

  if (isNaN(amount) || amount <= 0) {
    await ctx.api.sendMessage(chatId, 'Вы отправили некорректную сумму', {
      reply_markup: cancelProfileKeyboard,
    });
    return;
  }

  const cbrData = await getCbrUsdRate();
  const usdRate = cbrData?.usdRate || 1;
  const details = getPaymentDetails();
  const userTag = getUserTag(ctx);
  const amountUsd = rubToUsd(amount, usdRate);

  await ctx.api.sendMessage(
    chatId,
    `Совершите перевод на указанную сумму ⤵️\n${details.card}\nСумма: ${amount}₽ (${amountUsd}$)\n\nВ ОТВЕТНОМ СООБЩЕНИИ ПРИШЛИТЕ ЧЕК ТРАНЗАКЦИИ`,
    {
      parse_mode: 'HTML',
      reply_markup: cancelProfileKeyboard,
    },
  );

  ctx.session.state = {
    type: UserState.AWAITING_RECEIPT,
    depositAmount: amountUsd,
    userTag,
  };
}

export async function handleBybitAmountInput(ctx: MyContext): Promise<void> {
  const chatId = ctx.chat!.id;
  const text = ctx.msg?.text;
  if (!text) return;

  const amount = parseFloat(text);

  if (isNaN(amount) || amount <= 0) {
    await ctx.api.sendMessage(chatId, 'Вы отправили некорректную сумму', {
      reply_markup: cancelProfileKeyboard,
    });
    return;
  }

  const cbrData = await getCbrUsdRate();
  const usdRate = cbrData?.usdRate || 1;
  const details = getPaymentDetails();
  const userTag = getUserTag(ctx);

  await ctx.api.sendMessage(
    chatId,
    `Совершите перевод на указанную сумму ⤵️\n<code>${details.ByBit}</code>\nСумма: ${amount}$ (${amount * usdRate}₽)\n\nВ ОТВЕТНОМ СООБЩЕНИИ ПРИШЛИТЕ ЧЕК ТРАНЗАКЦИИ`,
    {
      parse_mode: 'HTML',
      reply_markup: cancelProfileKeyboard,
    },
  );

  ctx.session.state = {
    type: UserState.AWAITING_RECEIPT,
    depositAmount: amount,
    userTag,
  };
}

export async function handleReceiptInput(ctx: MyContext): Promise<void> {
  const chatId = ctx.chat!.id;
  const state = ctx.session.state;
  const userTag = state.userTag || getUserTag(ctx);
  const amount = state.depositAmount || 0;

  await bot.api.forwardMessage(DEPOSIT_GROUP_ID, chatId, ctx.msg!.message_id);

  await setPendingCheck(chatId, {
    amount,
    userTag,
    userId: chatId,
  });

  await sendDepositNotification(
    `🆕 Запрос на пополнение баланса\n` +
      `👤 Пользователь: ${userTag} (ID: ${chatId})\n` +
      `💵 Сумма: ${amount}$\n` +
      `📅 Время: ${new Date().toLocaleString()}`,
    depositConfirmKeyboard(chatId),
  );

  await ctx.api.sendMessage(chatId, 'Чек получен и отправлен администратору на проверку. Ожидайте подтверждения.', {
    reply_markup: toMainMenuKeyboard,
  });

  resetState(ctx);
}

export async function confirmDeposit(userId: string, amount: number, userTag: string): Promise<void> {
  const newBalance = await addBalance(userId, amount);

  await sendDepositNotification(`Пополнение на ${amount}$ для ${userTag} (ID: ${userId}) подтверждено.`);

  await bot.api.sendMessage(userId, `Ваш баланс был пополнен на ${amount}$. Текущий баланс: ${newBalance}$.`, {
    reply_markup: toMainMenuKeyboard,
  });

  await deletePendingCheck(userId);
}

export async function rejectDeposit(userId: string, amount: number, userTag: string): Promise<void> {
  await sendDepositNotification(`Пополнение на ${amount}$ для ${userTag} (ID: ${userId}) отменено.`);

  await bot.api.sendMessage(userId, `Ваше пополнение на сумму ${amount}$ было отклонено. Пожалуйста, попробуйте снова.`, {
    reply_markup: toMainMenuKeyboard,
  });

  await deletePendingCheck(userId);
}

export async function processCryptobotPayment(ctx: MyContext): Promise<void> {
  const text = ctx.msg?.text;
  if (!text) return;

  const lines = text.split(' ');
  const senderIndex = lines.findIndex(line => line === 'отправил(а)');

  if (senderIndex === -1 || senderIndex + 2 >= lines.length || lines[senderIndex + 1] !== '🪙') {
    await ctx.api.sendMessage(DEPOSIT_GROUP_ID, '❌ Ошибка парсинга данных перевода');
    return;
  }

  const paymentData = {
    username: lines.slice(0, senderIndex).join(' ').trim(),
    amount: parseFloat(lines[senderIndex + 2].replace(',', '.')),
    currency: 'USDT',
  };

  if (!paymentData.username || isNaN(paymentData.amount)) {
    await ctx.api.sendMessage(DEPOSIT_GROUP_ID, '❌ Ошибка парсинга данных перевода');
    return;
  }

  const deposit = await getCryptobotDeposit(paymentData.username);
  console.log(deposit);

  if (deposit) {
    const cleanedAmount = safeRound(paymentData.amount);
    const newBalance = await addBalance(deposit.odUserId, cleanedAmount);

    await ctx.api.sendMessage(
      DEPOSIT_GROUP_ID,
      `✅ Перевод ${cleanedAmount} ${paymentData.currency} подтвержден\n` +
        `ID пользователя: ${deposit.odUserId}\n` +
        `Новый баланс: ${newBalance}`,
      { reply_to_message_id: ctx.msg!.message_id },
    );

    await ctx.api.sendPhoto(deposit.odUserId, IMAGES.welcome, {
      caption: `💳 Ваш баланс пополнен на ${cleanedAmount} ${paymentData.currency}\n` + `Текущий баланс: ${newBalance}`,
      reply_markup: openShopKeyboard,
    });

    if (deposit.messageId) {
      try {
        await ctx.api.deleteMessage(deposit.odUserId, deposit.messageId);
      } catch (error) {
        console.error(error);
      }
    }

    await deleteCryptobotDeposit(deposit.odUserId);
  } else {
    await ctx.api.sendMessage(
      DEPOSIT_GROUP_ID,
      `⚠️ Не найден заказ для перевода\n` +
        `Payment ID: ${paymentData.username}\n` +
        `Сумма: ${paymentData.amount} ${paymentData.currency}`,
      { reply_to_message_id: ctx.msg!.message_id },
    );
  }
}
