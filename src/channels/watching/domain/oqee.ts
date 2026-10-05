export const OQEE_APP = 'net.oqee.androidtv';

export function oqeeChannelLink(channelId: number): string {
  return `https://oq.ee/channel/${channelId}/play`;
}
