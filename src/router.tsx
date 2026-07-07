// The Temporal polyfill loads before anything else in both runtimes: the
// client and server entries each reach every route module through this file.
import "temporal-polyfill/global";

import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen.ts";

export const getRouter = () => {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });
};
