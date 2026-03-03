import { initializeCache } from './database/init.js';
import { setInitialized } from './middlewares/initialization.js';
import { bot } from './bot.js';

async function main(): Promise<void> {
  console.log('📦 Loading data from Firebase...');
  await initializeCache();
  setInitialized(true);
  console.log('✅ Data loaded successfully');

  await bot.start({
    onStart: info => console.log(`🤖 Bot @${info.username} is running!`),
    drop_pending_updates: true,
    allowed_updates: ['message', 'callback_query'],
  });
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
