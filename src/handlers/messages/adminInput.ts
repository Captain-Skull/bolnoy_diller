import type { MyContext } from '../../types/context.js';
import { UserState } from '../../types/enums.js';
import { getBalance, setBalance, userExists } from '../../database/repo/userRepo.js';
import { updateProductPrice, addProduct } from '../../database/repo/productRepo.js';
import { addAdmin, removeAdmin } from '../../database/repo/adminRepo.js';
import { updatePaymentDetails } from '../../database/repo/paymentRepo.js';
import { addCodes } from '../../database/repo/codeRepo.js';
import { sendBroadcast } from '../../services/broadcastService.js';
import { bot } from '../../bot.js';
import { resetState } from '../../utils/helpers.js';
import { toMainMenuKeyboard } from '../../keyboards/common.js';

export async function handleAdminInput(ctx: MyContext): Promise<void> {
  const chatId = ctx.chat!.id;
  const text = ctx.msg?.text;
  if (!text) return;

  const state = ctx.session.state;

  switch (state.type) {
    case UserState.AWAITING_PRODUCT_PRICE: {
      const newPrice = parseFloat(text);
      if (isNaN(newPrice)) {
        await ctx.reply('Пожалуйста, введите корректную цену.');
        return;
      }

      const success = await updateProductPrice(state.productType!, state.product!.label, newPrice);

      if (success) {
        await ctx.reply(`Цена товара ${state.product!.label} изменена на ${newPrice}$.`, { reply_markup: toMainMenuKeyboard });
      }

      resetState(ctx);
      break;
    }

    case UserState.AWAITING_NEW_PRODUCT_LABEL: {
      ctx.session.state = {
        type: UserState.AWAITING_NEW_PRODUCT_PRICE,
        productType: state.productType!,
        newLabel: text,
      };

      await ctx.reply(`Введите цену для нового товара (${text}):`);
      break;
    }

    case UserState.AWAITING_NEW_PRODUCT_PRICE: {
      const newPrice = parseFloat(text);
      if (isNaN(newPrice)) {
        await ctx.reply('Пожалуйста, введите корректную цену');
        return;
      }

      await addProduct(state.productType!, {
        label: state.newLabel!,
        price: newPrice,
      });

      await ctx.reply(`Новый товар ${state.newLabel} добавлен по цене ${newPrice}$`, { reply_markup: toMainMenuKeyboard });

      resetState(ctx);
      break;
    }

    case UserState.AWAITING_CREDENTIALS: {
      await updatePaymentDetails(state.paymentMethod!, text);

      await ctx.reply(`✅ Реквизиты для ${state.paymentMethod} успешно обновлены!`, { reply_markup: toMainMenuKeyboard });

      resetState(ctx);
      break;
    }

    case UserState.AWAITING_USER_FOR_BALANCE: {
      const userId = text;
      const balance = getBalance(userId);

      ctx.session.state = {
        type: UserState.AWAITING_NEW_BALANCE,
        userIdForBalance: userId,
      };

      await ctx.reply(`Баланс пользователя ${balance}$. Введите новую сумму для баланса:`);
      break;
    }

    case UserState.AWAITING_NEW_BALANCE: {
      const newBalance = parseFloat(text);
      const userId = state.userIdForBalance!;

      if (isNaN(newBalance)) {
        await ctx.reply('Пожалуйста, введите корректную сумму.');
        return;
      }

      if (userExists(userId)) {
        await setBalance(userId, newBalance);
        await ctx.reply(`Баланс пользователя с ID ${userId} изменен на ${newBalance}$.`, { reply_markup: toMainMenuKeyboard });
      } else {
        await ctx.reply('Пользователя с таким ID нет.');
      }

      resetState(ctx);
      break;
    }

    case UserState.AWAITING_BROADCAST: {
      if (!text) {
        await ctx.reply('Сообщение не может быть пустым.');
        return;
      }

      await sendBroadcast(chatId, text);
      resetState(ctx);
      break;
    }

    case UserState.AWAITING_ADD_ADMIN: {
      const newAdminId = text;

      if (!userExists(newAdminId)) {
        await ctx.reply(`Пользователь с ID "${newAdminId}" не существует. Возможно, он не зарегистрирован в боте.`, {
          reply_markup: toMainMenuKeyboard,
        });
        return;
      }

      await addAdmin(newAdminId);

      await ctx.reply(`Пользователь с ID ${newAdminId} добавлен как администратор.`, { reply_markup: toMainMenuKeyboard });

      await bot.api.sendMessage(newAdminId, 'Вы были добавлены в качестве администратора.', { reply_markup: toMainMenuKeyboard });

      resetState(ctx);
      break;
    }

    case UserState.AWAITING_REMOVE_ADMIN: {
      const adminId = text;
      const removed = await removeAdmin(adminId);

      if (removed) {
        await ctx.reply(`Пользователь с ID ${adminId} удален из списка администраторов.`, { reply_markup: toMainMenuKeyboard });

        await bot.api.sendMessage(adminId, 'Вы были удалены из списка администраторов.', { reply_markup: toMainMenuKeyboard });
      } else {
        await ctx.reply('Нельзя удалить главного администратора.', {
          reply_markup: toMainMenuKeyboard,
        });
      }

      resetState(ctx);
      break;
    }

    case UserState.AWAITING_CODES: {
      const codes = text
        .split('\n')
        .map(c => c.trim())
        .filter(c => c.length > 0);

      const productLabel = state.productLabel!;
      await addCodes(productLabel, codes);

      await ctx.reply(`✅ Добавлено ${codes.length} кодов для ${productLabel} UC`, { reply_markup: toMainMenuKeyboard });

      resetState(ctx);
      break;
    }
  }
}
