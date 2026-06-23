import type { MetadataRoute } from "next";

// The LMS is entirely behind authentication — no route should be crawled or
// indexed. This complements the `robots: { index: false }` meta tag in the root
// layout with a site-wide robots.txt (Disallow: /).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
