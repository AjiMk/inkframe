import { createFileRoute } from "@tanstack/react-router";
import { LibraryView } from "@/components/comic/library-view";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <LibraryView />;
}
