import type { NextFunction } from 'grammy';
import type { MyContext } from '../types/context.js';

let initialized = false;

export function setInitialized(value: boolean): void {
  initialized = value;
}

export function isInitialized(): boolean {
  return initialized;
}

export async function initializationMiddleware(ctx: MyContext, next: NextFunction): Promise<void> {
  if (!initialized) {
    if (ctx.chat) {
      await ctx.reply('⏳ Бот запускается, пожалуйста, подождите...');
    }
    return;
  }
  await next();
}
