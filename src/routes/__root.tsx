import * as React from "react";
import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import "@fontsource-variable/instrument-sans";
import { toggleTheme, THEME_KEY } from "entities/theme";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#C05B3F" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "travel" },
      { title: "travel" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
    scripts: [
      {
        // Apply the stored theme before first paint (SSR always emits "light").
        children: `try{document.documentElement.dataset.theme=localStorage.getItem(${JSON.stringify(THEME_KEY)})||"light"}catch(e){}`,
      },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument(props: { children: React.ReactNode }) {
  // ⌘D / Ctrl+D toggles dark mode everywhere (including the map).
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        toggleTheme();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {props.children}
        <Scripts />
      </body>
    </html>
  );
}
