import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface PlayerCredentials {
  key: string;
  cert: string;
}

export function credentialsPath(storagePath: string): string {
  return path.join(storagePath, 'freebox-pop-credentials.json');
}

export async function readCredentials(storagePath: string): Promise<PlayerCredentials | undefined> {
  const json = await readFile(credentialsPath(storagePath), 'utf8').catch(() => undefined);
  if (json === undefined) return undefined;
  const { key, cert }: Partial<PlayerCredentials> = JSON.parse(json);
  return typeof key === 'string' && typeof cert === 'string' ? { key, cert } : undefined;
}

export async function writeCredentials(storagePath: string, credentials: PlayerCredentials): Promise<void> {
  await writeFile(credentialsPath(storagePath), JSON.stringify(credentials), { mode: 0o600 });
}
