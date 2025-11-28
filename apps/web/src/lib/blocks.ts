import { z } from "zod";

export const blockKinds = ["hero", "media", "grid", "text", "cta"] as const;
export type BlockKind = (typeof blockKinds)[number];

export const blockSettingsSchema = z.object({
  background: z.enum(["default", "muted", "dark"]),
  alignment: z.enum(["left", "center"]),
  fullWidth: z.boolean(),
});
export type BlockSettings = z.infer<typeof blockSettingsSchema>;

const ctaSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
  variant: z.enum(["primary", "secondary"]).default("primary"),
});

const heroBlockSchema = z.object({
  eyebrow: z.string().optional(),
  heading: z.string().min(1),
  body: z.string().optional(),
  mediaUrl: z.string().url().optional(),
  mediaAlt: z.string().optional(),
  ctas: z.array(ctaSchema).max(2).default([]),
});

const mediaBlockSchema = z.object({
  label: z.string().optional(),
  url: z.string().url(),
  alt: z.string().optional(),
  caption: z.string().optional(),
  aspect: z.enum(["auto", "square", "wide"]).default("auto"),
});

const gridBlockSchema = z.object({
  title: z.string().optional(),
  columns: z
    .array(
      z.object({
        title: z.string().min(1),
        body: z.string().optional(),
        icon: z.string().optional(),
      }),
    )
    .min(1),
});

const textBlockSchema = z.object({
  html: z.string().min(1),
});

const ctaBlockSchema = z.object({
  heading: z.string().min(1),
  body: z.string().optional(),
  ctas: z.array(ctaSchema).min(1),
});

export const blockDataSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string().optional(),
    kind: z.literal("hero"),
    settings: blockSettingsSchema,
    data: heroBlockSchema,
  }),
  z.object({
    id: z.string().optional(),
    kind: z.literal("media"),
    settings: blockSettingsSchema,
    data: mediaBlockSchema,
  }),
  z.object({
    id: z.string().optional(),
    kind: z.literal("grid"),
    settings: blockSettingsSchema,
    data: gridBlockSchema,
  }),
  z.object({
    id: z.string().optional(),
    kind: z.literal("text"),
    settings: blockSettingsSchema,
    data: textBlockSchema,
  }),
  z.object({
    id: z.string().optional(),
    kind: z.literal("cta"),
    settings: blockSettingsSchema,
    data: ctaBlockSchema,
  }),
]);

export type BlockPayload = z.infer<typeof blockDataSchema>;

export const blocksPalette: Record<
  BlockKind,
  {
    label: string;
    description: string;
    defaults: Omit<BlockPayload, "kind" | "id">;
  }
> = {
  hero: {
    label: "Hero",
    description: "Headline with supporting text and CTAs.",
    defaults: {
      settings: {
        background: "default",
        alignment: "center",
        fullWidth: false,
      },
      data: {
        eyebrow: "Announcement",
        heading: "Your next chapter starts here",
        body: "Highlight a key message with a bold hero block.",
        mediaUrl: "",
        mediaAlt: "",
        ctas: [],
      },
    },
  },
  media: {
    label: "Media",
    description: "Showcase an image or video with caption.",
    defaults: {
      settings: {
        background: "muted",
        alignment: "center",
        fullWidth: false,
      },
      data: {
        label: "",
        url: "",
        alt: "",
        caption: "",
        aspect: "auto",
      },
    },
  },
  grid: {
    label: "Feature grid",
    description: "Highlight features or stats in columns.",
    defaults: {
      settings: {
        background: "default",
        alignment: "left",
        fullWidth: false,
      },
      data: {
        title: "",
        columns: [
          {
            title: "Feature one",
            body: "Explain the benefit in one or two sentences.",
            icon: "",
          },
          {
            title: "Feature two",
            body: "Share another highlight with supporting copy.",
            icon: "",
          },
        ],
      },
    },
  },
  text: {
    label: "Rich text",
    description: "Flexible text area with inline formatting.",
    defaults: {
      settings: {
        background: "default",
        alignment: "left",
        fullWidth: false,
      },
      data: {
        html: "<p>Tell your story with paragraphs, lists, and more.</p>",
      },
    },
  },
  cta: {
    label: "Call-to-action",
    description: "Stacked CTA with short description.",
    defaults: {
      settings: {
        background: "muted",
        alignment: "center",
        fullWidth: false,
      },
      data: {
        heading: "Ready to get started?",
        body: "Drive conversions with a clear call-to-action.",
        ctas: [
          {
            label: "Contact sales",
            href: "/contact",
            variant: "primary",
          },
        ],
      },
    },
  },
};

function nextId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export function createBlock(kind: BlockKind): BlockPayload {
  const preset = blocksPalette[kind];
  return {
    id: nextId(),
    kind,
    settings: preset.defaults.settings,
    data: preset.defaults.data,
  } as BlockPayload;
}

