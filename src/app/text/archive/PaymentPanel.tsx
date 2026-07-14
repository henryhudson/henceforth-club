import { bitcoinAmount, bitcoinUri } from "./bitcoinUri";
import { qrSvg } from "./qr";

/**
 * The scannable payment code, and the address and amount as selectable text
 * underneath it — renders only once the caller has confirmed both the
 * checkbox gate and a published address (ArchiveFlow's job, not this
 * component's). The code itself stays fixed black-on-white regardless of
 * the page's dark theme: it is a scanning target, not decoration, and most
 * camera readers expect that contrast.
 */
export default function PaymentPanel({
  address,
  priceSats,
  gbpPerBsv,
}: {
  address: string;
  priceSats: number;
  /** Live pounds-per-coin from the server page — display softener only. */
  gbpPerBsv?: number;
}) {
  const uri = bitcoinUri(address, priceSats);
  const { size, path } = qrSvg(uri);
  const amount = bitcoinAmount(priceSats);
  const pounds = gbpPerBsv === undefined ? undefined : (priceSats / 1e8) * gbpPerBsv;

  return (
    <div className="rounded-2xl border border-card-border bg-card-bg p-6 text-center">
      <a href={uri} className="mx-auto block w-48 rounded-lg bg-white p-3">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`Bitcoin payment address ${address}, amount ${amount} bitcoin SV`}
        >
          <path d={path} fill="black" />
        </svg>
      </a>
      <p className="mt-4 select-all break-all font-mono text-sm text-foreground">{address}</p>
      <p className="mt-1 select-all font-mono text-sm text-muted">
        {pounds !== undefined && <>about &pound;{pounds.toFixed(2)} &middot; </>}
        {amount} bitcoin SV &middot; {priceSats.toLocaleString("en-GB")} satoshis
      </p>
      <p className="mt-3 text-xs text-muted">
        Pay with any Bitcoin SV wallet —{" "}
        <a href="https://handcash.io" target="_blank" rel="noreferrer" className="text-accent hover:underline">
          HandCash
        </a>{" "}
        or the{" "}
        <a href="https://apps.apple.com/app/henceforth/id1602896145" className="text-accent hover:underline">
          Henceforth app
        </a>{" "}
        can pay this code. On a phone, tap the code to open your wallet directly.
      </p>
    </div>
  );
}
