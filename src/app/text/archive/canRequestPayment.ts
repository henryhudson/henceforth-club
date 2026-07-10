// The two required checkboxes gating the pay step — the visitor must
// acknowledge both before this page reveals a payment address, regardless of
// whether the worker has already published one.
export function canRequestPayment(acknowledgedPermanence: boolean, ownAccountAsserted: boolean): boolean {
  return acknowledgedPermanence && ownAccountAsserted;
}
