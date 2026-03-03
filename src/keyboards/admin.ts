import { InlineKeyboard } from 'grammy';
import { ProductCategory } from '../types/enums.js';
import { getProducts } from '../database/repo/productRepo.js';

export function adminPanelKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🛠 Товары', 'manage-category')
    .text('💳 Реквизиты', 'edit-payment-details')
    .row()
    .text('📊 Балансы', 'manage-balances')
    .text('📢 Рассылка', 'send-broadcast')
    .row()
    .text('➕ Коды', 'manage-codes')
    .text('👥 Админы', 'manage-admins')
    .row()
    .text('🔙 На главную', 'return');
}

export function categoryManagementKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('Коды', 'manage-products_codes')
    .row()
    .text('По ID', 'manage-products_id')
    .row()
    .text('Популярность', 'manage-products_popularity')
    .row()
    .text('Подписки', 'manage-products_subs')
    .row()
    .text('🔙 Назад', 'admin-panel');
}

export function productsManagementKeyboard(category: string): InlineKeyboard {
  const products = getProducts(category as ProductCategory);
  const keyboard = new InlineKeyboard();

  for (const p of products) {
    keyboard.text(`${p.label} - ${p.price}$`, `edit-product_${category}_${p.label}`).row();
  }

  keyboard
    .text('➕ Добавить', `add-product_${category}`)
    .text('➖ Удалить', `delete-product-list_${category}`)
    .row()
    .text('🔙 Назад', 'admin-panel');

  return keyboard;
}

export function deleteProductListKeyboard(category: string): InlineKeyboard {
  const products = getProducts(category as ProductCategory);
  const keyboard = new InlineKeyboard();

  for (const p of products) {
    keyboard.text(`${p.label} - ${p.price}$`, `delete-product_${category}_${p.label}`).row();
  }

  keyboard.text('❌ Отмена', 'admin-panel');
  return keyboard;
}

export function codesProductsKeyboard(): InlineKeyboard {
  const products = getProducts(ProductCategory.CODES);
  const keyboard = new InlineKeyboard();

  for (const p of products) {
    keyboard.text(`${p.label}`, `add-codes_${p.label}`).row();
  }

  keyboard.text('🔙 Назад', 'admin-panel');
  return keyboard;
}

export function paymentMethodsEditKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('ByBit', 'select-payment-method_ByBit')
    .row()
    .text('CryptoBot', 'select-payment-method_CryptoBot')
    .row()
    .text('Карта', 'select-payment-method_card')
    .row()
    .text('❌ Отмена', 'admin-panel');
}

export function adminsManagementKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('➕ Добавить', 'add-admin').text('➖ Удалить', 'remove-admin').row().text('🔙 Назад', 'admin-panel');
}

export function orderModerationKeyboard(userId: number, orderId: string, total: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Заказ выполнен', `order-completed_${userId}_${orderId}`)
    .text('❌ Отменить заказ', `order-declined_${userId}_${orderId}_${total}`);
}
