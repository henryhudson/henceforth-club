import { bitcoinAmount, bitcoinUri } from "./bitcoinUri";
import { qrSvg } from "./qr";

/**
 * The QR, and the address and amount as selectable text underneath it —
 * renders only once the caller has confirmed both the checkbox gate and a
 * published address (ArchiveFlow's job, not this component's). The QR
 * itself stays fixed black-on-white regardless of the page's dark theme:
 * it is a scanning target, not decoration, and most camera readers expect
 * that contrast.
 */
export default function PaymentPanel({ address, priceSats }: { address: string; priceSats: number }) {
  const uri = bitcoinUri(address, priceSats);
  const { size, path } = qrSvg(uri);
  const amount = bitcoinAmount(priceSats);

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
        {amount} bitcoin SV &middot; {priceSats.toLocaleString("en-GB")} satoshis
      </p>
    </div>
  );
}
