import { Bot, Context } from 'grammy';
import type { NewMessage } from './types.js';
import { logger } from './logger.js';
import { storeChatMetadata, storeNewMessage } from './db.js';
import { TELEGRAM_BOT_TOKEN, TELEGRAM_ALLOWED_USER_IDS } from './config.js';

let bot: Bot | null = null;

/**
 * Initialize Telegram bot.
 * Returns null if Telegram is not configured.
 */
export function initTelegramBot(): Bot | null {
  if (!TELEGRAM_BOT_TOKEN) {
    logger.info('Telegram bot token not configured - Telegram disabled');
    return null;
  }

  try {
    bot = new Bot(TELEGRAM_BOT_TOKEN);
    logger.info('Telegram bot initialized');
    return bot;
  } catch (err) {
    logger.error({ err }, 'Failed to initialize Telegram bot');
    return null;
  }
}

/**
 * Convert Telegram message to NewMessage format.
 */
function telegramToNewMessage(ctx: Context): NewMessage {
  const msg = ctx.message;
  if (!msg) throw new Error('telegramToNewMessage called without message');
  const from = msg.from;
  if (!from) throw new Error('telegramToNewMessage called without from');

  return {
    id: `telegram_${msg.message_id}`,
    chat_jid: `telegram@chat:${msg.chat.id}`,
    sender: `${from.id}`,
    sender_name: from.username || from.first_name || from.last_name || 'Unknown',
    content: msg.text || '',
    timestamp: new Date(msg.date * 1000).toISOString(),
  };
}

/**
 * Start Telegram message loop with long polling.
 * Processes incoming messages through the provided callback.
 */
export async function startTelegramLoop(
  onMessage: (msg: NewMessage) => Promise<void>
): Promise<void> {
  if (!bot) {
    logger.warn('Cannot start Telegram loop - bot not initialized');
    return;
  }

  // Middleware to check authorization
  bot.use((ctx, next) => {
    const msg = ctx.message;

    if (!msg) {
      return next();
    }

    const userId = msg.from?.id;

    if (!userId) {
      logger.warn('Message without user ID - rejecting');
      return;
    }

    if (!TELEGRAM_ALLOWED_USER_IDS.includes(userId)) {
      logger.warn({ userId }, 'Unauthorized user - message rejected');
      return;
    }

    return next();
  });

  // Message handler
  bot.on('message:text', async (ctx) => {
    const msg = ctx.message;
    if (!msg) return;
    const userId = msg.from?.id;

    logger.info({ userId, chatId: msg.chat.id }, 'Telegram message received');

    try {
      const newMessage = telegramToNewMessage(ctx);

      // Store chat metadata first (required for foreign key constraint)
      storeChatMetadata(newMessage.chat_jid, newMessage.timestamp, 'telegram');

      // Store message in database before processing
      storeNewMessage(newMessage);

      await onMessage(newMessage);
    } catch (err) {
      logger.error({ err, userId }, 'Error processing Telegram message');
    }
  });

  logger.info('Starting Telegram polling...');

  if (!bot) {
    logger.error('Bot is null, cannot start polling');
    return;
  }
  // Use local variable to avoid TypeScript null check in closure
  const botClient = bot;
  await botClient.init();

  // Manual polling loop with offset tracking (sequential)
  let offset = 0;

  const poll = async () => {
    try {
      // Use timeout to long-poll, offset to track processed updates
      const updates = await botClient.api.getUpdates({ offset, timeout: 10 });
      for (const update of updates) {
        await botClient.handleUpdate(update);
        // Update offset to next update_id
        offset = update.update_id + 1;
      }
    } catch (err) {
      logger.error({ err }, 'Polling error');
      // Wait before retrying on error
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    // Continue polling (sequential, not concurrent)
    poll();
  };

  // Start polling in background
  poll();
}

/**
 * Send response message to Telegram chat.
 */
export async function sendTelegramResponse(chatId: number, text: string): Promise<void> {
  if (!bot) {
    logger.warn('Cannot send Telegram message - bot not initialized');
    return;
  }

  try {
    await bot.api.sendMessage(chatId, text);
    logger.info({ chatId, length: text.length }, 'Telegram message sent');
  } catch (err) {
    logger.error({ err, chatId }, 'Failed to send Telegram message');
  }
}

/**
 * Stop Telegram bot.
 */
export function stopTelegramBot(): void {
  if (bot) {
    bot.stop();
    bot = null;
    logger.info('Telegram bot stopped');
  }
}

/**
 * Send typing indicator to Telegram chat.
 */
export async function sendTypingAction(chatId: number): Promise<void> {
  if (!bot) return;
  try {
    await bot.api.sendChatAction(chatId, 'typing');
  } catch (error) {
    logger.debug({ err: error, chatId }, 'Failed to send typing action');
  }
}
