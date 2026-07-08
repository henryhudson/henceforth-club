import { NextResponse } from "next/server";
import { consumePayment, isTxid, minPaymentSats, verifyPayment } from "./xPayment";
import { reserveXApiSpend } from "./xSpend";

/**
 * The one gate every X-API-spending route passes through.
 *
 * It exists as a single function so the ORDER cannot drift between the two
 * routes, because the order is the whole point:
 *
 *   1. a payment id is present and well formed        (free)
 *   2. the transaction really paid the reward address (free — reads the chain)
 *   3. the payment is burned, so it buys one read     (fails closed)
 *   4. the call's worst-case cost fits today's budget (fails closed)
 *   5. only now may the caller touch X
 *
 * Verification precedes burning so a caller who mistypes a handle does not
 * forfeit their payment. Burning precedes the reservation so one transaction can
 * never buy two reads, even if the budget has room for both.
 */

export type Gate =
  | { ok: true; sats: number; reservedUsd: number }
  | { ok: false; response: NextResponse };

const deny = (status: number, reason: string) =>
  ({ ok: false as const, response: NextResponse.json({ ok: false, reason }, { status }) });

export async function payAndReserve(
  payment: string | null,
  worstCaseResources: number,
): Promise<Gate> {
  if (!isTxid(payment)) return deny(402, "payment-required");

  const verdict = await verifyPayment(payment, minPaymentSats());
  if (!verdict.ok) {
    // A payment that does not exist or does not pay enough is the caller's
    // problem, not ours; an underpayment is not an error we should retry.
    return deny(verdict.reason === "not-found" ? 404 : 402, verdict.reason);
  }

  const burned = await consumePayment(payment);
  if (!burned.ok) {
    return deny(burned.reason === "replayed" ? 409 : 503, burned.reason);
  }

  const reserved = await reserveXApiSpend(worstCaseResources);
  if (!reserved.ok) {
    return deny(reserved.reason === "budget-exhausted" ? 429 : 503, reserved.reason);
  }

  return { ok: true, sats: verdict.sats, reservedUsd: reserved.reservedUsd };
}

/** One user object plus one page of posts. */
export const RESOURCES_TEXT_ONLY = 101;

/** As above, plus the media pass, which pages the timeline a second time. */
export const RESOURCES_WITH_MEDIA = 201;
