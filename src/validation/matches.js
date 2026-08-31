import { z } from 'zod';

export const MATCH_STATUS = {
  scheduled: 'scheduled',
  live: 'live',
  finished: 'finished',
};

const positiveInt = z.coerce.number().int().positive();
const nonNegativeInt = z.coerce.number().int().min(0);

export const listMatchesQuerySchema = z.object({
  limit: positiveInt.max(100).optional(),
});

export const matchIdParamSchema = z.object({
  id: positiveInt,
});

export const createMatchSchema = z
  .object({
    sport: z.string().min(1),
    homeTeam: z.string().min(1),
    awayTeam: z.string().min(1),
    startTime: z.string(),
    endTime: z.string(),
    homeScore: nonNegativeInt.optional(),
    awayScore: nonNegativeInt.optional(),
  })
  .refine((data) => !Number.isNaN(Date.parse(data.startTime)), {
    message: 'startTime must be a valid ISO date string',
    path: ['startTime'],
  })
  .refine((data) => !Number.isNaN(Date.parse(data.endTime)), {
    message: 'endTime must be a valid ISO date string',
    path: ['endTime'],
  })
  .superRefine((data, ctx) => {
    if (Date.parse(data.endTime) <= Date.parse(data.startTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endTime must be after startTime',
        path: ['endTime'],
      });
    }
  });

export const updateScoreSchema = z.object({
  homeScore: nonNegativeInt,
  awayScore: nonNegativeInt,
});
