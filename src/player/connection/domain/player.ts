export interface PlayerState {
  isReady: boolean;
  isPowered: boolean;
  foregroundApp: string | undefined;
}

export interface Wait {
  timeoutMs: number;
  signal: AbortSignal;
  failure: string;
}

export interface Player {
  state(): PlayerState;
  onStateChange(listener: (state: PlayerState) => void): void;
  waitUntil(isReached: (state: PlayerState) => boolean, wait: Wait): Promise<void>;
  pressPower(): Promise<void>;
  openLink(link: string): Promise<void>;
}

export class PlayerTimeout extends Error {}

export class PlayerUnreachable extends Error {
  constructor() {
    super('player is not connected');
  }
}
