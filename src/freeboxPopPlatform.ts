import type { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig } from 'homebridge';
import type { ChannelConfig } from './channels/channelConfig.ts';
import { watchChannel } from './channels/watching/application/watchChannel.ts';
import { addTelevisionServices } from './freeboxPopTelevision.ts';
import { ExclusiveCommands } from './player/connection/domain/exclusiveCommands.ts';
import type { Player } from './player/connection/domain/player.ts';
import type { CommandRun } from './player/connection/domain/retriedCommand.ts';
import { AndroidTvPlayer } from './player/connection/infrastructure/androidTvPlayer.ts';
import { readPairedPlayer } from './player/pairedPlayerFile.ts';

export const PLUGIN_NAME = 'homebridge-freebox-pop';
export const PLATFORM_NAME = 'FreeboxPop';
const TELEVISION_NAME = 'Freebox Pop';
// hap's Categories.TV_SET_TOP_BOX, a const enum that cannot be read under verbatimModuleSyntax
const SET_TOP_BOX_CATEGORY = 35;

interface FreeboxPopConfig extends PlatformConfig {
  channels?: ChannelConfig[];
}

interface SwitchAccessory {
  accessory: PlatformAccessory;
  isOn: Characteristic;
}

export class FreeboxPopPlatform implements DynamicPlatformPlugin {
  private readonly log: Logging;
  private readonly config: FreeboxPopConfig;
  private readonly api: API;
  private readonly restoredAccessories = new Map<string, PlatformAccessory>();
  private readonly commands = new ExclusiveCommands();

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

    const channels = this.config.channels ?? [];
    const channelSwitches = channels.map((channel) => this.exposeChannelSwitch(player, channel));
    this.unregisterAccessoriesNotIn(channelSwitches);
    this.publishTelevision(player, channels);
  }

  // HomeKit accepts a television only as an accessory of its own, outside the bridge
  private publishTelevision(player: Player, channels: ChannelConfig[]): void {
    const id = this.api.hap.uuid.generate(`${PLATFORM_NAME}:television`);
    const accessory = new this.api.platformAccessory(TELEVISION_NAME, id, SET_TOP_BOX_CATEGORY);

    addTelevisionServices(accessory, this.api.hap, {
      player,
      channels,
      log: this.log,
      runCommand: (name, command) => this.runCommand(name, command),
    });
    this.api.publishExternalAccessories(PLUGIN_NAME, [accessory]);
  }

  private exposeChannelSwitch(player: Player, channel: ChannelConfig): PlatformAccessory {
    const { accessory, isOn } = this.switchAccessory(channel.name, `channel:${channel.oqeeChannelId}`);

    let latestSequence: Promise<void> | undefined;

    isOn.updateValue(false);
    isOn.onSet(async (isRequested) => {
      if (!isRequested) return this.commands.cancel(channel.name);
      const watch = (run: CommandRun) => watchChannel(player, { ...run, channelId: channel.oqeeChannelId });
      const sequence = this.runCommand(channel.name, watch);
      latestSequence = sequence;
      void sequence.finally(() => {
        if (latestSequence === sequence) isOn.updateValue(false);
      });
    });
    return accessory;
  }

  private switchAccessory(name: string, id: string): SwitchAccessory {
    const { Service, Characteristic } = this.api.hap;
    const uuid = this.api.hap.uuid.generate(`${PLATFORM_NAME}:${id}`);
    const accessory = this.restoredAccessories.get(uuid) ?? this.registerAccessory(name, uuid);
    const service = accessory.getService(Service.Switch) ?? accessory.addService(Service.Switch, name);
    return { accessory, isOn: service.getCharacteristic(Characteristic.On) };
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

  // answers HomeKit at once and works in the background: a command outlasts HomeKit's write timeout
  private async runCommand(name: string, command: (run: CommandRun) => Promise<void>): Promise<void> {
    const onAttemptFailed = (attempt: number, error: unknown) => this.log.warn(`${name}: attempt ${attempt} failed, retrying`, error);
    try {
      const outcome = await this.commands.run(name, (signal) => command({ signal, onAttemptFailed }));
      if (outcome === 'done') this.log.info(`${name}: done`);
    } catch (error) {
      this.log.error(`${name}: gave up`, error);
    }
  }
}
