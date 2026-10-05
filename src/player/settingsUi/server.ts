import { HomebridgePluginUiServer, RequestError } from '@homebridge/plugin-ui-utils';
import { readPairedPlayer, writePairedPlayer } from '../pairedPlayerFile.ts';
import { discoverPlayers } from '../discovery/playerDiscovery.ts';
import { requestPairingCode } from '../pairing/playerPairing.ts';
import type { PendingPairing } from '../pairing/playerPairing.ts';

const DISCOVERY_MS = 3_000;

class PlayerSettingsServer extends HomebridgePluginUiServer {
  private pendingPairing: { host: string; pairing: PendingPairing } | undefined;

  constructor() {
    super();
    this.onRequest('/players/discover', () => discoverPlayers(DISCOVERY_MS));
    this.onRequest('/pairing/paired-host', () => this.pairedHost());
    this.onRequest('/pairing/request-code', ({ host }: { host: string }) => this.requestCode(host));
    this.onRequest('/pairing/confirm', ({ code }: { code: string }) => this.confirmCode(code));
    this.onRequest('/pairing/cancel', () => this.cancelPairing());
    this.ready();
  }

  private async pairedHost(): Promise<string | null> {
    return (await readPairedPlayer(this.storagePath()))?.host ?? null;
  }

  private async requestCode(host: string): Promise<void> {
    this.cancelPairing();
    this.pendingPairing = { host, pairing: await requestPairingCode(host).catch(asRequestError) };
  }

  private async confirmCode(code: string): Promise<void> {
    if (!this.pendingPairing) throw new RequestError('No pairing in progress, start again', {});
    const { host, pairing } = this.pendingPairing;
    const credentials = await pairing
      .confirm(code.trim())
      .catch(asRequestError)
      .finally(() => this.cancelPairing());
    await writePairedPlayer(this.storagePath(), { host, credentials });
  }

  private cancelPairing(): void {
    this.pendingPairing?.pairing.cancel();
    this.pendingPairing = undefined;
  }

  private storagePath(): string {
    const storagePath = this.homebridgeStoragePath;
    if (!storagePath) throw new RequestError('Homebridge storage path is unknown', {});
    return storagePath;
  }
}

function asRequestError(error: unknown): never {
  throw new RequestError(error instanceof Error ? error.message : String(error), {});
}

new PlayerSettingsServer();
