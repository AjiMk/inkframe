import { useState } from "react";
import { Check, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useComicStore } from "@/lib/comics/store";
import { defaultCoverConfig } from "@/lib/comics/factory";
import type { Comic, CoverTemplateStyle } from "@/lib/comics/types";
import { CoverCanvas } from "./cover-canvas";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comic: Comic;
}

const TEMPLATES: { id: CoverTemplateStyle; label: string; desc: string }[] = [
  { id: "classic", label: "Golden Age #1", desc: "Classic 80s comic book cover style with vibrant title" },
  { id: "action", label: "Action Burst", desc: "Bold red issue box & high energy tagline ribbon" },
  { id: "vintage", label: "70s Pulp", desc: "Sepia tone paper finish with retro distressed masthead" },
  { id: "pulp", label: "Pulp Thriller", desc: "Warm orange highlights & intense thriller styling" },
  { id: "graphic-novel", label: "Graphic Novel", desc: "Sleek dark edition with monochrome cover art frame" },
];

const COLOR_PRESETS = [
  "#facc15", // Classic Yellow
  "#dc2626", // Hero Red
  "#2563eb", // Royal Blue
  "#16a34a", // Emerald Green
  "#06b6d4", // Cyan Neon
  "#c084fc", // Purple Flare
  "#ffffff", // Clean White
];

export function CoverDesignerDialog({ open, onOpenChange, comic }: Props) {
  const store = useComicStore();
  const config = comic.coverConfig ?? defaultCoverConfig();

  const [activeTab, setActiveTab] = useState<"template" | "details" | "style">("template");

  function update(patch: Partial<typeof config>) {
    store.setCoverConfig(comic.id, patch);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90dvh] overflow-hidden flex flex-col p-4 sm:p-6">
        <DialogHeader className="shrink-0 border-b border-border pb-3">
          <DialogTitle className="flex items-center gap-2 text-xl font-display uppercase tracking-wider">
            <Sparkles className="size-5 text-primary" />
            Comic Cover Page Designer
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 min-h-0 flex-1 overflow-y-auto py-2">
          {/* Live Cover Preview Column */}
          <div className="md:col-span-5 flex flex-col items-center justify-center bg-secondary/50 rounded-lg p-4 border border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Live Preview
            </p>
            <div className="w-full max-w-[260px]">
              <CoverCanvas comic={comic} mode="edit" />
            </div>
          </div>

          {/* Configuration Controls Column */}
          <div className="md:col-span-7 flex flex-col">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
              <TabsList className="grid grid-cols-3 w-full mb-4">
                <TabsTrigger value="template" className="text-xs font-medium">
                  Template
                </TabsTrigger>
                <TabsTrigger value="details" className="text-xs font-medium">
                  Issue Details
                </TabsTrigger>
                <TabsTrigger value="style" className="text-xs font-medium">
                  Typography & Seals
                </TabsTrigger>
              </TabsList>

              {/* Template Select Tab */}
              <TabsContent value="template" className="space-y-3">
                <div className="grid grid-cols-1 gap-2">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => update({ template: t.id })}
                      className={`flex items-start justify-between p-3 rounded-lg border text-left transition-all ${
                        config.template === t.id
                          ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                          : "border-border bg-card hover:border-foreground/30"
                      }`}
                    >
                      <div>
                        <p className="font-semibold text-sm text-foreground">{t.label}</p>
                        <p className="text-xs text-muted-foreground">{t.desc}</p>
                      </div>
                      {config.template === t.id && (
                        <div className="size-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                          <Check className="size-3" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </TabsContent>

              {/* Issue Details Tab */}
              <TabsContent value="details" className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="issue-num" className="text-xs">Issue No.</Label>
                    <Input
                      id="issue-num"
                      value={config.issueNumber}
                      onChange={(e) => update({ issueNumber: e.target.value })}
                      placeholder="#1"
                      className="h-8 text-xs font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="issue-price" className="text-xs">Price</Label>
                    <Input
                      id="issue-price"
                      value={config.issuePrice}
                      onChange={(e) => update({ issuePrice: e.target.value })}
                      placeholder="25¢"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="issue-date" className="text-xs">Date / Vol</Label>
                    <Input
                      id="issue-date"
                      value={config.issueDate}
                      onChange={(e) => update({ issueDate: e.target.value })}
                      placeholder="AUG 1984"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="tagline" className="text-xs">Action Banner Tagline</Label>
                  <Input
                    id="tagline"
                    value={config.tagline}
                    onChange={(e) => update({ tagline: e.target.value })}
                    placeholder="SPECIAL COLLECTOR'S EDITION!"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="subtitle" className="text-xs">Cover Subtitle</Label>
                  <Input
                    id="subtitle"
                    value={config.subtitle}
                    onChange={(e) => update({ subtitle: e.target.value })}
                    placeholder="THE EXTRAORDINARY TALES BEGIN!"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="publisher" className="text-xs">Publisher Emblem Text</Label>
                  <Input
                    id="publisher"
                    value={config.publisherName}
                    onChange={(e) => update({ publisherName: e.target.value })}
                    placeholder="INKFRAME COMICS"
                    className="h-8 text-xs"
                  />
                </div>
              </TabsContent>

              {/* Typography & Seals Tab */}
              <TabsContent value="style" className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Title Color Palette</Label>
                  <div className="flex items-center gap-2">
                    {COLOR_PRESETS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => update({ titleColor: color })}
                        className={`size-7 rounded-full border-2 transition-transform ${
                          config.titleColor === color
                            ? "scale-110 border-foreground ring-2 ring-primary"
                            : "border-border hover:scale-105"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold">Comics Code Authority Seal</p>
                      <p className="text-[11px] text-muted-foreground">Show authentic vintage comic approval stamp</p>
                    </div>
                    <Switch
                      checked={config.showComicsCode}
                      onCheckedChange={(checked: boolean) => update({ showComicsCode: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold">Barcode Stamp</p>
                      <p className="text-[11px] text-muted-foreground">Show 80s newsstand barcode stamp</p>
                    </div>
                    <Switch
                      checked={config.showBarcode}
                      onCheckedChange={(checked: boolean) => update({ showBarcode: checked })}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <div className="shrink-0 flex items-center justify-between border-t border-border pt-3 mt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => update({ positions: defaultCoverConfig().positions })}
            className="text-xs text-muted-foreground gap-1.5"
          >
            <RotateCcw className="size-3.5" />
            Reset Banner Positions
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
