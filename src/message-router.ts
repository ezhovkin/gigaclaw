import path from 'path';

import {
  ASSISTANT_NAME,
  DATA_DIR,
  MAIN_GROUP_FOLDER,
  MESSAGE_PREFIX,
  TRIGGER_PATTERN,
} from './config.js';
import { runContainerAgent, writeGroupsSnapshot, writeTasksSnapshot } from './container-runner.js';
import type { AvailableGroup } from './container-runner.js';
import { getAllChats, getAllTasks, getMessagesSince } from './db.js';
import { logger } from './logger.js';
import { sendTelegramResponse, sendTypingAction } from './telegram.js';
import type { NewMessage, RegisteredGroup } from './types.js';
import { saveJson } from './utils.js';
import { lastAgentTimestamp, registeredGroups, sessions, saveState } from './state.js';

function getAvailableGroups(): AvailableGroup[] {
  const chats = getAllChats();
  const registeredJids = new Set(Object.keys(registeredGroups));

  return chats.map((c) => ({
    jid: c.jid,
    name: c.name,
    lastActivity: c.last_message_time,
    isRegistered: registeredJids.has(c.jid),
  }));
}

export async function sendMessage(jid: string, text: string): Promise<void> {
  if (jid.startsWith('telegram@chat:')) {
    const chatIdStr = jid.split(':')[1];
    if (!chatIdStr) {
      logger.warn({ jid }, 'Invalid Telegram JID format');
      return;
    }
    const chatId = parseInt(chatIdStr, 10);
    if (Number.isNaN(chatId)) {
      logger.warn({ jid }, 'Invalid Telegram chat ID (not a number)');
      return;
    }
    await sendTelegramResponse(chatId, text);
    return;
  }

  logger.warn({ jid }, 'Cannot send message: unsupported JID format');
}

export async function processMessage(msg: NewMessage): Promise<void> {
  logger.info(
    {
      id: msg.id,
      chatJid: msg.chat_jid,
      sender: msg.sender,
      contentLength: msg.content.length,
    },
    'Message received'
  );

  const group = registeredGroups[msg.chat_jid];
  if (!group) {
    logger.warn({ chatJid: msg.chat_jid }, 'No registered group for chat');
    return;
  }

  const content = msg.content.trim();
  const isMainGroup = group.folder === MAIN_GROUP_FOLDER;

  // Main group responds to all messages; other groups require trigger prefix
  if (!isMainGroup && !TRIGGER_PATTERN.test(content)) {
    return;
  }

  // Get all messages since last agent interaction so the session has full context
  const sinceTimestamp = lastAgentTimestamp[msg.chat_jid] || '';

  const missedMessages = getMessagesSince(msg.chat_jid, sinceTimestamp, ASSISTANT_NAME);

  const lines = missedMessages.map((m) => {
    const escapeXml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    return `<message sender="${escapeXml(m.sender_name)}" time="${m.timestamp}">${escapeXml(m.content)}</message>`;
  });
  const prompt = `<messages>\n${lines.join('\n')}\n</messages>`;

  if (!prompt) {
    return;
  }

  logger.info({ group: group.name, messageCount: missedMessages.length }, 'Processing message');

  // Send typing indicator
  if (msg.chat_jid.startsWith('telegram@chat:')) {
    const chatId = parseInt(msg.chat_jid.replace('telegram@chat:', ''), 10);
    await sendTypingAction(chatId);
  }

  const response = await runAgent(group, prompt, msg.chat_jid);

  if (response) {
    lastAgentTimestamp[msg.chat_jid] = msg.timestamp;
    saveState();

    await sendMessage(msg.chat_jid, `${MESSAGE_PREFIX}${ASSISTANT_NAME}: ${response}`);
  }
}

async function runAgent(
  group: RegisteredGroup,
  prompt: string,
  chatJid: string
): Promise<string | null> {
  const isMain = group.folder === MAIN_GROUP_FOLDER;
  const sessionId = sessions[group.folder];

  // Update tasks snapshot for container to read (filtered by group)
  const tasks = getAllTasks();
  writeTasksSnapshot(
    group.folder,
    isMain,
    tasks.map((t) => ({
      id: t.id,
      group_folder: t.group_folder,
      prompt: t.prompt,
      schedule_type: t.schedule_type,
      schedule_value: t.schedule_value,
      status: t.status,
      next_run: t.next_run,
    }))
  );

  // Update available groups snapshot (main group only can see all groups)
  const availableGroups = getAvailableGroups();
  writeGroupsSnapshot(group.folder, isMain, availableGroups);

  try {
    const output = await runContainerAgent(group, {
      prompt,
      sessionId,
      groupFolder: group.folder,
      chatJid,
      isMain,
    });

    if (output.newSessionId) {
      sessions[group.folder] = output.newSessionId;
      saveJson(path.join(DATA_DIR, 'sessions.json'), sessions);
    }

    if (output.status === 'error') {
      logger.error({ group: group.name, error: output.error }, 'Container agent error');
      return null;
    }

    return output.result;
  } catch (err) {
    logger.error({ group: group.name, err }, 'Agent error');
    return null;
  }
}
