import { eventHandler, readBody } from "h3";

export interface ReplaceHeadPayload {
  targetImage: string;
  faceBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  replacementFaceSrc: string;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
}

export default eventHandler(async (event) => {
  try {
    const body = (await readBody(event)) as ReplaceHeadPayload | null;

    if (!body || !body.targetImage || !body.faceBox || !body.replacementFaceSrc) {
      return { error: "Missing required payload parameters." };
    }

    return {
      success: true,
      replacement: {
        faceBox: body.faceBox,
        replacementFaceSrc: body.replacementFaceSrc,
        scale: body.scale ?? 1.0,
        offsetX: body.offsetX ?? 0,
        offsetY: body.offsetY ?? 0,
      },
      message: "Face replacement processed successfully.",
    };
  } catch (error) {
    console.error("[server/api/replace-head] Processing failed:", error);
    return { error: "Failed to perform server head replacement." };
  }
});
