import Image from "next/image";

/** A phone screenshot in the product hero. Real device capture, not a
 *  website demo. Sources are 403×876 JPEGs in /public/apps. */
export default function PhoneShot({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="mx-auto w-[200px] sm:w-[240px] lg:mx-0">
      <Image
        src={src}
        alt={alt}
        width={403}
        height={876}
        priority
        className="h-auto w-full rounded-[1.75rem] border border-card-border shadow-2xl shadow-black/40"
      />
    </div>
  );
}
