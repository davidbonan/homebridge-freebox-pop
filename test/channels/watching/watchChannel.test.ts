import assert from 'node:assert/strict';
import { test } from 'node:test';
import { watchChannel } from '../../../src/channels/watching/application/watchChannel.ts';
import { FakePlayer, TF1_LINK, instantPolicy, watchTf1 } from './fakePlayer.ts';

test('wakes a sleeping player before opening the channel', async () => {
  const player = new FakePlayer({ isPowered: false });

  await watchChannel(player, watchTf1(), instantPolicy);

  assert.deepEqual(player.commands, ['power', TF1_LINK]);
});

test('never presses power on a running player', async () => {
  const player = new FakePlayer({ isPowered: true });

  await watchChannel(player, watchTf1(), instantPolicy);

  assert.deepEqual(player.commands, [TF1_LINK]);
});

test('retries when the channel link cannot be sent', async () => {
  const player = new FakePlayer({ isPowered: true, failedLinkWrites: 2 });

  await watchChannel(player, watchTf1(), instantPolicy);

  assert.deepEqual(player.commands, [TF1_LINK]);
});

test('gives up after the allowed attempts when OQEE never shows', async () => {
  const player = new FakePlayer({ isPowered: true, opensOqee: false });

  await assert.rejects(watchChannel(player, watchTf1(), instantPolicy), /OQEE did not come to the foreground/);

  assert.equal(player.commands.length, instantPolicy.attempts);
});
