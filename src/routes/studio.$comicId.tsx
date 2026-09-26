import { createFileRoute } from "@tanstack/react-router";
import { StudioEditor } from "@/components/comic/studio-editor";

export const Route = createFileRoute("/studio/$comicId")({
  component: StudioPage,
});

function StudioPage() {
  const { comicId } = Route.useParams();
  return <StudioEditor comicId={comicId} />;
}
