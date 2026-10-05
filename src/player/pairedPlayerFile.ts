import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface PlayerCredentials {
  key: string;
  cert: string;
}

export interface PairedPlayer {
  host: string;
  credentials: PlayerCredentials;
}

function pairedPlayerPath(storagePath: string): string {
  return path.join(storagePath, 'freebox-pop-player.json');
}

export async function readPairedPlayer(storagePath: string): Promise<PairedPlayer | undefined> {
  const json = await readFile(pairedPlayerPath(storagePath), 'utf8').catch(() => undefined);
  if (json === undefined) return undefined;
  const { host, credentials }: Partial<PairedPlayer> = JSON.parse(json);
  const { key, cert } = credentials ?? {};
  const isComplete = typeof host === 'string' && typeof key === 'string' && typeof cert === 'string';
  return isComplete ? { host, credentials: { key, cert } } : undefined;
}

export async function writePairedPlayer(storagePath: string, player: PairedPlayer): Promise<void> {
  await writeFile(pairedPlayerPath(storagePath), JSON.stringify(player), { mode: 0o600 });
}
