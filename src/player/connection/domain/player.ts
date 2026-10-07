export interface PlayerState {
  isReady: boolean;
  isPowered: boolean;
  foregroundApp: string | undefined;
  awakeSince: number | undefined;
}

export type PlayerKey =
  | 'power'
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'select'
  | 'back'
  | 'playPause'
  | 'info'
  | 'rewind'
  | 'fastForward'
  | 'next'
  | 'previous'
  | 'volumeUp'
  | 'volumeDown';

export interface Wait {
  timeoutMs: number;
  signal: AbortSignal;
  failure: string;
}

export interface Player {
  state(): PlayerState;
  onStateChange(listener: (state: PlayerState) => void): void;
  waitUntil(isReached: (state: PlayerState) => boolean, wait: Wait): Promise<void>;
  pressKey(key: PlayerKey): Promise<void>;
  openLink(link: string): Promise<void>;
}

export class PlayerTimeout extends Error {}

export class PlayerUnreachable extends Error {
  constructor() {
    super('player is not connected');
  }
}
