import { isIPv4 } from 'node:net';
import { Bonjour } from 'bonjour-service';

const ANDROID_TV_REMOTE_SERVICE = 'androidtvremote2';

export interface DiscoveredPlayer {
  name: string;
  host: string;
}

export function discoverPlayers(searchMs: number): Promise<DiscoveredPlayer[]> {
  const bonjour = new Bonjour();
  const playersByHost = new Map<string, DiscoveredPlayer>();

  bonjour.find({ type: ANDROID_TV_REMOTE_SERVICE }, (service) => {
    const host = service.addresses?.find(isIPv4) ?? service.referer?.address;
    if (host) playersByHost.set(host, { name: service.name, host });
  });

  return new Promise((resolve) => {
    setTimeout(() => {
      bonjour.destroy();
      resolve([...playersByHost.values()]);
    }, searchMs);
  });
}
