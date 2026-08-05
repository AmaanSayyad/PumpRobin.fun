import { UserRound, type LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

/** Monochrome creator mark — matches Globe / social icon weight. */
export function CreatorIcon({ className, ...props }: LucideProps) {
  return (
    <UserRound
      className={cn("h-3.5 w-3.5", className)}
      strokeWidth={2}
      aria-hidden
      {...props}
    />
  );
}
