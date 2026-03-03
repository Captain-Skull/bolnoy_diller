import { InlineKeyboard } from 'grammy';
import { bot } from '../bot.js';
import { DEPOSIT_GROUP_ID, ORDERS_GROUP_ID } from '../config/env.js';

export async function sendToGroup(groupId: string, message: string, keyboard?: InlineKeyboard): Promise<void> {
  try {
    await bot.api.sendMessage(groupId, message, {
      parse_mode: 'HTML',
      reply_markup: keyboard || new InlineKeyboard(),
    });
  } catch (error) {
    console.error('Group send error:', error);
  }
}

export async function sendDepositNotification(message: string, keyboard?: InlineKeyboard): Promise<void> {
  await sendToGroup(DEPOSIT_GROUP_ID, message, keyboard);
}

export async function sendOrderNotification(message: string, keyboard?: InlineKeyboard): Promise<void> {
  await sendToGroup(ORDERS_GROUP_ID, message, keyboard);
}
