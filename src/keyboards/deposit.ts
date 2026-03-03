import { InlineKeyboard } from 'grammy';
import { getPaymentDetails } from '../database/repo/paymentRepo.js';

export const depositKeyboard = new InlineKeyboard().text('💳 Пополнить баланс', 'deposit');

export const paymentMehtodsKeyboard = new InlineKeyboard()
  .text('💳 Перевод по карте', 'deposit-with-card')
  .row()
  .text('🔸 ByBit', 'deposit-with-bybit')
  .row()
  .text('🔹 CryptoBot', 'deposit-with-cryptobot')
  .row()
  .text('❌ Отмена', 'my-profile');

export function depositConfirmKeyboard(userId: string | number): InlineKeyboard {
  return new InlineKeyboard().text('✅ Подтвердить', `confirm_${userId}`).text('❌ Отклонить', `reject_${userId}`);
}

export function cryptobotDepositKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .url('➡️ Счет для оплаты', getPaymentDetails().CryptoBot || '')
    .row()
    .text('❌ Отмена', 'reset-cb-deposit');
}
