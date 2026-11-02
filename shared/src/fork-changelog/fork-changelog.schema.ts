import { z } from 'zod';

export const FORK_CHANGELOG_ITEM_KINDS = ['added', 'changed', 'fixed'] as const;

const isRealDate = (value: string): boolean => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
};

export const forkChangelogItemSchema = z.object({
  kind: z.enum(FORK_CHANGELOG_ITEM_KINDS),
  text: z.string().min(1),
});

export const forkChangelogEntrySchema = z.object({
  id: z.string().min(1),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(isRealDate, 'not a real calendar date'),
  title: z.string().min(1),
  items: z.array(forkChangelogItemSchema).min(1),
});

export const forkChangelogSchema = z.array(forkChangelogEntrySchema).superRefine((entries, ctx) => {
  const seen = new Set<string>();
  entries.forEach((entry, index) => {
    if (seen.has(entry.id)) {
      ctx.addIssue({ code: 'custom', path: [index, 'id'], message: `duplicate entry id "${entry.id}"` });
    }
    seen.add(entry.id);
  });
});

export const forkChangelogResponseSchema = z.object({ entries: forkChangelogSchema });

export type ForkChangelogItem = z.infer<typeof forkChangelogItemSchema>;
export type ForkChangelogEntry = z.infer<typeof forkChangelogEntrySchema>;
export type ForkChangelogResponse = z.infer<typeof forkChangelogResponseSchema>;
