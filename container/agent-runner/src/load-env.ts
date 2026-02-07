import fs from 'fs';

export function loadContainerEnv(): void {
  const envPath = '/workspace/env-dir/env';
  try {
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const lines = envContent.split('\n');
      let loadedCount = 0;
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.slice(0, eqIndex).trim();
          const value = trimmed.slice(eqIndex + 1).trim();
          process.env[key] = value;
          loadedCount++;
        }
      }
      console.error('[agent-runner] Loaded ' + loadedCount + ' env vars from ' + envPath);
    } else {
      console.error('[agent-runner] No env file found at ' + envPath);
    }
  } catch (err) {
    console.error(
      '[agent-runner] Failed to load env: ' + (err instanceof Error ? err.message : String(err))
    );
  }
}
