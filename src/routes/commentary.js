import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/db.js';
import { commentary } from '../db/schema.js';
import { matchIdParamSchema } from '../validation/matches.js';
import { createCommentarySchema, listCommentaryQuerySchema } from '../validation/commentary.js';

const MAX_LIMIT = 100;

export const commentaryRouter = Router({ mergeParams: true });

commentaryRouter.get('/', async (req, res) => {
    const paramsResult = matchIdParamSchema.safeParse(req.params);

    if (!paramsResult.success) {
        return res.status(400).json({ error: 'Invalid match ID.', details: paramsResult.error.issues });
    }

    const queryResult = listCommentaryQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
        return res.status(400).json({ error: 'Invalid query parameters.', details: queryResult.error.issues });
    }

    try {
        const { id: matchId } = paramsResult.data;
        const { limit = 10 } = queryResult.data;

        const safeLimit = Math.min(limit, MAX_LIMIT);

        const results = await db
            .select()
            .from(commentary)
            .where(eq(commentary.matchId, matchId))
            .orderBy(desc(commentary.createdAt))
            .limit(safeLimit);

        const data = results.map((entry) => ({
            ...entry,
            tags: entry.tags ? JSON.parse(entry.tags) : null,
        }));

        res.status(200).json({ data });
    } catch (error) {
        console.error('Failed to fetch commentary:', error);
        res.status(500).json({ error: 'Failed to fetch commentary.' });
    }
});

commentaryRouter.post('/', async (req, res) => {
    const paramsResult = matchIdParamSchema.safeParse(req.params);

    if (!paramsResult.success) {
        return res.status(400).json({ error: 'Invalid match ID.', details: paramsResult.error.issues });
    }

    const bodyResult = createCommentarySchema.safeParse(req.body);

    if (!bodyResult.success) {
        return res.status(400).json({ error: 'Invalid payload.', details: bodyResult.error.issues });
    }

    const { tags, ...rest } = bodyResult.data;
    
    try {
        const [entry] = await db
            .insert(commentary)
            .values({
                ...rest,
                matchId: paramsResult.data.id,
                tags: tags ? JSON.stringify(tags) : null,
            })
            .returning();
        
        if(res.app.locals.broadcastCommentary) {
            res.app.locals.broadcastCommentary(paramsResult.data.id, entry);
        }

        res.status(201).json({ data: entry });
    } catch (e) {
        console.error('Failed to create commentary:', e);
        res.status(500).json({ error: 'Failed to create commentary.' });
    }
});
