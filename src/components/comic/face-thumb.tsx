import { useMediaUrl } from "@/lib/comics/media";
import { cn } from "@/lib/utils";

export function FaceThumb({
  src,
  alt,
  className,
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  const url = useMediaUrl(src);
  if (!url) {
    return <div className={cn("animate-pulse bg-muted", className)} />;
  }
  return (
    <img
      src={url}
      alt={alt ?? ""}
      draggable={false}
      className={cn("object-cover", className)}
    />
  );
}
