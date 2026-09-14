import { useLayoutEffect } from "react";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { Toaster } from "@/components/ui/sonner";
import { useComicStore } from "@/lib/comics/store";
import { AppNotFoundComponent } from "@/lib/error-component";
import appCss from "../styles.css?url";

const APP_NAME = "Inkframe";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content:
          "Create comics from photos and video stills, add dialogue, and read them with cinematic page turns.",
      },
      { name: "theme-color", content: "#161310" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bangers&family=Figtree:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Noto+Sans+Malayalam:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  notFoundComponent: AppNotFoundComponent,
  component: RootDocument,
});


function RootDocument() {
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-dvh bg-background text-foreground">
        <PreviewHostBridge />
        <AuthProvider>
          <HydrateComics />
          <Outlet />
          <Toaster />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}

function HydrateComics() {
  const hydrate = useComicStore((s) => s.hydrate);
  useLayoutEffect(() => {
    hydrate();
  }, [hydrate]);
  return null;
}
