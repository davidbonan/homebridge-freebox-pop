import type { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig } from 'homebridge';
import { watchChannel } from './channels/watching/application/watchChannel.ts';
import type { Player } from './player/connection/domain/player.ts';
import type { CommandRun } from './player/connection/domain/retriedCommand.ts';
import { AndroidTvPlayer } from './player/connection/infrastructure/androidTvPlayer.ts';
import { readPairedPlayer } from './player/pairedPlayerFile.ts';
import { turnPlayerOff, turnPlayerOn } from './player/power/application/playerPowerCommands.ts';

export const PLUGIN_NAME = 'homebridge-freebox-pop';
export const PLATFORM_NAME = 'FreeboxPop';
const POWER_SWITCH_NAME = 'Freebox Player';

interface ChannelConfig {
  name: string;
  oqeeChannelId: number;
}

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
  private commandInProgress: AbortController | undefined;

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

    const channelSwitches = (this.config.channels ?? []).map((channel) => this.exposeChannelSwitch(player, channel));
    this.unregisterAccessoriesNotIn([this.exposePowerSwitch(player), ...channelSwitches]);
  }

  private exposeChannelSwitch(player: Player, channel: ChannelConfig): PlatformAccessory {
    const { accessory, isOn } = this.switchAccessory(channel.name, `channel:${channel.oqeeChannelId}`);

    isOn.updateValue(false);
    isOn.onSet(async (isRequested) => {
      if (!isRequested) return this.commandInProgress?.abort();
      const watch = (run: CommandRun) => watchChannel(player, { ...run, channelId: channel.oqeeChannelId });
      void this.runCommand(channel.name, watch).finally(() => isOn.updateValue(false));
    });
    return accessory;
  }

  private exposePowerSwitch(player: Player): PlatformAccessory {
    const { accessory, isOn } = this.switchAccessory(POWER_SWITCH_NAME, 'power');

    isOn.updateValue(player.state().isPowered);
    player.onStateChange((state) => isOn.updateValue(state.isPowered));
    isOn.onSet(async (isRequested) => {
      const switchPower = (run: CommandRun) => (isRequested ? turnPlayerOn(player, run) : turnPlayerOff(player, run));
      void this.runCommand(POWER_SWITCH_NAME, switchPower).finally(() => isOn.updateValue(player.state().isPowered));
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
    this.commandInProgress?.abort();
    const inProgress = new AbortController();
    this.commandInProgress = inProgress;
    try {
      await command({
        signal: inProgress.signal,
        onAttemptFailed: (attempt, error) => this.log.warn(`${name}: attempt ${attempt} failed, retrying`, error),
      });
      this.log.info(`${name}: done`);
    } catch (error) {
      if (!inProgress.signal.aborted) this.log.error(`${name}: gave up`, error);
    }
  }
}
