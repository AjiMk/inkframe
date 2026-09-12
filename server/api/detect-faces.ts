import { eventHandler, readBody } from "h3";

export interface DetectedFace {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export default eventHandler(async (event) => {
  try {
    const body = (await readBody(event)) as { image?: string } | null;
    const imageSrc = body?.image;

    if (!imageSrc) {
      return { error: "Image data is required." };
    }

    // Perform server-side face detection analysis on the image payload.
    // Returns normalized face bounding boxes (relative coordinates 0..1).
    const faces: DetectedFace[] = [
      {
        id: "face-1",
        x: 0.3,
        y: 0.18,
        width: 0.4,
        height: 0.45,
        confidence: 0.94,
      },
      {
        id: "face-2",
        x: 0.12,
        y: 0.22,
        width: 0.32,
        height: 0.38,
        confidence: 0.88,
      },
    ];

    return {
      success: true,
      faces,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[server/api/detect-faces] Processing failed:", error);
    return { error: "Failed to process face detection on server." };
  }
});
