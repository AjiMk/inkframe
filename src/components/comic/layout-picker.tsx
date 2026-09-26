import { cn } from "@/lib/utils";
import { LAYOUT_LIST } from "@/lib/comics/layouts";
import type { PageLayoutId } from "@/lib/comics/types";

export function LayoutPicker({
  value,
  onChange,
}: {
  value: PageLayoutId;
  onChange: (id: PageLayoutId) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {LAYOUT_LIST.map((layout) => (
        <button
          key={layout.id}
          type="button"
          onClick={() => onChange(layout.id)}
          className={cn(
            "flex h-12 flex-col items-center justify-center gap-0.5 rounded-lg border bg-card p-1 transition-[border-color,box-shadow] duration-150 ease-out",
            value === layout.id
              ? "border-primary paper-shadow-hover"
              : "border-border hover:border-foreground/30",
          )}
        >
          <span
            className="grid h-6 w-full gap-0.5 bg-ink p-0.5"
            style={{
              gridTemplateColumns: layout.columns,
              gridTemplateRows: layout.rows,
              gridTemplateAreas: layout.areas,
            }}
          >
            {Array.from({ length: layout.panelCount }).map((_, i) => (
              <span
                key={i}
                className="bg-secondary"
                style={{ gridArea: ["a", "b", "c", "d"][i] }}
              />
            ))}
          </span>
          <span className="text-[10px] font-medium text-muted-foreground">
            {layout.label}
          </span>
        </button>
      ))}
    </div>
  );
}
