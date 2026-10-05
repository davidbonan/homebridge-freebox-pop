import { OQEE_APP } from '../../../src/channels/watching/domain/oqee.ts';
import { PlayerTimeout, PlayerUnreachable } from '../../../src/channels/watching/domain/player.ts';
import type { Player, PlayerState } from '../../../src/channels/watching/domain/player.ts';
import type { WatchPolicy, WatchRequest } from '../../../src/channels/watching/application/watchChannel.ts';

export const TF1 = 536;
export const TF1_LINK = 'https://oq.ee/channel/536/play';

export const instantPolicy: WatchPolicy = {
  attempts: 3,
  retryDelayMs: 0,
  connectTimeoutMs: 0,
  wakeTimeoutMs: 0,
  settleAfterWakeMs: 0,
  launchTimeoutMs: 0,
};

export function watchTf1(): WatchRequest {
  return { channelId: TF1, signal: new AbortController().signal, onAttemptFailed: () => {} };
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

  async waitUntil(isReached: (state: PlayerState) => boolean): Promise<void> {
    if (!isReached(this.current)) throw new PlayerTimeout();
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
