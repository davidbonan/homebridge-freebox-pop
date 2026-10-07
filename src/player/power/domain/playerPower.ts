import type { Player, PlayerState } from '../../connection/domain/player.ts';

export interface PowerWait {
  connectTimeoutMs: number;
  powerTimeoutMs: number;
  signal: AbortSignal;
}

const UNINTERRUPTED = new AbortController().signal;

export function wakeUp(player: Player, wait: PowerWait): Promise<void> {
  return togglePowerUnless(player, (state) => state.isPowered, wait);
}

export function putToSleep(player: Player, wait: PowerWait): Promise<void> {
  return togglePowerUnless(player, (state) => !state.isPowered, wait);
}

async function togglePowerUnless(
  player: Player,
  isReached: (state: PlayerState) => boolean,
  { connectTimeoutMs, powerTimeoutMs, signal }: PowerWait,
): Promise<void> {
  const isReady = (state: PlayerState) => state.isReady;
  await player.waitUntil(isReady, { timeoutMs: connectTimeoutMs, signal, failure: 'player unreachable' });
  if (isReached(player.state())) return;

  await player.pressKey('power');
  // POWER is a toggle: whoever takes over before the new state is reported would press it back
  await player.waitUntil(isReached, {
    timeoutMs: powerTimeoutMs,
    signal: UNINTERRUPTED,
    failure: 'player did not change power state',
  });
  signal.throwIfAborted();
}
