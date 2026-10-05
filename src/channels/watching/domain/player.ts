export interface PlayerState {
  isReady: boolean;
  isPowered: boolean;
  foregroundApp: string | undefined;
}

export interface Wait {
  timeoutMs: number;
  signal: AbortSignal;
}

export interface Player {
  state(): PlayerState;
  waitUntil(isReached: (state: PlayerState) => boolean, wait: Wait): Promise<void>;
  pressPower(): Promise<void>;
  openLink(link: string): Promise<void>;
}

export class PlayerTimeout extends Error {
  constructor() {
    super('player did not reach the expected state in time');
  }
}

export class PlayerUnreachable extends Error {
  constructor() {
    super('player is not connected');
  }
}
