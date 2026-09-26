import { createFileRoute } from "@tanstack/react-router";
import { ComicReader } from "@/components/comic/comic-reader";

export const Route = createFileRoute("/read/$comicId")({
  component: ReadPage,
});

function ReadPage() {
  const { comicId } = Route.useParams();
  return <ComicReader comicId={comicId} />;
}
