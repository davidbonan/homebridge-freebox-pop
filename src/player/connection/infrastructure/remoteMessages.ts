import protobuf from 'protobufjs';
import type { PlayerKey } from '../domain/player.ts';

const RemoteMessage = protobuf.parse(`
  syntax = "proto3";

  message RemoteDeviceInfo {
    string model = 1;
    string vendor = 2;
    int32 unknown1 = 3;
    string unknown2 = 4;
    string package_name = 5;
    string app_version = 6;
  }
  message RemoteConfigure {
    int32 code1 = 1;
    RemoteDeviceInfo device_info = 2;
  }
  message RemoteSetActive {
    int32 active = 1;
  }
  message RemotePingRequest {
    int32 val1 = 1;
  }
  message RemotePingResponse {
    int32 val1 = 1;
  }
  message RemoteKeyInject {
    int32 key_code = 1;
    int32 direction = 2;
  }
  message RemoteAppInfo {
    string app_package = 12;
  }
  message RemoteImeKeyInject {
    RemoteAppInfo app_info = 1;
  }
  message RemoteStart {
    bool started = 1;
  }
  message RemoteAppLinkLaunchRequest {
    string app_link = 1;
  }
  message RemoteMessage {
    RemoteConfigure remote_configure = 1;
    RemoteSetActive remote_set_active = 2;
    RemotePingRequest remote_ping_request = 8;
    RemotePingResponse remote_ping_response = 9;
    RemoteKeyInject remote_key_inject = 10;
    RemoteImeKeyInject remote_ime_key_inject = 20;
    RemoteStart remote_start = 40;
    RemoteAppLinkLaunchRequest remote_app_link_launch_request = 90;
  }
`).root.lookupType('RemoteMessage');

const ACTIVE_FEATURES = 622;
const SHORT_PRESS = 3;
const KEY_CODES: Record<PlayerKey, number> = {
  back: 4,
  up: 19,
  down: 20,
  left: 21,
  right: 22,
  select: 23,
  volumeUp: 24,
  volumeDown: 25,
  power: 26,
  playPause: 85,
  next: 87,
  previous: 88,
  rewind: 89,
  fastForward: 90,
  info: 165,
};

export interface ReceivedRemoteMessage {
  remoteConfigure?: object;
  remoteSetActive?: object;
  remotePingRequest?: { val1?: number };
  remoteStart?: { started?: boolean };
  remoteImeKeyInject?: { appInfo?: { appPackage?: string } };
}

export function readRemoteMessage(frame: Uint8Array): ReceivedRemoteMessage {
  return RemoteMessage.decodeDelimited(frame).toJSON();
}

export function configureMessage(): Uint8Array {
  return encoded({
    remoteConfigure: {
      code1: ACTIVE_FEATURES,
      deviceInfo: {
        model: 'Homebridge',
        vendor: 'Homebridge',
        unknown1: 1,
        unknown2: '1',
        packageName: 'homebridge-freebox-pop',
        appVersion: '1.0.0',
      },
    },
  });
}

export function setActiveMessage(): Uint8Array {
  return encoded({ remoteSetActive: { active: ACTIVE_FEATURES } });
}

export function pingResponse(val1: number): Uint8Array {
  return encoded({ remotePingResponse: { val1 } });
}

export function keyPress(key: PlayerKey): Uint8Array {
  return encoded({ remoteKeyInject: { keyCode: KEY_CODES[key], direction: SHORT_PRESS } });
}

export function linkLaunch(link: string): Uint8Array {
  return encoded({ remoteAppLinkLaunchRequest: { appLink: link } });
}

function encoded(message: object): Uint8Array {
  return RemoteMessage.encodeDelimited(RemoteMessage.fromObject(message)).finish();
}
