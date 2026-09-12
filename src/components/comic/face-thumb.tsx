import type { CSSProperties } from "react";
import { useMediaUrl } from "@/lib/comics/media";
import { cn } from "@/lib/utils";

export function FaceThumb({
  src,
  alt,
  className,
  style,
}: {
  src: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const url = useMediaUrl(src);
  if (!url) {
    return <div className={cn("animate-pulse bg-muted", className)} style={style} />;
  }
  return (
    <img
      src={url}
      alt={alt ?? ""}
      draggable={false}
      className={cn("object-cover", className)}
      style={style}
    />
  );
}
