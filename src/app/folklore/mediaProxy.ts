/**
 * Pure. The playable form of a media url. Video must be served by something
 * that honours Range requests — Safari shows a dead player otherwise, and
 * both public inscription gateways ignore ranges — so a gateway video url is
 * rewritten onto the site's own range-honouring media route. Anything that is
 * not a recognisable gateway outpoint url passes through untouched.
 */
const GATEWAY_OUTPOINT = /^https:\/\/ordfs\.network\/([0-9a-f]{64}_\d+)$/;

export function playableMediaUrl(url: string): string {
  const match = GATEWAY_OUTPOINT.exec(url);
  return match ? `/api/folklore/media/${match[1]}` : url;
}
