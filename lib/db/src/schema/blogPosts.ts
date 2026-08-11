import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// A blog / journal article, managed from the admin console.
export const blogPostsTable = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt"),
  // Markdown body.
  content: text("content").notNull().default(""),
  coverImageUrl: text("cover_image_url"),
  author: text("author").notNull().default("Happyfine"),
  // Comma-separated tags.
  tags: text("tags"),
  status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
  // SEO overrides — fall back to title/excerpt when empty.
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type BlogPost = typeof blogPostsTable.$inferSelect;
