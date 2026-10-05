import type { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig } from 'homebridge';
import { readPairedPlayer } from '../../../player/pairedPlayerFile.ts';
import { watchChannel } from '../application/watchChannel.ts';
import type { Player } from '../domain/player.ts';
import { AndroidTvPlayer } from '../infrastructure/androidTvPlayer.ts';

export const PLUGIN_NAME = 'homebridge-freebox-pop';
export const PLATFORM_NAME = 'FreeboxPop';

interface ChannelConfig {
  name: string;
  oqeeChannelId: number;
}

interface FreeboxPopConfig extends PlatformConfig {
  channels?: ChannelConfig[];
}

export class ChannelSwitchPlatform implements DynamicPlatformPlugin {
  private readonly log: Logging;
  private readonly config: FreeboxPopConfig;
  private readonly api: API;
  private readonly restoredAccessories = new Map<string, PlatformAccessory>();
  private watchInProgress: AbortController | undefined;

  constructor(log: Logging, config: FreeboxPopConfig, api: API) {
    this.log = log;
    this.config = config;
    this.api = api;
    api.on('didFinishLaunching', () => void this.start());
  }

  configureAccessory(accessory: PlatformAccessory): void {
    this.restoredAccessories.set(accessory.UUID, accessory);
  }

  private async start(): Promise<void> {
    const pairedPlayer = await readPairedPlayer(this.api.user.storagePath());
    if (!pairedPlayer) return this.log.error('Not paired with a player yet: open the plugin settings to pair');

    const player = new AndroidTvPlayer(pairedPlayer.host, pairedPlayer.credentials, this.log);
    player.connect();
    this.api.on('shutdown', () => player.close());

    const accessories = (this.config.channels ?? []).map((channel) => this.exposeChannelSwitch(player, channel));
    this.unregisterAccessoriesNotIn(accessories);
  }

  private exposeChannelSwitch(player: Player, channel: ChannelConfig): PlatformAccessory {
    const { Service, Characteristic } = this.api.hap;
    const uuid = this.api.hap.uuid.generate(`${PLATFORM_NAME}:channel:${channel.oqeeChannelId}`);
    const accessory = this.restoredAccessories.get(uuid) ?? this.registerAccessory(channel.name, uuid);
    const service = accessory.getService(Service.Switch) ?? accessory.addService(Service.Switch, channel.name);
    const isWatching = service.getCharacteristic(Characteristic.On);

    isWatching.updateValue(false);
    isWatching.onSet((isOn) => {
      if (isOn) void this.watch(player, channel, isWatching);
      else this.watchInProgress?.abort();
    });
    return accessory;
  }

  private registerAccessory(name: string, uuid: string): PlatformAccessory {
    const accessory = new this.api.platformAccessory(name, uuid);
    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    return accessory;
  }

  private unregisterAccessoriesNotIn(accessories: PlatformAccessory[]): void {
    const stale = [...this.restoredAccessories.values()].filter((restored) => !accessories.includes(restored));
    this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, stale);
  }

  // answers HomeKit at once and tunes in the background: the sequence outlasts HomeKit's write timeout
  private async watch(player: Player, channel: ChannelConfig, isWatching: Characteristic): Promise<void> {
    this.watchInProgress?.abort();
    const watch = new AbortController();
    this.watchInProgress = watch;
    try {
      await watchChannel(player, {
        channelId: channel.oqeeChannelId,
        signal: watch.signal,
        onAttemptFailed: (attempt, error) => this.log.warn(`${channel.name}: attempt ${attempt} failed, retrying`, error),
      });
      this.log.info(`${channel.name}: playing`);
    } catch (error) {
      if (!watch.signal.aborted) this.log.error(`${channel.name}: gave up`, error);
    } finally {
      isWatching.updateValue(false);
    }
  }
}
