import assert from 'node:assert/strict';
import { test } from 'node:test';
import { turnPlayerOff } from '../../../src/player/power/application/playerPowerCommands.ts';
import { FakePlayer, commandRun, instantPower } from '../fakePlayer.ts';

test('puts a running player to sleep', async () => {
  const player = new FakePlayer({ isPowered: true });

  await turnPlayerOff(player, commandRun(), instantPower);

  assert.deepEqual(player.commands, ['power']);
});

test('leaves a sleeping player alone instead of waking it', async () => {
  const player = new FakePlayer({ isPowered: false });

  await turnPlayerOff(player, commandRun(), instantPower);

  assert.deepEqual(player.commands, []);
});
