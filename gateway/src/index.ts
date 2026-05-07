/**
 * EduClaw Gateway — Entry Point
 * Starts the Telegram bot and connects to the skills runtime.
 */

import 'dotenv/config';
import { TelegramAdapter } from './adapters/telegram.js';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SKILLS_RUNTIME_URL = `http://localhost:${process.env.SKILLS_RUNTIME_PORT || '8001'}`;

if (!TELEGRAM_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN is not set in .env');
  console.error('   Get one from @BotFather on Telegram: https://t.me/BotFather');
  process.exit(1);
}

console.log('🦞 EduClaw Gateway starting...');
console.log(`📡 Skills Runtime URL: ${SKILLS_RUNTIME_URL}`);

// Wait a moment for skills runtime to start
async function waitForSkillsRuntime(url: string, maxRetries: number = 10): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) {
        console.log('✅ Skills Runtime is healthy');
        return true;
      }
    } catch {
      console.log(`⏳ Waiting for Skills Runtime... (${i + 1}/${maxRetries})`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  console.warn('⚠️ Skills Runtime not reachable — bot will start but skill calls may fail');
  return false;
}

async function main() {
  await waitForSkillsRuntime(SKILLS_RUNTIME_URL);

  // Start Telegram adapter
  const telegram = new TelegramAdapter(TELEGRAM_TOKEN!, SKILLS_RUNTIME_URL);

  console.log('✅ EduClaw Gateway is running!');
  console.log('💬 Send /start to your Telegram bot to begin.');

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 EduClaw Gateway shutting down...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n👋 EduClaw Gateway shutting down...');
    process.exit(0);
  });
}

main().catch(console.error);
