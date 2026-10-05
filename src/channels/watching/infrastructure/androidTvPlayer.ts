import { EventEmitter } from 'node:events';
import tls from 'node:tls';
import remoteMessages from 'androidtv-remote/dist/remote/RemoteMessageManager.js';
import type { RemoteMessage } from 'androidtv-remote/dist/remote/RemoteMessageManager.js';
import type { Logging } from 'homebridge';
import type { PlayerCredentials } from '../../../player/pairedPlayerFile.ts';
import { PlayerTimeout, PlayerUnreachable } from '../domain/player.ts';
import type { Player, PlayerState, Wait } from '../domain/player.ts';
import { splitFrames } from './remoteMessageFrames.ts';

const { remoteMessageManager } = remoteMessages;

const REMOTE_PORT = 6466;
const ACTIVE_FEATURES = 622;
const SILENCE_LIMIT_MS = 15_000;
const RECONNECT_MIN_MS = 1_000;
const RECONNECT_MAX_MS = 10_000;
const UNREACHABLE: PlayerState = { isReady: false, isPowered: false, foregroundApp: undefined };

export class AndroidTvPlayer implements Player {
  private readonly host: string;
  private readonly credentials: PlayerCredentials;
  private readonly log: Logging;
  private readonly changes = new EventEmitter();
  private socket: tls.TLSSocket | undefined;
  private current = UNREACHABLE;
  private reconnectDelayMs = RECONNECT_MIN_MS;
  private reconnectTimer: NodeJS.Timeout | undefined;
  private isClosed = false;

  constructor(host: string, credentials: PlayerCredentials, log: Logging) {
    this.host = host;
    this.credentials = credentials;
    this.log = log;
  }

  connect(): void {
    // the player presents a self-signed certificate
    const socket = tls.connect({ host: this.host, port: REMOTE_PORT, ...this.credentials, rejectUnauthorized: false });
    this.socket = socket;
    let pending: Buffer = Buffer.alloc(0);

    // the player pings every 5 s, silence means a dead link
    socket.setTimeout(SILENCE_LIMIT_MS, () => socket.destroy(new Error('player went silent')));
    socket.on('data', (chunk) => {
      const { frames, rest } = splitFrames(Buffer.concat([pending, chunk]));
      pending = rest;
      this.receiveFrames(socket, frames);
    });
    socket.on('error', (error) => this.log.debug(`Player ${this.host}: ${error.message}`));
    socket.on('close', () => this.reconnectLater());
  }

  close(): void {
    this.isClosed = true;
    clearTimeout(this.reconnectTimer);
    this.socket?.destroy();
  }

  state(): PlayerState {
    return this.current;
  }

  waitUntil(isReached: (state: PlayerState) => boolean, { timeoutMs, signal }: Wait): Promise<void> {
    if (isReached(this.current)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const stopWaiting = () => {
        clearTimeout(timer);
        this.changes.off('change', onChange);
        signal.removeEventListener('abort', onAbort);
      };
      const onChange = () => {
        if (!isReached(this.current)) return;
        stopWaiting();
        resolve();
      };
      const onAbort = () => {
        stopWaiting();
        reject(signal.reason);
      };
      const timer = setTimeout(() => {
        stopWaiting();
        reject(new PlayerTimeout());
      }, timeoutMs);
      this.changes.on('change', onChange);
      signal.addEventListener('abort', onAbort);
    });
  }

  pressPower(): Promise<void> {
    const { RemoteDirection, RemoteKeyCode } = remoteMessageManager;
    return this.send(remoteMessageManager.createRemoteKeyInject(RemoteDirection.SHORT, RemoteKeyCode.KEYCODE_POWER));
  }

  openLink(link: string): Promise<void> {
    return this.send(remoteMessageManager.createRemoteRemoteAppLinkLaunchRequest(link));
  }

  private send(message: Uint8Array): Promise<void> {
    const socket = this.socket;
    if (!socket || !this.current.isReady) return Promise.reject(new PlayerUnreachable());
    return new Promise((resolve, reject) => {
      socket.write(message, (error) => (error ? reject(error) : resolve()));
    });
  }

  private receiveFrames(socket: tls.TLSSocket, frames: Buffer[]): void {
    try {
      for (const frame of frames) this.receive(socket, remoteMessageManager.parse(frame));
    } catch (error) {
      socket.destroy(new Error('unreadable message from player', { cause: error }));
    }
  }

  private receive(socket: tls.TLSSocket, message: RemoteMessage): void {
    if (message.remoteConfigure) {
      socket.write(remoteMessageManager.createRemoteConfigure());
    } else if (message.remoteSetActive) {
      socket.write(remoteMessageManager.createRemoteSetActive(ACTIVE_FEATURES));
    } else if (message.remotePingRequest) {
      socket.write(remoteMessageManager.createRemotePingResponse(message.remotePingRequest.val1));
    } else if (message.remoteStart) {
      this.markReady(message.remoteStart.started);
    } else if (message.remoteImeKeyInject) {
      const foregroundApp = message.remoteImeKeyInject.appInfo?.appPackage ?? undefined;
      this.update({ ...this.current, foregroundApp });
    }
  }

  // ready only once the power state is known: POWER is a toggle, sent blind it would switch a running player off
  private markReady(isPowered: boolean): void {
    if (!this.current.isReady) this.log.info(`Player ${this.host} connected`);
    this.reconnectDelayMs = RECONNECT_MIN_MS;
    this.update({ ...this.current, isReady: true, isPowered });
  }

  private reconnectLater(): void {
    if (this.current.isReady) this.log.warn(`Player ${this.host} connection lost, reconnecting`);
    this.update(UNREACHABLE);
    if (this.isClosed) return;
    this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectDelayMs);
    this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, RECONNECT_MAX_MS);
  }

  private update(state: PlayerState): void {
    this.current = state;
    this.changes.emit('change');
  }
}
