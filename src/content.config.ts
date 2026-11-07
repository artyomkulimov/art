import { defineCollection } from "astro:content";
import { file } from "astro/loaders";
import { z } from "astro/zod";

const detail = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  zoom: z.number().min(1),
  note: z.string(),
});

const paintings = defineCollection({
  loader: file("src/data/paintings.yaml"),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      artist: z.string(),
      year: z.string(),
      medium: z.string(),
      /** Real size in cm, when `medium` doesn't state it. */
      size: z
        .object({
          h: z.number(),
          w: z.number(),
          approx: z.boolean().default(false),
        })
        .optional(),
      location: z.string(),
      rights: z.string(),
      source: z.string(),
      original: z.url(),
      image: image(),
      palette: z.array(z.string()).min(1),
      details: z.array(detail).default([]),
    }),
});

export const collections = { paintings };
