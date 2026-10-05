import type { API } from 'homebridge';
import { ChannelSwitchPlatform, PLATFORM_NAME } from './channels/watching/ui/channelSwitchPlatform.ts';

export default (api: API): void => {
  api.registerPlatform(PLATFORM_NAME, ChannelSwitchPlatform);
};
