import { InlineKeyboard } from 'grammy';

export const returnKeyboard = new InlineKeyboard().text('🔙 В меню', 'return');

export const openShopKeyboard = new InlineKeyboard().text('🛒 Открыть магазин', 'open-shop');

export const cancelAdminKeyboard = new InlineKeyboard().text('❌ Отмена', 'admin-panel');

export const cancelProfileKeyboard = new InlineKeyboard().text('❌ Отмена', 'my-profile');

export const cancelKeyboard = new InlineKeyboard().text('❌ Отмена', 'return');

export const toMainMenuKeyboard = new InlineKeyboard().text('🏚 Главное меню', 'main-message');
