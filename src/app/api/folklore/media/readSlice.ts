import type { ByteRange } from "./range";

/**
 * The read loop node's contract actually requires: `FileHandle.read` may
 * return fewer bytes than asked, so a single read into an allocated slice
 * can leave a silently zero-filled tail — corrupt video bytes served with a
 * confident 206. Loop until the window is filled or the file ends, and hand
 * back only the bytes actually read. Abstracted over the read function so
 * the loop is testable without a disk.
 */
export type SliceReader = (
  buffer: Buffer,
  offset: number,
  length: number,
  position: number,
) => Promise<{ bytesRead: number }>;

export async function readSlice(read: SliceReader, range: ByteRange): Promise<Buffer> {
  const length = range.end - range.start + 1;
  const slice = Buffer.alloc(length);
  let filled = 0;
  while (filled < length) {
    const { bytesRead } = await read(slice, filled, length - filled, range.start + filled);
    if (bytesRead === 0) break; // end of file — a truncated copy yields what exists, never zeros
    filled += bytesRead;
  }
  return slice.subarray(0, filled);
}
