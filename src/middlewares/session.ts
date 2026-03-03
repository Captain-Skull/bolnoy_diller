import { session } from 'grammy';
import type { MyContext, SessionData } from '../types/context.js';
import { UserState } from '../types/enums.js';

export function createSessionMiddleware() {
  return session<SessionData, MyContext>({
    initial: (): SessionData => ({
      state: { type: UserState.DEFAULT },
      cart: { items: [], total: 0 },
    }),
  });
}
