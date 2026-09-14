import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { createRoot } from "react-dom/client";
import type { Comic } from "./types";
import { CoverCanvas } from "@/components/comic/cover-canvas";
import { PageCanvas } from "@/components/comic/page-canvas";

export async function exportComicToPdf(
  comic: Comic,
  onStatus?: (text: string) => void,
): Promise<void> {
  onStatus?.("Preparing comic pages for PDF rendering...");

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "-9999px";
  container.style.width = "800px";
  container.style.height = "1200px";
  container.style.zIndex = "-9999";
  document.body.appendChild(container);

  const root = createRoot(container);

  try {
    // Standard comic dimensions in mm (170mm x 255mm)
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [170, 255],
    });

    const totalSteps = 1 + comic.pages.length;

    const handleClone = (clonedDoc: Document) => {
      const canvas = clonedDoc.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d");

      function fixString(val: string): string {
        if (!val || typeof val !== "string") return val;
        if (
          !val.includes("oklab") &&
          !val.includes("oklch") &&
          !val.includes("color(") &&
          !val.includes("light-dark")
        ) {
          return val;
        }
        return val.replace(/(?:oklab|oklch|color|light-dark)\([^)]+\)/gi, (match) => {
          if (!ctx) return match;
          try {
            ctx.fillStyle = "#000000";
            ctx.fillStyle = match;
            const res = ctx.fillStyle;
            if (res && res !== "#000000") return res;
            ctx.fillStyle = "#ffffff";
            ctx.fillStyle = match;
            return ctx.fillStyle || match;
          } catch {
            return match;
          }
        });
      }

      // 1. Sanitize all <style> elements in cloned document
      const styleElements = clonedDoc.querySelectorAll("style");
      styleElements.forEach((styleEl) => {
        if (styleEl.textContent) {
          styleEl.textContent = fixString(styleEl.textContent);
        }
      });

      // 2. Sanitize all elements with inline style attributes
      const styledElements = clonedDoc.querySelectorAll("[style]");
      styledElements.forEach((el) => {
        const attr = el.getAttribute("style");
        if (attr) {
          el.setAttribute("style", fixString(attr));
        }
      });

      // 3. Patch clonedDoc.defaultView.getComputedStyle so html2canvas never receives oklab/oklch
      const defaultView = clonedDoc.defaultView;
      if (defaultView) {
        const origGetComputedStyle = defaultView.getComputedStyle.bind(defaultView);
        defaultView.getComputedStyle = function (elt: Element, pseudoElt?: string | null) {
          const style = origGetComputedStyle(elt, pseudoElt);
          return new Proxy(style, {
            get(target, prop, receiver) {
              if (prop === "getPropertyValue") {
                return (propertyName: string) => {
                  const raw = target.getPropertyValue(propertyName);
                  return fixString(raw);
                };
              }
              const val = Reflect.get(target, prop, receiver);
              if (typeof val === "string") {
                return fixString(val);
              }
              if (typeof val === "function") {
                return val.bind(target);
              }
              return val;
            },
          });
        } as typeof defaultView.getComputedStyle;
      }
    };

    // Step 1: Render Cover Page
    onStatus?.(`Rendering Cover Page (1 of ${totalSteps})...`);
    await new Promise<void>((resolve) => {
      root.render(
        <div style={{ width: "800px", height: "1200px" }}>
          <CoverCanvas comic={comic} mode="read" className="h-full w-full aspect-auto" />
        </div>,
      );
      setTimeout(resolve, 350);
    });

    const coverCanvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#161310",
      onclone: handleClone,
    });
    const coverData = coverCanvas.toDataURL("image/jpeg", 0.92);
    pdf.addImage(coverData, "JPEG", 0, 0, 170, 255);

    // Step 2: Render each Page
    for (let i = 0; i < comic.pages.length; i++) {
      const pageNum = i + 1;
      onStatus?.(`Rendering Page ${pageNum} of ${comic.pages.length} (${pageNum + 1} of ${totalSteps})...`);

      const page = comic.pages[i];
      await new Promise<void>((resolve) => {
        root.render(
          <div style={{ width: "800px", height: "1200px" }}>
            <PageCanvas page={page} mode="read" className="h-full w-full aspect-auto" />
          </div>,
        );
        setTimeout(resolve, 350);
      });

      const pageCanvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#161310",
        onclone: handleClone,
      });
      const pageData = pageCanvas.toDataURL("image/jpeg", 0.92);

      pdf.addPage([170, 255], "portrait");
      pdf.addImage(pageData, "JPEG", 0, 0, 170, 255);
    }

    onStatus?.("Saving PDF document...");
    const safeTitle = (comic.title || "inkframe-comic").replace(/[^a-z0-9_-]/gi, "_");
    pdf.save(`${safeTitle}.pdf`);
  } finally {
    root.unmount();
    container.remove();
  }
}
