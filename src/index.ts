import type { API } from 'homebridge';
import { FreeboxPopPlatform, PLATFORM_NAME } from './freeboxPopPlatform.ts';

export default (api: API): void => {
  api.registerPlatform(PLATFORM_NAME, FreeboxPopPlatform);
};
