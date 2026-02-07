import path from 'path';
import { z } from 'zod';

// --- Assistant ---

export const ASSISTANT_NAME = process.env.ASSISTANT_NAME || 'Neo';

export const TRIGGER_PATTERN = (() => {
  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^@${escapeRegex(ASSISTANT_NAME)}\\b`, 'i');
})();

// --- Paths ---

const PROJECT_ROOT = process.cwd();
const HOME_DIR = process.env.HOME || '/Users/user';

export const MOUNT_ALLOWLIST_PATH = path.join(
  HOME_DIR,
  '.config',
  'gigaclaw',
  'mount-allowlist.json'
);
export const STORE_DIR = path.resolve(PROJECT_ROOT, 'store');
export const GROUPS_DIR = path.resolve(PROJECT_ROOT, 'groups');
export const DATA_DIR = path.resolve(PROJECT_ROOT, 'data');
export const MAIN_GROUP_FOLDER = 'main';

// --- Container ---

export const CONTAINER_IMAGE = process.env.CONTAINER_IMAGE || 'gigaclaw-agent:latest';

const TimeoutSchema = z
  .number()
  .int()
  .positive()
  .max(3_600_000, 'Container timeout cannot exceed 1 hour');

export const CONTAINER_TIMEOUT = TimeoutSchema.parse(
  parseInt(process.env.CONTAINER_TIMEOUT || '300000', 10)
);

const FileSizeSchema = z
  .number()
  .int()
  .positive()
  .max(104_857_600, 'Max output size cannot exceed 100MB');

export const CONTAINER_MAX_OUTPUT_SIZE = FileSizeSchema.parse(
  parseInt(process.env.CONTAINER_MAX_OUTPUT_SIZE || '10485760', 10)
);

// --- Polling ---

export const POLL_INTERVAL = 2000;
export const SCHEDULER_POLL_INTERVAL = 60000;
export const IPC_POLL_INTERVAL = 1000;

// --- Timezone ---

export const TIMEZONE = process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;

// --- Telegram ---

const TelegramUserIdsSchema = z
  .string()
  .transform((val) => val.split(',').map((id) => parseInt(id.trim(), 10)))
  .pipe(z.array(z.number().int().positive()));

export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
export const TELEGRAM_ALLOWED_USER_IDS = process.env.TELEGRAM_ALLOWED_USER_IDS
  ? TelegramUserIdsSchema.parse(process.env.TELEGRAM_ALLOWED_USER_IDS)
  : [];
export const TELEGRAM_ENABLED = !!TELEGRAM_BOT_TOKEN;

// --- Messages ---

export const MESSAGE_PREFIX = process.env.MESSAGE_PREFIX || '';
