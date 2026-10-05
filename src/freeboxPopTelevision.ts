import type { Characteristic, CharacteristicValue, HAP, Logging, PlatformAccessory, Service } from 'homebridge';
import type { ChannelConfig } from './channels/channelConfig.ts';
import { watchChannel } from './channels/watching/application/watchChannel.ts';
import type { Player, PlayerKey } from './player/connection/domain/player.ts';
import type { CommandRun } from './player/connection/domain/retriedCommand.ts';
import { turnPlayerOff, turnPlayerOn } from './player/power/application/playerPowerCommands.ts';

export interface TelevisionControls {
  player: Player;
  channels: ChannelConfig[];
  log: Logging;
  runCommand(name: string, command: (run: CommandRun) => Promise<void>): Promise<void>;
}

export function addTelevisionServices(accessory: PlatformAccessory, hap: HAP, controls: TelevisionControls): void {
  const { Service, Characteristic } = hap;
  const name = accessory.displayName;
  const television = accessory.addService(Service.Television, name);

  television.setCharacteristic(Characteristic.ConfiguredName, name);
  television.setCharacteristic(Characteristic.SleepDiscoveryMode, Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE);
  followPower(television, hap, controls);
  tuneSelectedChannel(television, hap, controls);
  relayKeys(television.getCharacteristic(Characteristic.RemoteKey), navigationKeys(hap), controls);

  television.addLinkedService(volumeService(accessory, hap, controls));
  for (const channel of controls.channels) television.addLinkedService(channelInput(accessory, hap, channel));
}

function followPower(television: Service, { Characteristic }: HAP, { player, runCommand }: TelevisionControls): void {
  const { ACTIVE, INACTIVE } = Characteristic.Active;
  const active = television.getCharacteristic(Characteristic.Active);
  const shown = () => (player.state().isPowered ? ACTIVE : INACTIVE);

  active.updateValue(shown());
  player.onStateChange(() => active.updateValue(shown()));
  active.onSet(async (requested) => {
    const switchPower = (run: CommandRun) => (requested === ACTIVE ? turnPlayerOn(player, run) : turnPlayerOff(player, run));
    void runCommand(television.displayName, switchPower).finally(() => active.updateValue(shown()));
  });
}

function tuneSelectedChannel(television: Service, { Characteristic }: HAP, controls: TelevisionControls): void {
  const { player, channels, runCommand } = controls;
  const channelsByIdentifier = new Map<CharacteristicValue, ChannelConfig>(
    channels.map((channel) => [channel.oqeeChannelId, channel]),
  );

  television.getCharacteristic(Characteristic.ActiveIdentifier).onSet(async (identifier) => {
    const channel = channelsByIdentifier.get(identifier);
    if (!channel) return;
    void runCommand(channel.name, (run) => watchChannel(player, { ...run, channelId: channel.oqeeChannelId }));
  });
}

function relayKeys(pressed: Characteristic, keys: Map<CharacteristicValue, PlayerKey>, controls: TelevisionControls): void {
  const { player, log } = controls;

  pressed.onSet(async (value) => {
    const key = keys.get(value);
    if (!key) return;
    await player.pressKey(key).catch((error: unknown) => log.warn(`Key ${key} not sent`, error));
  });
}

function navigationKeys({ Characteristic }: HAP): Map<CharacteristicValue, PlayerKey> {
  const { RemoteKey } = Characteristic;
  return new Map([
    [RemoteKey.ARROW_UP, 'up'],
    [RemoteKey.ARROW_DOWN, 'down'],
    [RemoteKey.ARROW_LEFT, 'left'],
    [RemoteKey.ARROW_RIGHT, 'right'],
    [RemoteKey.SELECT, 'select'],
    [RemoteKey.BACK, 'back'],
    [RemoteKey.EXIT, 'back'],
    [RemoteKey.PLAY_PAUSE, 'playPause'],
    [RemoteKey.INFORMATION, 'info'],
    [RemoteKey.REWIND, 'rewind'],
    [RemoteKey.FAST_FORWARD, 'fastForward'],
    [RemoteKey.NEXT_TRACK, 'next'],
    [RemoteKey.PREVIOUS_TRACK, 'previous'],
  ]);
}

function volumeService(accessory: PlatformAccessory, hap: HAP, controls: TelevisionControls): Service {
  const { Service, Characteristic } = hap;
  const { VolumeSelector } = Characteristic;
  const volume = accessory.addService(Service.TelevisionSpeaker, `${accessory.displayName} volume`);
  const volumeKeys = new Map<CharacteristicValue, PlayerKey>([
    [VolumeSelector.INCREMENT, 'volumeUp'],
    [VolumeSelector.DECREMENT, 'volumeDown'],
  ]);

  volume.setCharacteristic(Characteristic.Active, Characteristic.Active.ACTIVE);
  volume.setCharacteristic(Characteristic.VolumeControlType, Characteristic.VolumeControlType.RELATIVE);
  relayKeys(volume.getCharacteristic(VolumeSelector), volumeKeys, controls);
  return volume;
}

function channelInput(accessory: PlatformAccessory, { Service, Characteristic }: HAP, channel: ChannelConfig): Service {
  const input = accessory.addService(Service.InputSource, channel.name, `channel:${channel.oqeeChannelId}`);

  input.setCharacteristic(Characteristic.Identifier, channel.oqeeChannelId);
  input.setCharacteristic(Characteristic.ConfiguredName, channel.name);
  input.setCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED);
  input.setCharacteristic(Characteristic.InputSourceType, Characteristic.InputSourceType.APPLICATION);
  input.setCharacteristic(Characteristic.CurrentVisibilityState, Characteristic.CurrentVisibilityState.SHOWN);
  return input;
}
