import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Shared marketing media sizing.
 * Goal: graphics fill their column predictably and stay visually balanced with copy.
 */

type Aspect = "wide" | "ultrawide" | "feature" | "video" | "square" | "phone" | "portrait";

const ASPECT: Record<Aspect, string> = {
  /** Mid-page feature tiles / cards */
  wide: "aspect-[16/10]",
  /** Ultrawide product heroes (e.g. 2800×1440 chain video) */
  ultrawide: "aspect-[2/1]",
  /** Slightly taller product / section frames */
  feature: "aspect-[5/4] sm:aspect-[16/10]",
  /** Inline video beside copy */
  video: "aspect-video",
  square: "aspect-square",
  phone: "aspect-[9/19.5]",
  portrait: "aspect-[4/5]",
};

type Size = "sm" | "md" | "lg" | "full";

/** Max widths so media doesn't sprawl wider than the related copy. */
const SIZE: Record<Size, string> = {
  sm: "max-w-[280px] mx-auto",
  md: "max-w-[420px] sm:max-w-[480px] mx-auto",
  lg: "w-full max-w-[560px] mx-auto lg:max-w-none lg:mx-0",
  full: "w-full max-w-none",
};

/** Fixed-ratio frame — put absolute fill Image/video inside. */
export function MediaFrame({
  children,
  aspect = "wide",
  size = "full",
  className,
}: {
  children: ReactNode;
  aspect?: Aspect;
  size?: Size;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-black",
        ASPECT[aspect],
        SIZE[size],
        className
      )}
    >
      {children}
    </div>
  );
}

/** Text + media row — media column capped so type and graphic share weight. */
export function SplitBlock({
  copy,
  media,
  reverse = false,
  align = "center",
  className,
}: {
  copy: ReactNode;
  media: ReactNode;
  reverse?: boolean;
  align?: "center" | "start";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-12 xl:gap-16",
        align === "start" ? "items-start" : "items-center",
        reverse && "lg:[&>*:first-child]:order-2",
        className
      )}
    >
      <div
        className={cn(
          "flex flex-col min-w-0 max-w-xl lg:max-w-none",
          align === "start" ? "justify-start lg:pt-2" : "justify-center"
        )}
      >
        {copy}
      </div>
      <div className="min-w-0 w-full flex justify-center lg:justify-stretch">
        <div className="w-full max-w-2xl lg:max-w-none">{media}</div>
      </div>
    </div>
  );
}

/**
 * Split hero: copy + product graphic.
 * cover  — edge-to-edge media filling the column (spot / earn heroes)
 * contain — product shot scaled to a consistent visual weight
 */
export function SplitHero({
  copy,
  media,
  mediaFit = "contain",
  className,
}: {
  copy: ReactNode;
  media: ReactNode;
  mediaFit?: "cover" | "contain";
  className?: string;
}) {
  return (
    <section
      className={cn(
        "grid lg:grid-cols-2 lg:min-h-[min(100svh-4rem,840px)] lg:items-stretch bg-black",
        mediaFit === "cover" && "overflow-hidden",
        className
      )}
    >
      <div className="order-2 lg:order-1 flex flex-col justify-center px-5 sm:px-8 lg:pl-14 xl:pl-20 lg:pr-6 pt-10 pb-14 sm:py-16 lg:py-20 text-inherit">
        <div className="w-full max-w-lg">{copy}</div>
      </div>

      <div
        className={cn(
          "order-1 lg:order-2 relative",
          mediaFit === "cover"
            ? "aspect-[4/3] sm:aspect-[16/11] lg:aspect-auto lg:h-full min-h-[260px] sm:min-h-[340px] overflow-hidden"
            : "flex items-center justify-center px-6 sm:px-10 lg:px-8 xl:px-12 py-8 sm:py-10 lg:py-12"
        )}
      >
        {mediaFit === "cover" ? (
          <div className="absolute inset-0 [&_img]:absolute [&_img]:inset-0 [&_img]:h-full [&_img]:w-full [&_img]:object-cover [&_video]:absolute [&_video]:inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover">
            {media}
          </div>
        ) : (
          <div className="w-full max-w-[min(100%,480px)] lg:max-w-[min(100%,520px)] mx-auto [&_video]:block [&_video]:w-full [&_video]:h-auto [&_video]:max-h-[min(44vh,360px)] sm:[&_video]:max-h-[min(48vh,420px)] lg:[&_video]:max-h-[min(62vh,540px)] [&_video]:object-contain [&_img]:block [&_img]:w-full [&_img]:h-auto [&_img]:max-h-[min(44vh,360px)] sm:[&_img]:max-h-[min(48vh,420px)] lg:[&_img]:max-h-[min(62vh,540px)] [&_img]:object-contain">
            {media}
          </div>
        )}
      </div>
    </section>
  );
}

/** Full-bleed background media for heroes / CTAs. */
export function BleedHero({
  media,
  children,
  className,
  overlayClassName = "bg-gradient-to-t from-black via-black/50 to-black/25",
  minHeight = "hero",
}: {
  media: ReactNode;
  children: ReactNode;
  className?: string;
  overlayClassName?: string;
  minHeight?: "hero" | "cta" | "short";
}) {
  const heights = {
    hero: "min-h-[85vh] sm:min-h-[90vh] lg:min-h-[calc(100svh-4rem)]",
    cta: "min-h-[48vh] sm:min-h-[55vh]",
    short: "min-h-[42vh] sm:min-h-[48vh]",
  };

  return (
    <section
      className={cn(
        "relative flex items-end sm:items-center overflow-hidden",
        heights[minHeight],
        className
      )}
    >
      <div className="absolute inset-0 bg-black [&_video]:absolute [&_video]:inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover [&_img]:object-cover">
        {media}
      </div>
      <div className={cn("absolute inset-0 pointer-events-none", overlayClassName)} />
      <div className="relative z-10 rh-container w-full py-14 sm:py-20 lg:py-24">
        <div className="max-w-3xl">{children}</div>
      </div>
    </section>
  );
}
