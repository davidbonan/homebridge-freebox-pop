export interface SplitFrames {
  frames: Buffer[];
  rest: Buffer;
}

export function splitFrames(received: Buffer): SplitFrames {
  const frames: Buffer[] = [];
  let start = 0;
  for (;;) {
    const end = frameEnd(received, start);
    if (end === undefined) break;
    frames.push(received.subarray(start, end));
    start = end;
  }
  return { frames, rest: received.subarray(start) };
}

function frameEnd(received: Buffer, start: number): number | undefined {
  let length = 0;
  for (let index = start, shift = 0; index < received.length; index++, shift += 7) {
    const byte = received.readUInt8(index);
    length |= (byte & 0x7f) << shift;
    if (byte & 0x80) continue;
    const end = index + 1 + length;
    return end <= received.length ? end : undefined;
  }
  return undefined;
}
