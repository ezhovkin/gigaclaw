import fs from 'fs';
import path from 'path';

import { DATA_DIR } from './config.js';
import { logger } from './logger.js';
import type { RegisteredGroup, Session } from './types.js';
import { loadJson, saveJson } from './utils.js';

// Shared mutable state — exported objects are mutated in place,
// so all importers see the same data.
export const sessions: Session = {};
export const registeredGroups: Record<string, RegisteredGroup> = {};
export const lastAgentTimestamp: Record<string, string> = {};

export function loadState(): void {
  const statePath = path.join(DATA_DIR, 'router_state.json');
  const state = loadJson<{
    last_agent_timestamp?: Record<string, string>;
  }>(statePath, {});

  Object.assign(lastAgentTimestamp, state.last_agent_timestamp || {});
  Object.assign(sessions, loadJson(path.join(DATA_DIR, 'sessions.json'), {}));
  Object.assign(registeredGroups, loadJson(path.join(DATA_DIR, 'registered_groups.json'), {}));

  logger.info({ groupCount: Object.keys(registeredGroups).length }, 'State loaded');
}

export function saveState(): void {
  saveJson(path.join(DATA_DIR, 'router_state.json'), {
    last_agent_timestamp: lastAgentTimestamp,
  });
  saveJson(path.join(DATA_DIR, 'sessions.json'), sessions);
}

export function registerGroup(jid: string, group: RegisteredGroup): void {
  registeredGroups[jid] = group;
  saveJson(path.join(DATA_DIR, 'registered_groups.json'), registeredGroups);

  const groupDir = path.join(DATA_DIR, '..', 'groups', group.folder);
  fs.mkdirSync(path.join(groupDir, 'logs'), { recursive: true });

  logger.info({ jid, name: group.name, folder: group.folder }, 'Group registered');
}
