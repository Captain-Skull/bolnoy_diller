import { GrammyError } from 'grammy';
import { bot } from '../bot.js';
import { getAllUserIds } from '../database/repo/userRepo.js';
import { toMainMenuKeyboard } from '../keyboards/common.js';

export async function sendBroadcast(chatId: number, message: string): Promise<void> {
  const userIds = getAllUserIds();

  if (userIds.length === 0) {
    await bot.api.sendMessage(chatId, 'Нет пользователей для рассылки.');
    return;
  }

  let successCount = 0;

  for (const userId of userIds) {
    try {
      await bot.api.sendMessage(userId, message);
      successCount++;
    } catch (error) {
      if (error instanceof GrammyError && error.error_code === 429) {
        const retryAfter = error.parameters?.retry_after || 1;
        await new Promise(r => setTimeout(r, retryAfter * 1000));

        try {
          await bot.api.sendMessage(userId, message);
          successCount++;
        } catch (error) {
          console.error(error);
        }
      }
    }

    await new Promise(r => setTimeout(r, 100));
  }

  await bot.api.sendMessage(chatId, `Сообщение успешно отправлено ${successCount} пользователям.`, { reply_markup: toMainMenuKeyboard });
}
