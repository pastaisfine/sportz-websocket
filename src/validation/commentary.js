import { z } from 'zod';

const positiveInt = z.coerce.number().int().positive();
const nonNegativeInt = z.coerce.number().int().min(0);

export const listCommentaryQuerySchema = z.object({
  limit: positiveInt.max(100).optional(),
});

export const createCommentarySchema = z.object({
  minute: nonNegativeInt.optional(),
  sequence: nonNegativeInt,
  period: z.string().min(1).optional(),
  eventType: z.string().min(1),
  actor: z.string().min(1).optional(),
  team: z.string().min(1).optional(),
  message: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});
