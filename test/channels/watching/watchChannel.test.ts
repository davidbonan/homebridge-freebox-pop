import assert from 'node:assert/strict';
import { test } from 'node:test';
import { watchChannel } from '../../../src/channels/watching/application/watchChannel.ts';
import { FakePlayer, commandRun, instantPower } from '../../player/fakePlayer.ts';

const TF1 = 536;
const TF1_LINK = 'https://oq.ee/channel/536/play';
const instantWatch = { ...instantPower, settleAfterWakeMs: 0, resumeAfterWakeMs: 0, launchTimeoutMs: 0 };
const watchTf1 = () => ({ ...commandRun(), channelId: TF1 });

test('opens the channel twice on a player it had to wake', async () => {
  const player = new FakePlayer({ isPowered: false });

  await watchChannel(player, watchTf1(), instantWatch);

  assert.deepEqual(player.commands, ['power', TF1_LINK, TF1_LINK]);
});

test('never presses power on a running player', async () => {
  const player = new FakePlayer({ isPowered: true });

  await watchChannel(player, watchTf1(), instantWatch);

  assert.deepEqual(player.commands, [TF1_LINK]);
});

test('retries when the channel link cannot be sent', async () => {
  const player = new FakePlayer({ isPowered: true, failedLinkWrites: 2 });

  await watchChannel(player, watchTf1(), instantWatch);

  assert.deepEqual(player.commands, [TF1_LINK]);
});

test('gives up after the allowed attempts when OQEE never shows', async () => {
  const player = new FakePlayer({ isPowered: true, opensOqee: false });

  await assert.rejects(watchChannel(player, watchTf1(), instantWatch), /OQEE did not come to the foreground/);

  assert.equal(player.commands.length, instantWatch.attempts);
});
