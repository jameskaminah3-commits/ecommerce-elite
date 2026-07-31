import { eq } from "drizzle-orm";
import {
  categoriesTable,
  db,
  pool,
  productsTable,
  productVariantsTable,
} from "@workspace/db";

const categories = [
  {
    name: "Electronics",
    slug: "electronics",
    description: "Smart devices, audio gear, and useful accessories.",
    imageUrl: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800&auto=format&fit=crop&q=80",
  },
  {
    name: "Home & Living",
    slug: "home-living",
    description: "Kitchen, furniture, storage, and daily home essentials.",
    imageUrl: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&auto=format&fit=crop&q=80",
  },
  {
    name: "Beauty",
    slug: "beauty",
    description: "Skincare, haircare, and personal care products.",
    imageUrl: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&auto=format&fit=crop&q=80",
  },
  {
    name: "Gym & Fitness",
    slug: "gym-fitness",
    description: "Workout gear and home fitness equipment.",
    imageUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop&q=80",
  },
];

const products = [
  {
    categorySlug: "electronics",
    name: "NovaBass Wireless Headphones",
    slug: "novabass-wireless-headphones",
    description: "Comfortable over-ear headphones with deep bass and long battery life.",
    basePrice: "4200.00",
    compareAtPrice: "5200.00",
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=900&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=900&auto=format&fit=crop&q=80",
    ],
    featured: true,
    rating: "4.70",
    reviewCount: 38,
    variants: [
      { sku: "ELEC-NBH-BLK", color: "Black", price: "4200.00", stock: 24 },
      { sku: "ELEC-NBH-SLV", color: "Silver", price: "4200.00", stock: 12 },
    ],
  },
  {
    categorySlug: "electronics",
    name: "Amani 4K Smart TV 43 Inch",
    slug: "amani-4k-smart-tv-43",
    description: "Crisp 4K display with streaming apps and slim bezels.",
    basePrice: "31500.00",
    compareAtPrice: "34900.00",
    imageUrl: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=900&auto=format&fit=crop&q=80",
    images: [],
    featured: true,
    rating: "4.50",
    reviewCount: 21,
    variants: [
      { sku: "ELEC-TV43-STD", size: "43 inch", color: "Black", price: "31500.00", stock: 7 },
    ],
  },
  {
    categorySlug: "home-living",
    name: "ChefPro Non-Stick Cookware Set",
    slug: "chefpro-non-stick-cookware-set",
    description: "Durable non-stick pots and pans for daily home or restaurant use.",
    basePrice: "6800.00",
    compareAtPrice: "7900.00",
    imageUrl: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=900&auto=format&fit=crop&q=80",
    images: [
      "https://images.unsplash.com/photo-1585515320310-259814833e62?w=900&auto=format&fit=crop&q=80",
    ],
    featured: true,
    rating: "4.80",
    reviewCount: 44,
    variants: [
      { sku: "HOME-COOK-5PC", size: "5 piece", color: "Black", price: "6800.00", stock: 18 },
      { sku: "HOME-COOK-8PC", size: "8 piece", color: "Black", price: "9800.00", stock: 10 },
    ],
  },
  {
    categorySlug: "home-living",
    name: "ErgoFlex Office Chair",
    slug: "ergoflex-office-chair",
    description: "Breathable ergonomic office chair with adjustable height and tilt.",
    basePrice: "9500.00",
    compareAtPrice: null,
    imageUrl: "https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=900&auto=format&fit=crop&q=80",
    images: [],
    featured: false,
    rating: "4.40",
    reviewCount: 17,
    variants: [
      { sku: "HOME-CHAIR-BLK", color: "Black", price: "9500.00", stock: 15 },
      { sku: "HOME-CHAIR-GRY", color: "Grey", price: "9500.00", stock: 8 },
    ],
  },
  {
    categorySlug: "beauty",
    name: "GlowCare Vitamin C Serum",
    slug: "glowcare-vitamin-c-serum",
    description: "Brightening face serum with vitamin C for daily skincare routines.",
    basePrice: "1350.00",
    compareAtPrice: "1700.00",
    imageUrl: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=900&auto=format&fit=crop&q=80",
    images: [],
    featured: true,
    rating: "4.60",
    reviewCount: 59,
    variants: [
      { sku: "BEAUTY-VITC-30", size: "30ml", price: "1350.00", stock: 36 },
      { sku: "BEAUTY-VITC-50", size: "50ml", price: "1900.00", stock: 20 },
    ],
  },
  {
    categorySlug: "gym-fitness",
    name: "PowerGrip Yoga Mat",
    slug: "powergrip-yoga-mat",
    description: "Non-slip mat for yoga, stretching, pilates, and home workouts.",
    basePrice: "2200.00",
    compareAtPrice: null,
    imageUrl: "https://images.unsplash.com/photo-1601925228008-22d2a5090f0c?w=900&auto=format&fit=crop&q=80",
    images: [],
    featured: false,
    rating: "4.30",
    reviewCount: 26,
    variants: [
      { sku: "GYM-MAT-BLU", color: "Blue", price: "2200.00", stock: 22 },
      { sku: "GYM-MAT-PNK", color: "Pink", price: "2200.00", stock: 13 },
    ],
  },
];

async function upsertCategory(category: (typeof categories)[number]) {
  const [row] = await db
    .insert(categoriesTable)
    .values(category)
    .onConflictDoUpdate({
      target: categoriesTable.slug,
      set: {
        name: category.name,
        description: category.description,
        imageUrl: category.imageUrl,
      },
    })
    .returning();

  return row;
}

async function main(): Promise<void> {
  const categoryBySlug = new Map<string, number>();

  for (const category of categories) {
    const row = await upsertCategory(category);
    categoryBySlug.set(category.slug, row.id);
  }

  for (const product of products) {
    const categoryId = categoryBySlug.get(product.categorySlug);

    if (!categoryId) {
      throw new Error(`Missing category "${product.categorySlug}"`);
    }

    const [productRow] = await db
      .insert(productsTable)
      .values({
        name: product.name,
        slug: product.slug,
        description: product.description,
        basePrice: product.basePrice,
        compareAtPrice: product.compareAtPrice,
        categoryId,
        imageUrl: product.imageUrl,
        images: product.images,
        status: "active",
        featured: product.featured,
        rating: product.rating,
        reviewCount: product.reviewCount,
      })
      .onConflictDoUpdate({
        target: productsTable.slug,
        set: {
          name: product.name,
          description: product.description,
          basePrice: product.basePrice,
          compareAtPrice: product.compareAtPrice,
          categoryId,
          imageUrl: product.imageUrl,
          images: product.images,
          status: "active",
          featured: product.featured,
          rating: product.rating,
          reviewCount: product.reviewCount,
        },
      })
      .returning();

    for (const variant of product.variants) {
      await db
        .insert(productVariantsTable)
        .values({
          productId: productRow.id,
          sku: variant.sku,
          size: "size" in variant ? variant.size ?? null : null,
          color: "color" in variant ? variant.color ?? null : null,
          price: variant.price,
          stock: variant.stock,
        })
        .onConflictDoUpdate({
          target: productVariantsTable.sku,
          set: {
            productId: productRow.id,
            size: "size" in variant ? variant.size ?? null : null,
            color: "color" in variant ? variant.color ?? null : null,
            price: variant.price,
            stock: variant.stock,
          },
        });
    }
  }

  console.log(`Seeded ${categories.length} categories and ${products.length} products.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
