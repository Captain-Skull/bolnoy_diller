import type { MyContext } from '../types/context.js';
import { UserState } from '../types/enums.js';

export function safeRound(num: number): number {
  const stringNum = num.toFixed(10);
  const match = stringNum.match(/\.(\d{2})(9{4,})/);
  return match ? Number(stringNum.slice(0, match.index! + 3)) : num;
}

export function capitalizeFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function getUserTag(ctx: MyContext): string {
  const username = ctx.chat?.username ? `@${ctx.chat.username}` : ctx.chat?.first_name || 'Пользователь';
  return username;
}

export function resetState(ctx: MyContext): void {
  ctx.session.state = { type: UserState.DEFAULT };
  ctx.session.cart = { items: [], total: 0 };
}

export function generateOrderNumber(chatId: number): string {
  return Date.now().toString(36).toUpperCase() + chatId.toString().slice(-4);
}
