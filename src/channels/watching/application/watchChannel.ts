import { setTimeout as sleep } from 'node:timers/promises';
import type { Player } from '../../../player/connection/domain/player.ts';
import { retried } from '../../../player/connection/domain/retriedCommand.ts';
import type { CommandRun, RetryPolicy } from '../../../player/connection/domain/retriedCommand.ts';
import { wakeUp } from '../../../player/power/domain/playerPower.ts';
import { OQEE_APP, oqeeChannelLink } from '../domain/oqee.ts';

export interface WatchRequest extends CommandRun {
  channelId: number;
}

export interface WatchPolicy extends RetryPolicy {
  connectTimeoutMs: number;
  powerTimeoutMs: number;
  settleAfterWakeMs: number;
  resumeAfterWakeMs: number;
  launchTimeoutMs: number;
}

export const defaultWatchPolicy: WatchPolicy = {
  attempts: 4,
  retryDelayMs: 2_000,
  connectTimeoutMs: 20_000,
  powerTimeoutMs: 15_000,
  settleAfterWakeMs: 3_000,
  resumeAfterWakeMs: 10_000,
  launchTimeoutMs: 15_000,
};

export function watchChannel(
  player: Player,
  request: WatchRequest,
  policy: WatchPolicy = defaultWatchPolicy,
): Promise<void> {
  return retried(() => tuneOnce(player, request, policy), request, policy);
}

async function tuneOnce(player: Player, request: WatchRequest, policy: WatchPolicy): Promise<void> {
  const { signal } = request;
  const { wasAsleep } = await wakeUp(player, { ...policy, signal });
  if (!wasAsleep) return openChannel(player, request, policy);

  await sleep(policy.settleAfterWakeMs, undefined, { signal });
  await openChannel(player, request, policy);
  // OQEE resuming from standby goes back to its last channel and drops an early link
  await sleep(policy.resumeAfterWakeMs, undefined, { signal });
  await openChannel(player, request, policy);
}

async function openChannel(player: Player, { channelId, signal }: WatchRequest, policy: WatchPolicy): Promise<void> {
  await player.openLink(oqeeChannelLink(channelId));
  await player.waitUntil((state) => state.foregroundApp === OQEE_APP, {
    timeoutMs: policy.launchTimeoutMs,
    signal,
    failure: 'OQEE did not come to the foreground',
  });
}
