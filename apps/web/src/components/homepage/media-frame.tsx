import Image from "next/image";
import type { HomepageImageDto } from "@thread/types";
import { ImageIcon } from "lucide-react";

export function MediaFrame({
  className = "",
  image,
  sizes,
}: {
  className?: string;
  image: HomepageImageDto | null;
  sizes: string;
}) {
  return (
    <div
      className={`relative overflow-hidden bg-[linear-gradient(145deg,#eee9df,#d9d0bf)] ${className}`}
    >
      {image ? (
        <Image
          alt={image.alt}
          className="object-cover transition-transform duration-slow group-hover:scale-[1.025] motion-reduce:transition-none"
          fill
          sizes={sizes}
          src={image.src}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center text-ink/45">
            <ImageIcon aria-hidden="true" className="mx-auto size-7" strokeWidth={1.4} />
            <span className="mt-3 block text-[0.65rem] font-bold uppercase tracking-[0.2em]">
              THREAD
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
