import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// A single layout-aware promo block on the homepage grid. One row feeds every
// responsive parameter the frontend needs: background kind, 12-col span,
// mobile behaviour, aspect ratio, text content, overlay and alignment.
export const homepageBlocksTable = pgTable("homepage_blocks", {
  id: serial("id").primaryKey(),
  // Where the block lives: "hero" blocks form the auto-rotating hero slideshow;
  // "grid" blocks flow through the 12-column grid below it.
  placement: text("placement", { enum: ["hero", "grid"] }).notNull().default("grid"),
  // Background kind: static image, solid colour, or looping muted video.
  kind: text("kind", { enum: ["image", "color", "video"] }).notNull().default("image"),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  backgroundColor: text("background_color"),
  // Dark overlay percentage (0-100) for text legibility over media.
  overlayOpacity: integer("overlay_opacity").notNull().default(30),
  // Desktop 12-column span (1-12). On mobile every block is full width.
  columnSpan: integer("column_span").notNull().default(12),
  // Drop heavy blocks on small viewports.
  hideOnMobile: boolean("hide_on_mobile").notNull().default(false),
  // CSS aspect-ratio for the media box, e.g. "16/9", "1/1", "4/5", "21/9".
  aspectRatio: text("aspect_ratio").notNull().default("16/9"),
  heading: text("heading"),
  subheading: text("subheading"),
  ctaLabel: text("cta_label"),
  ctaHref: text("cta_href"),
  // Content position: "<vertical>-<horizontal>", e.g. "bottom-left", "center-center".
  textAlign: text("text_align").notNull().default("bottom-left"),
  textColor: text("text_color").notNull().default("#ffffff"),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertHomepageBlockSchema = createInsertSchema(homepageBlocksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHomepageBlock = z.infer<typeof insertHomepageBlockSchema>;
export type HomepageBlock = typeof homepageBlocksTable.$inferSelect;
