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
