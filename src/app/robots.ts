import type { MetadataRoute } from "next";

/** Lets search engines index the public pages only. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/practice/", "/test", "/pass", "/account", "/bank", "/reset-password", "/api/"],
    },
  };
}
