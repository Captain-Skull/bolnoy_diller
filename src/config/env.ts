import 'dotenv/config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`❌ Missing required environment variable: ${name}`);
  }
  return value;
}

export const BOT_TOKEN = requireEnv('token');
export const ADMIN_CHAT_ID = requireEnv('ADMIN_CHAT_ID');
export const DEPOSIT_GROUP_ID = requireEnv('DEPOSIT_GROUP_ID');
export const ORDERS_GROUP_ID = requireEnv('ORDERS_GROUP_ID');
export const CRYPTOBOT_ID = requireEnv('CRYPTOBOT_ID');
