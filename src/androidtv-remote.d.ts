declare module 'androidtv-remote/dist/remote/RemoteMessageManager.js' {
  export interface RemoteMessage {
    remoteConfigure?: object | null;
    remoteSetActive?: object | null;
    remotePingRequest?: { val1: number } | null;
    remoteStart?: { started: boolean } | null;
    remoteImeKeyInject?: { appInfo?: { appPackage?: string | null } | null } | null;
  }

  type KeyCodeName =
    | 'KEYCODE_POWER'
    | 'KEYCODE_DPAD_UP'
    | 'KEYCODE_DPAD_DOWN'
    | 'KEYCODE_DPAD_LEFT'
    | 'KEYCODE_DPAD_RIGHT'
    | 'KEYCODE_DPAD_CENTER'
    | 'KEYCODE_BACK'
    | 'KEYCODE_MEDIA_PLAY_PAUSE'
    | 'KEYCODE_INFO'
    | 'KEYCODE_MEDIA_REWIND'
    | 'KEYCODE_MEDIA_FAST_FORWARD'
    | 'KEYCODE_MEDIA_NEXT'
    | 'KEYCODE_MEDIA_PREVIOUS'
    | 'KEYCODE_VOLUME_UP'
    | 'KEYCODE_VOLUME_DOWN';

  interface RemoteMessageManager {
    RemoteKeyCode: Record<KeyCodeName, number>;
    RemoteDirection: { SHORT: number };
    parse(frame: Uint8Array): RemoteMessage;
    createRemoteConfigure(): Uint8Array;
    createRemoteSetActive(features: number): Uint8Array;
    createRemotePingResponse(val1: number): Uint8Array;
    createRemoteKeyInject(direction: number, keyCode: number): Uint8Array;
    createRemoteRemoteAppLinkLaunchRequest(link: string): Uint8Array;
  }

  const exported: { remoteMessageManager: RemoteMessageManager };
  export default exported;
}

declare module 'androidtv-remote/dist/pairing/PairingManager.js' {
  import type { EventEmitter } from 'node:events';

  class PairingManager extends EventEmitter {
    constructor(host: string, port: number, credentials: { key: string; cert: string }, serviceName: string);
    start(): Promise<boolean>;
    sendCode(code: string): boolean;
    client?: { destroy(): void };
  }

  const exported: { PairingManager: typeof PairingManager };
  export default exported;
}

declare module 'androidtv-remote/dist/certificate/CertificateGenerator.js' {
  interface CertificateGenerator {
    generateFull(
      name: string,
      country: string,
      state: string,
      locality: string,
      organisation: string,
      unit: string,
    ): { key: string; cert: string };
  }

  const exported: { CertificateGenerator: CertificateGenerator };
  export default exported;
}
