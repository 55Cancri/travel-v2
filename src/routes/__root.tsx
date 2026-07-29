import * as React from "react";
import { HeadContent, Scripts, createRootRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { MotionConfig } from "framer-motion";
import "@fontsource-variable/instrument-sans";
import { toggleTheme, THEME_KEY } from "entities/theme";
import appCss from "../styles.css?url";

// Who holds a valid session cookie, judged on the server (the seal and
// the allowlist live in worker bindings). Dynamic imports keep the
// server-only door module out of the client bundle.
const sessionHolder = createServerFn({ method: "GET" }).handler(async () => {
  const [{ getCookie }, { openSession, SESSION_COOKIE }] = await Promise.all([
    import("@tanstack/react-start/server"),
    import("./-door"),
  ]);
  return await openSession(getCookie(SESSION_COOKIE));
});

export const Route = createRootRoute({
  // The whole site sits behind the door; only the door itself is open.
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/login") return;
    const email = await sessionHolder();
    if (!email) throw redirect({ to: "/login" });
  },
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
        {/* One place decides that motion follows the reader's own
            reduce-motion setting, so no individual animation has to
            remember to ask. */}
        <MotionConfig reducedMotion="user">{props.children}</MotionConfig>
        <Scripts />
      </body>
    </html>
  );
}
