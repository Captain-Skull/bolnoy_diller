import { IMAGES } from '../config/constants.js';
import { getBalance } from '../database/repo/userRepo.js';
import { profileKeyboard } from '../keyboards/profile.js';
import type { MyContext } from '../types/context.js';

export const sendProfileMessage = async (ctx: MyContext) => {
  const chatId = ctx.chat!.id;
  const messageId = ctx.msg!.message_id;

  const balance = getBalance(chatId);

  await ctx.api.editMessageMedia(
    chatId,
    messageId,
    {
      type: 'photo',
      media: IMAGES.welcome,
      caption: `<b>✦ Ваш профиль!\n` + `👤Пользователь: <code>${chatId}</code>\n` + `💳Баланс: <u>${balance}$</u></b>`,
      parse_mode: 'HTML',
    },
    { reply_markup: profileKeyboard },
  );
};
