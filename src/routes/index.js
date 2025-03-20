import { Router } from 'express';
import db from '../models/index.js';

const router = Router();
 
// The home page route
router.get('/', async (req, res) => {
    try {
        // Get trending palettes for homepage
        const trendingPalettes = await db.query(`
            SELECT p.palette_id, p.name, p.description, p.upvote_count, 
                  p.created_at, u.username, 
                  array_agg(pc.hex_code ORDER BY pc.position) as colors
            FROM PALETTES p
            JOIN USERS u ON p.user_id = u.user_id
            JOIN PALETTE_COLORS pc ON p.palette_id = pc.palette_id
            WHERE p.is_public = true
            GROUP BY p.palette_id, u.username
            ORDER BY p.upvote_count DESC, p.created_at DESC
            LIMIT 8
        `);

        // Get recent palettes for homepage
        const recentPalettes = await db.query(`
            SELECT p.palette_id, p.name, p.description, p.upvote_count, 
                  p.created_at, u.username, 
                  array_agg(pc.hex_code ORDER BY pc.position) as colors
            FROM PALETTES p
            JOIN USERS u ON p.user_id = u.user_id
            JOIN PALETTE_COLORS pc ON p.palette_id = pc.palette_id
            WHERE p.is_public = true
            GROUP BY p.palette_id, u.username
            ORDER BY p.created_at DESC
            LIMIT 8
        `);

        res.render('index', { 
            title: 'Color Palette Generator', 
            trendingPalettes: trendingPalettes.rows,
            recentPalettes: recentPalettes.rows
        });
    } catch (error) {
        console.error('Homepage error:', error);
        res.status(500).render('error', { 
            title: 'Server Error',
            message: 'An error occurred while loading the homepage.'
        });
    }
});

export default router;