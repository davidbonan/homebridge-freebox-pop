import { EventEmitter, once } from 'node:events';
import { OQEE_APP } from '../../src/channels/watching/domain/oqee.ts';
import { PlayerTimeout, PlayerUnreachable } from '../../src/player/connection/domain/player.ts';
import type { Player, PlayerKey, PlayerState, Wait } from '../../src/player/connection/domain/player.ts';
import type { CommandRun } from '../../src/player/connection/domain/retriedCommand.ts';

const instantRetries = { attempts: 3, retryDelayMs: 0 };
export const instantPower = { ...instantRetries, connectTimeoutMs: 0, powerTimeoutMs: 0 };
const LONG_AGO = 0;

export function commandRun(signal: AbortSignal = new AbortController().signal): CommandRun {
  return { signal, onAttemptFailed: () => {} };
}

interface FakePlayerSetup {
  isPowered: boolean;
  failedLinkWrites?: number;
  opensOqee?: boolean;
  powerLagMs?: number;
}

export class FakePlayer implements Player {
  readonly commands: string[] = [];
  private readonly changes = new EventEmitter();
  private current: PlayerState;
  private failedLinkWritesLeft: number;
  private readonly opensOqee: boolean;
  private readonly powerLagMs: number;

  constructor({ isPowered, failedLinkWrites = 0, opensOqee = true, powerLagMs = 0 }: FakePlayerSetup) {
    this.current = { isReady: true, isPowered, foregroundApp: undefined, awakeSince: isPowered ? LONG_AGO : undefined };
    this.failedLinkWritesLeft = failedLinkWrites;
    this.opensOqee = opensOqee;
    this.powerLagMs = powerLagMs;
  }

  state(): PlayerState {
    return this.current;
  }

  onStateChange(): void {}

  async waitUntil(isReached: (state: PlayerState) => boolean, { timeoutMs, signal, failure }: Wait): Promise<void> {
    const timedOut = new AbortController();
    const timer = setTimeout(() => timedOut.abort(), timeoutMs);
    const stopped = AbortSignal.any([signal, timedOut.signal]);
    try {
      while (!isReached(this.current)) await once(this.changes, 'change', { signal: stopped });
    } catch {
      throw signal.aborted ? signal.reason : new PlayerTimeout(failure);
    } finally {
      clearTimeout(timer);
    }
  }

  async pressKey(key: PlayerKey): Promise<void> {
    this.commands.push(key);
    if (key !== 'power') return;
    if (this.powerLagMs === 0) return this.togglePower();
    setTimeout(() => this.togglePower(), this.powerLagMs);
  }

  async openLink(link: string): Promise<void> {
    if (this.failedLinkWritesLeft-- > 0) throw new PlayerUnreachable();
    this.commands.push(link);
    if (this.opensOqee) this.update({ ...this.current, foregroundApp: OQEE_APP });
  }

  private togglePower(): void {
    const isPowered = !this.current.isPowered;
    this.update({ ...this.current, isPowered, awakeSince: isPowered ? Date.now() : undefined });
  }

  private update(state: PlayerState): void {
    this.current = state;
    this.changes.emit('change');
  }
}
