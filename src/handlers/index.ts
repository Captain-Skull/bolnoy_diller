import { Bot } from 'grammy';
import type { MyContext } from '../types/context.js';
import { registerStart } from './commands/start.js';
import { registerCallbacks } from './callbacks/index.js';
import { registerMessages } from './messages/index.js';

export function registerHandlers(bot: Bot<MyContext>): void {
  registerStart(bot);
  registerCallbacks(bot);
  registerMessages(bot);
}
