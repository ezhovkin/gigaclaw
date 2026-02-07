import 'dotenv/config';
import { execSync } from 'child_process';

import { TELEGRAM_ENABLED } from './config.js';
import { closeDatabase, initDatabase } from './db.js';
import { startIpcWatcher, stopIpcWatcher } from './ipc-watcher.js';
import { logger } from './logger.js';
import { processMessage, sendMessage } from './message-router.js';
import { loadState, registeredGroups, saveState, sessions } from './state.js';
import { startSchedulerLoop, stopSchedulerLoop } from './task-scheduler.js';
import { initTelegramBot, startTelegramLoop, stopTelegramBot } from './telegram.js';

function ensureContainerSystemRunning(): void {
  if (process.platform === 'darwin') {
    try {
      execSync('container system status', { stdio: 'pipe' });
    } catch {
      try {
        execSync('container system start', { stdio: 'pipe', timeout: 30000 });
        logger.info('Apple Container system started');
      } catch (err) {
        logger.fatal({ err }, 'Apple Container system failed to start');
        throw new Error('Apple Container system is required but failed to start');
      }
    }
  } else {
    try {
      execSync('docker --version', { stdio: 'pipe' });
    } catch {
      throw new Error('Docker is required but not found');
    }
  }
}

async function main(): Promise<void> {
  ensureContainerSystemRunning();
  initDatabase();
  logger.info('Database initialized');
  loadState();

  if (TELEGRAM_ENABLED) {
    const bot = initTelegramBot();
    if (bot) {
      logger.info('Telegram bot initialized');
      startTelegramLoop(async (msg) => {
        await processMessage(msg);
      }).catch((err) => {
        logger.error({ err }, 'Telegram loop error');
      });
    }
  }

  startSchedulerLoop({
    sendMessage,
    registeredGroups: () => registeredGroups,
    getSessions: () => sessions,
  });
  startIpcWatcher();
}

function shutdown(signal: string): void {
  logger.info({ signal }, 'Shutting down GigaClaw...');
  stopTelegramBot();
  stopSchedulerLoop();
  stopIpcWatcher();
  saveState();
  closeDatabase();
  logger.info('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main().catch((err) => {
  logger.error({ err }, 'Failed to start GigaClaw');
  process.exit(1);
});
