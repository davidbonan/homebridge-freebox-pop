import type { Player, PlayerState } from '../../connection/domain/player.ts';

export interface PowerWait {
  connectTimeoutMs: number;
  powerTimeoutMs: number;
  signal: AbortSignal;
}

export async function wakeUp(player: Player, wait: PowerWait): Promise<{ wasAsleep: boolean }> {
  const hasToggled = await togglePowerUnless(player, (state) => state.isPowered, wait);
  return { wasAsleep: hasToggled };
}

export async function putToSleep(player: Player, wait: PowerWait): Promise<void> {
  await togglePowerUnless(player, (state) => !state.isPowered, wait);
}

async function togglePowerUnless(
  player: Player,
  isReached: (state: PlayerState) => boolean,
  { connectTimeoutMs, powerTimeoutMs, signal }: PowerWait,
): Promise<boolean> {
  const isReady = (state: PlayerState) => state.isReady;
  await player.waitUntil(isReady, { timeoutMs: connectTimeoutMs, signal, failure: 'player unreachable' });
  if (isReached(player.state())) return false;

  await player.pressPower();
  await player.waitUntil(isReached, { timeoutMs: powerTimeoutMs, signal, failure: 'player did not change power state' });
  return true;
}
