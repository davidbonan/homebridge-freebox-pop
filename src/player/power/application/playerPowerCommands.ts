import { retried } from '../../connection/domain/retriedCommand.ts';
import type { CommandRun, RetryPolicy } from '../../connection/domain/retriedCommand.ts';
import type { Player } from '../../connection/domain/player.ts';
import { putToSleep, wakeUp } from '../domain/playerPower.ts';

export interface PowerPolicy extends RetryPolicy {
  connectTimeoutMs: number;
  powerTimeoutMs: number;
}

export const defaultPowerPolicy: PowerPolicy = {
  attempts: 4,
  retryDelayMs: 2_000,
  connectTimeoutMs: 20_000,
  powerTimeoutMs: 15_000,
};

export function turnPlayerOn(player: Player, run: CommandRun, policy: PowerPolicy = defaultPowerPolicy): Promise<void> {
  return retried(async () => void (await wakeUp(player, { ...policy, signal: run.signal })), run, policy);
}

export function turnPlayerOff(player: Player, run: CommandRun, policy: PowerPolicy = defaultPowerPolicy): Promise<void> {
  return retried(() => putToSleep(player, { ...policy, signal: run.signal }), run, policy);
}
