import { z } from "zod";

// DRAFT schemas are deliberately permissive: this is the AI's first pass for
// human review, so a single odd field (a 0 quantity, a negative line, a decimal
// price) must not throw the whole extraction away. Amounts here are decimal
// major units as printed on the receipt (130.00); extract.ts converts them to
// integer minor units before storing. Strictness lives in the confirm schemas.
export const draftItemSchema = z.object({
  rawName: z.string().min(1),
  quantity: z.number().nullable(),
  lineTotal: z.number(),
  productId: z.string().uuid().nullable(),
  brand: z.string().nullable(),
  packSizeBase: z.number().positive().nullable(),
  baseUnit: z.enum(["ml", "g", "each"]).nullable(),
  sourceLineIds: z.array(z.string()).min(1),
});

export const draftSchema = z.object({
  store: z.string().nullable(),
  purchasedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  currency: z.string().length(3).default("KES"),
  total: z.number(),
  items: z.array(draftItemSchema).min(1),
  adjustments: z.array(z.object({
    label: z.string().min(1),
    amount: z.number(),
  })).default([]),
});

export const confirmItemSchema = z.object({
  rawName: z.string().min(1),
  quantity: z.number().positive(),
  lineTotal: z.number().int().nonnegative(),
  productId: z.string().uuid(),
  brand: z.string().nullable(),
  packSizeBase: z.number().positive(),
  baseUnit: z.enum(["ml", "g", "each"]),
  sourceLineIds: z.array(z.string()).min(1),
});

export const confirmSchema = z.object({
  store: z.string().min(1),
  purchasedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currency: z.string().length(3).default("KES"),
  total: z.number().int().positive(),
  items: z.array(confirmItemSchema).min(1),
  adjustments: z.array(z.object({
    label: z.string().min(1),
    amount: z.number().int(),
  })).default([]),
  mismatchAcknowledged: z.boolean().default(false),
});

export type DraftItem = z.infer<typeof draftItemSchema>;
export type Draft = z.infer<typeof draftSchema>;
export type ConfirmItem = z.infer<typeof confirmItemSchema>;
export type Confirm = z.infer<typeof confirmSchema>;