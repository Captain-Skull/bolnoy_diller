import type { MyContext } from '../../types/context.js';
import { ProductCategory } from '../../types/enums.js';
import { getProducts } from '../../database/repo/productRepo.js';
import { addToCart, clearCart, removeFromCart, updateCartMessage } from '../../services/cartService.js';
import { initPurchaseWithId, purchaseCodes } from '../../services/purchaseService.js';
import type { Product } from '../../types/models.js';

export async function handleShop(ctx: MyContext, data: string): Promise<void> {
  const messageId = ctx.msg!.message_id;

  if (data.startsWith('cart_')) {
    const parts = data.split('_');
    const action = parts[1];

    switch (action) {
      case 'clear': {
        const category = parts[2] as ProductCategory;
        clearCart(ctx);
        await updateCartMessage(ctx, category, messageId);
        break;
      }
      case 'buy-with-id': {
        const category = parts[2] as ProductCategory;
        await initPurchaseWithId(ctx, category);
        break;
      }
      case 'buy-codes':
        await purchaseCodes(ctx);
        break;
      case 'add': {
        const category = parts[2] as ProductCategory;
        const label = parts[3];
        const products = getProducts(category);
        const product = products.find((p: Product) => p.label === label);

        if (!product) {
          await ctx.answerCallbackQuery({ text: 'Товар не найден' });
          return;
        }

        addToCart(ctx, product);
        await updateCartMessage(ctx, category, messageId);
        break;
      }
      case 'remove': {
        const type = parts[2] as ProductCategory;
        const label = parts[3];
        const products = getProducts(type);
        const product = products.find(p => p.label === label);
        if (product) {
          removeFromCart(ctx, product);
          await updateCartMessage(ctx, type, messageId);
        }
        break;
      }
    }
  }
}
