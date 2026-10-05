import { OQEE_APP } from '../../src/channels/watching/domain/oqee.ts';
import { PlayerTimeout, PlayerUnreachable } from '../../src/player/connection/domain/player.ts';
import type { Player, PlayerState, Wait } from '../../src/player/connection/domain/player.ts';
import type { CommandRun } from '../../src/player/connection/domain/retriedCommand.ts';

const instantRetries = { attempts: 3, retryDelayMs: 0 };
export const instantPower = { ...instantRetries, connectTimeoutMs: 0, powerTimeoutMs: 0 };

export function commandRun(): CommandRun {
  return { signal: new AbortController().signal, onAttemptFailed: () => {} };
}

interface FakePlayerSetup {
  isPowered: boolean;
  failedLinkWrites?: number;
  opensOqee?: boolean;
}

export class FakePlayer implements Player {
  readonly commands: string[] = [];
  private current: PlayerState;
  private failedLinkWritesLeft: number;
  private readonly opensOqee: boolean;

  constructor({ isPowered, failedLinkWrites = 0, opensOqee = true }: FakePlayerSetup) {
    this.current = { isReady: true, isPowered, foregroundApp: undefined };
    this.failedLinkWritesLeft = failedLinkWrites;
    this.opensOqee = opensOqee;
  }

  state(): PlayerState {
    return this.current;
  }

  onStateChange(): void {}

  async waitUntil(isReached: (state: PlayerState) => boolean, { failure }: Wait): Promise<void> {
    if (!isReached(this.current)) throw new PlayerTimeout(failure);
  }

  async pressPower(): Promise<void> {
    this.commands.push('power');
    this.current = { ...this.current, isPowered: !this.current.isPowered };
  }

  async openLink(link: string): Promise<void> {
    if (this.failedLinkWritesLeft-- > 0) throw new PlayerUnreachable();
    this.commands.push(link);
    if (this.opensOqee) this.current = { ...this.current, foregroundApp: OQEE_APP };
  }
}
