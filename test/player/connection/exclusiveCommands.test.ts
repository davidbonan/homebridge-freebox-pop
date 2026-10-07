import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate as powerPressed } from 'node:timers/promises';
import { watchChannel } from '../../../src/channels/watching/application/watchChannel.ts';
import { ExclusiveCommands } from '../../../src/player/connection/domain/exclusiveCommands.ts';
import { turnPlayerOn } from '../../../src/player/power/application/playerPowerCommands.ts';
import { FakePlayer, commandRun } from '../fakePlayer.ts';

const TF1_LINK = 'https://oq.ee/channel/536/play';
const patientPower = { attempts: 1, retryDelayMs: 0, connectTimeoutMs: 0, powerTimeoutMs: 500 };
const patientWatch = { ...patientPower, settleAfterWakeMs: 0, resumeAfterWakeMs: 20, launchTimeoutMs: 0 };

test('a channel asked while the player wakes does not press power again', async () => {
  const player = new FakePlayer({ isPowered: false, powerLagMs: 20 });
  const commands = new ExclusiveCommands();

  const power = commands.run('Freebox Player', (signal) => turnPlayerOn(player, commandRun(signal), patientPower));
  await powerPressed();
  await commands.run('TF1', (signal) => watchChannel(player, { ...commandRun(signal), channelId: 536 }, patientWatch));

  assert.equal(await power, 'cancelled');
  assert.deepEqual(player.commands, ['power', TF1_LINK, TF1_LINK]);
});

test('cancelling a name leaves the command of another name running', async () => {
  const player = new FakePlayer({ isPowered: false, powerLagMs: 20 });
  const commands = new ExclusiveCommands();

  const power = commands.run('Freebox Player', (signal) => turnPlayerOn(player, commandRun(signal), patientPower));
  commands.cancel('TF1');

  assert.equal(await power, 'done');
});
