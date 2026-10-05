import assert from 'node:assert/strict';
import { test } from 'node:test';
import { splitFrames } from '../../../src/channels/watching/infrastructure/remoteMessageFrames.ts';

test('splits frames received in one chunk and keeps the unfinished one', () => {
  const received = Buffer.from([2, 0xaa, 0xbb, 1, 0xcc, 3, 0xdd]);

  const { frames, rest } = splitFrames(received);

  assert.deepEqual(frames, [Buffer.from([2, 0xaa, 0xbb]), Buffer.from([1, 0xcc])]);
  assert.deepEqual(rest, Buffer.from([3, 0xdd]));
});

test('reads a frame longer than 127 bytes', () => {
  const payload = Buffer.alloc(200, 7);
  const received = Buffer.concat([Buffer.from([0xc8, 0x01]), payload]);

  const { frames, rest } = splitFrames(received);

  assert.equal(frames[0]?.length, 202);
  assert.equal(rest.length, 0);
});
