// The browser-side counterpart of parseXExport: bundles the three files
// dropZone.ts already validated into one zip, ready for the multipart
// "zip" field the paid job route expects. Pure — bytes in, bytes out, no
// network, no clock.

import { zipSync } from "fflate";

export function buildExportZip({
  tweets,
  profile,
  account,
}: {
  tweets: Uint8Array;
  profile: Uint8Array;
  account: Uint8Array;
}): Uint8Array {
  return zipSync({
    "tweets.js": tweets,
    "profile.js": profile,
    "account.js": account,
  });
}
