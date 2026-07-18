import type { MetadataRoute } from "next";
import { publishedEpisodes } from "@/lib/episodes";
import { listPublishedWeeks } from "@/lib/this-week/store";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://henceforth.club";
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: "yearly", priority: 0.6 },
    { url: `${baseUrl}/henceforth`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${baseUrl}/henceforth/swiftbsv`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/henceforth/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${baseUrl}/dadeckofcards`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${baseUrl}/dadeckofcards/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${baseUrl}/hansard`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${baseUrl}/hansard/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${baseUrl}/hansard/this-week`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/folklore`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${baseUrl}/docs`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/docs/about`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${baseUrl}/docs/goals`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/docs/reference`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/docs/wallet`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/docs/credits`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${baseUrl}/articles`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/articles/transactions-in-henceforth`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/articles/trust-local-but-verify`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/articles/hansard-is-live`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/articles/farage-resigns-clacton`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/learn`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/contact`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
  ];

  const learnRoutes = publishedEpisodes().map((e) => ({
    url: `${baseUrl}/learn/${e.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const weekRoutes = listPublishedWeeks().map((week) => ({
    url: `${baseUrl}/hansard/this-week/${week}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.65,
  }));

  return [...staticRoutes, ...learnRoutes, ...weekRoutes];
}
