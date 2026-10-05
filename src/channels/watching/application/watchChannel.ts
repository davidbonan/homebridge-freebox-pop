import { setTimeout as sleep } from 'node:timers/promises';
import { OQEE_APP, oqeeChannelLink } from '../domain/oqee.ts';
import type { Player } from '../domain/player.ts';

export interface WatchRequest {
  channelId: number;
  signal: AbortSignal;
  onAttemptFailed: (attempt: number, error: unknown) => void;
}

export interface WatchPolicy {
  attempts: number;
  retryDelayMs: number;
  connectTimeoutMs: number;
  wakeTimeoutMs: number;
  settleAfterWakeMs: number;
  launchTimeoutMs: number;
}

export const defaultWatchPolicy: WatchPolicy = {
  attempts: 4,
  retryDelayMs: 2_000,
  connectTimeoutMs: 20_000,
  wakeTimeoutMs: 15_000,
  settleAfterWakeMs: 3_000,
  launchTimeoutMs: 15_000,
};

export async function watchChannel(
  player: Player,
  request: WatchRequest,
  policy: WatchPolicy = defaultWatchPolicy,
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await tuneOnce(player, request, policy);
    } catch (error) {
      if (request.signal.aborted || attempt >= policy.attempts) throw error;
      request.onAttemptFailed(attempt, error);
      await sleep(policy.retryDelayMs * attempt, undefined, { signal: request.signal });
    }
  }
}

async function tuneOnce(player: Player, request: WatchRequest, policy: WatchPolicy): Promise<void> {
  const { signal } = request;

  await player
    .waitUntil((state) => state.isReady, { timeoutMs: policy.connectTimeoutMs, signal })
    .catch(failAs('player unreachable'));

  if (!player.state().isPowered) await wake(player, request, policy);

  await player.openLink(oqeeChannelLink(request.channelId));
  await player
    .waitUntil((state) => state.foregroundApp === OQEE_APP, { timeoutMs: policy.launchTimeoutMs, signal })
    .catch(failAs('OQEE did not come to the foreground'));
}

async function wake(player: Player, { signal }: WatchRequest, policy: WatchPolicy): Promise<void> {
  await player.pressPower();
  await player
    .waitUntil((state) => state.isPowered, { timeoutMs: policy.wakeTimeoutMs, signal })
    .catch(failAs('player did not wake up'));
  await sleep(policy.settleAfterWakeMs, undefined, { signal });
}

function failAs(reason: string): (cause: unknown) => never {
  return (cause) => {
    throw new Error(reason, { cause });
  };
}
