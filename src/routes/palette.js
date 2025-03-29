import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import db from '../models/index.js';

const router = Router();

// Authentication middleware
const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    res.redirect('/auth/login');
};

// Permission checking middleware
const hasPermission = (permission) => {
    return async (req, res, next) => {
        if (!req.session.user) {
            return res.redirect('auth/login');
        }

        try {
            // Get user role and permissions
            const roleResult = await db.query(
                'SELECT permissions FROM USER_ROLES WHERE role_id = $1',
                [req.session.user.role_id]
            );

            if (roleResult.rows.length === 0) {
                return res.status(403).render('error', { 
                    title: 'Permission Denied',
                    message: 'You do not have the required role to perform this action.'
                });
            }

            const permissions = roleResult.rows[0].permissions.split(',');
            
            if (permissions.includes(permission)) {
                return next();
            } else {
                return res.status(403).render('error', { 
                    title: 'Permission Denied',
                    message: 'You do not have the required permission to perform this action.'
                });
            }
        } catch (error) {
            console.error('Permission check error:', error);
            return res.status(500).render('error', { 
                title: 'Server Error',
                message: 'An error occurred while checking permissions.'
            });
        }
    };
};

// Get all public palettes (homepage/explore)
router.get('/', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT p.palette_id, p.name, p.description, p.upvote_count, 
                   p.created_at, u.username, 
                   array_agg(pc.hex_code ORDER BY pc.position) as colors
            FROM PALETTES p
            JOIN USERS u ON p.user_id = u.user_id
            JOIN PALETTE_COLORS pc ON p.palette_id = pc.palette_id
            WHERE p.is_public = true
            GROUP BY p.palette_id, u.username
            ORDER BY p.created_at DESC
            LIMIT 20
        `);

        res.render('palettes/index', { 
            title: 'Explore Palettes',
            palettes: result.rows,
            user: req.session.user || null
        });
    } catch (error) {
        console.error('Error fetching palettes:', error);
        res.status(500).render('error', { 
            title: 'Server Error',
            message: 'An error occurred while loading palettes.'
        });
    }
});

// Get trending palettes (sorted by upvotes)
router.get('/trending', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT p.palette_id, p.name, p.description, p.upvote_count, 
                   p.created_at, u.username, 
                   array_agg(pc.hex_code ORDER BY pc.position) as colors
            FROM PALETTES p
            JOIN USERS u ON p.user_id = u.user_id
            JOIN PALETTE_COLORS pc ON p.palette_id = pc.palette_id
            WHERE p.is_public = true
            GROUP BY p.palette_id, u.username
            ORDER BY p.upvote_count DESC, p.created_at DESC
            LIMIT 20
        `);

        res.render('palettes/index', { 
            title: 'Trending Palettes',
            palettes: result.rows,
            user: req.session.user || null
        });
    } catch (error) {
        console.error('Error fetching trending palettes:', error);
        res.status(500).render('error', { 
            title: 'Server Error',
            message: 'An error occurred while loading trending palettes.'
        });
    }
});

// Show palette creation form
router.get('/create', isAuthenticated, hasPermission('create_palettes'), (req, res) => {
    res.render('palettes/create', { 
        title: 'Create Palette',
        user: req.session.user
    });
});

// Handle palette creation
router.post(
    '/create',
    isAuthenticated,
    hasPermission('create_palettes'),
    (req, res, next) => {
        if (typeof req.body.colors === 'string') {
            try {
                req.body.colors = JSON.parse(req.body.colors);
            } catch (err) {t
            }
        }
        if (req.body.isPublic === undefined) {
            req.body.isPublic = false;
        } else if (req.body.isPublic === 'true') {
            req.body.isPublic = true;
        }
        
        next();
    },
    [
        body('name').trim().isLength({ min: 3, max: 100 }).withMessage('Palette name must be between 3 and 100 characters'),
        body('description').trim().isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
        body('colors').isArray({ min: 2, max: 10 }).withMessage('Palette must have between 2 and 10 colors'),
        body('colors.*').isHexColor().withMessage('All colors must be valid hex codes'),
        body('isPublic').isBoolean().withMessage('Public setting must be a boolean')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).render('palettes/create', {
                title: 'Create Palette',
                user: req.session.user,
                errors: errors.array(),
                formData: req.body
            });
        }

        try {
            // Normalize colors to ensure they have # prefix
            const colors = req.body.colors.map(color => 
                color.startsWith('#') ? color : `#${color}`
            );

            // Start a transaction
            await db.query('BEGIN');

            // Insert palette
            const paletteResult = await db.query(
                `INSERT INTO PALETTES(user_id, name, description, is_public) 
                 VALUES($1, $2, $3, $4) RETURNING palette_id`,
                [req.session.user.user_id, req.body.name, req.body.description, req.body.isPublic]
            );

            const paletteId = paletteResult.rows[0].palette_id;

            // Insert colors
            for (let i = 0; i < colors.length; i++) {
                await db.query(
                    `INSERT INTO PALETTE_COLORS(palette_id, hex_code, position) 
                     VALUES($1, $2, $3)`,
                    [paletteId, colors[i], i]
                );
            }

            // Commit transaction
            await db.query('COMMIT');

            res.redirect(`/palettes/${paletteId}`);
        } catch (error) {
            await db.query('ROLLBACK');
            console.error('Error creating palette:', error);
            res.status(500).render('error', { 
                title: 'Server Error',
                message: 'An error occurred while creating the palette.'
            });
        }
    }
);

// View a single palette
router.get('/:id', async (req, res) => {
    try {
        const paletteResult = await db.query(`
            SELECT p.palette_id, p.name, p.description, p.upvote_count, 
                   p.created_at, p.is_public, p.user_id, u.username, 
                   array_agg(pc.hex_code ORDER BY pc.position) as colors
            FROM PALETTES p
            JOIN USERS u ON p.user_id = u.user_id
            JOIN PALETTE_COLORS pc ON p.palette_id = pc.palette_id
            WHERE p.palette_id = $1
            GROUP BY p.palette_id, u.username
        `, [req.params.id]);

        if (paletteResult.rows.length === 0) {
            return res.status(404).render('error', { 
                title: 'Not Found',
                message: 'The requested palette does not exist.'
            });
        }

        const palette = paletteResult.rows[0];
        
        // Check if private palette and not owner
        if (!palette.is_public && (!req.session.user || req.session.user.user_id !== palette.user_id)) {
            return res.status(403).render('error', { 
                title: 'Access Denied',
                message: 'You do not have permission to view this private palette.'
            });
        }

        // Check if user has upvoted this palette
        let hasUpvoted = false;
        if (req.session.user) {
            const upvoteResult = await db.query(
                'SELECT 1 FROM UPVOTES WHERE user_id = $1 AND palette_id = $2',
                [req.session.user.user_id, palette.palette_id]
            );
            hasUpvoted = upvoteResult.rows.length > 0;
        }

        const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        res.render('palettes/view', { 
            title: palette.name,
            fullUrl: fullUrl,
            palette,
            hasUpvoted,
            isOwner: req.session.user && req.session.user.user_id === palette.user_id,
            user: req.session.user || null
        });
    } catch (error) {
        console.error('Error fetching palette:', error);
        res.status(500).render('error', { 
            title: 'Server Error',
            message: 'An error occurred while loading the palette.'
        });
    }
});

// Handle upvoting
router.post('/:id/upvote', isAuthenticated, async (req, res) => {
    try {
        const paletteId = req.params.id;
        const userId = req.session.user.user_id;

        // Check if palette exists
        const paletteResult = await db.query(
            'SELECT 1 FROM PALETTES WHERE palette_id = $1',
            [paletteId]
        );

        if (paletteResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Palette not found' });
        }

        // Check if user has already upvoted
        const upvoteResult = await db.query(
            'SELECT 1 FROM UPVOTES WHERE user_id = $1 AND palette_id = $2',
            [userId, paletteId]
        );

        if (upvoteResult.rows.length > 0) {
            // User has already upvoted, so remove the upvote
            await db.query(
                'DELETE FROM UPVOTES WHERE user_id = $1 AND palette_id = $2',
                [userId, paletteId]
            );
            return res.json({ success: true, action: 'removed' });
        } else {
            // User hasn't upvoted, so add an upvote
            await db.query(
                'INSERT INTO UPVOTES(user_id, palette_id) VALUES($1, $2)',
                [userId, paletteId]
            );
            return res.json({ success: true, action: 'added' });
        }
    } catch (error) {
        console.error('Error handling upvote:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Edit palette form
router.get('/:id/edit', isAuthenticated, async (req, res) => {
    try {
        const paletteResult = await db.query(`
            SELECT p.palette_id, p.name, p.description, p.is_public, p.user_id,
                   array_agg(pc.hex_code ORDER BY pc.position) as colors
            FROM PALETTES p
            JOIN PALETTE_COLORS pc ON p.palette_id = pc.palette_id
            WHERE p.palette_id = $1
            GROUP BY p.palette_id
        `, [req.params.id]);

        if (paletteResult.rows.length === 0) {
            return res.status(404).render('error', { 
                title: 'Not Found',
                message: 'The requested palette does not exist.'
            });
        }

        const palette = paletteResult.rows[0];
        
        // Check if user is the owner or an admin
        const isAdmin = req.session.user.role_id === 3; // Admin role_id is 3
        const isOwner = req.session.user.user_id === palette.user_id;
        
        if (!isOwner && !isAdmin) {
            return res.status(403).render('error', { 
                title: 'Permission Denied',
                message: 'You do not have permission to edit this palette.'
            });
        }

        res.render('palettes/edit', { 
            title: `Edit: ${palette.name}`,
            palette,
            user: req.session.user
        });
    } catch (error) {
        console.error('Error fetching palette for edit:', error);
        res.status(500).render('error', { 
            title: 'Server Error',
            message: 'An error occurred while loading the palette.'
        });
    }
});

// Update palette
router.post(
    '/:id/edit',
    isAuthenticated,
    [
        body('name').trim().isLength({ min: 3, max: 100 }).withMessage('Palette name must be between 3 and 100 characters'),
        body('description').trim().isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
        body('colors').isArray({ min: 2, max: 10 }).withMessage('Palette must have between 2 and 10 colors'),
        body('colors.*').isHexColor().withMessage('All colors must be valid hex codes'),
        body('isPublic').isBoolean().withMessage('Public setting must be a boolean')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).render('palettes/edit', {
                title: 'Edit Palette',
                user: req.session.user,
                errors: errors.array(),
                palette: {
                    palette_id: req.params.id,
                    ...req.body
                }
            });
        }

        try {
            // Get the palette to check if user is owner
            const paletteResult = await db.query(
                'SELECT user_id FROM PALETTES WHERE palette_id = $1',
                [req.params.id]
            );

            if (paletteResult.rows.length === 0) {
                return res.status(404).render('error', { 
                    title: 'Not Found',
                    message: 'The requested palette does not exist.'
                });
            }

            const isAdmin = req.session.user.role_id === 3; // Admin role_id is 3
            const isOwner = req.session.user.user_id === paletteResult.rows[0].user_id;
            
            if (!isOwner && !isAdmin) {
                return res.status(403).render('error', { 
                    title: 'Permission Denied',
                    message: 'You do not have permission to edit this palette.'
                });
            }

            // Normalize colors to ensure they have # prefix
            const colors = req.body.colors.map(color => 
                color.startsWith('#') ? color : `#${color}`
            );

            // Start a transaction
            await db.query('BEGIN');

            // Update palette
            await db.query(
                `UPDATE PALETTES 
                 SET name = $1, description = $2, is_public = $3
                 WHERE palette_id = $4`,
                [req.body.name, req.body.description, req.body.isPublic, req.params.id]
            );

            // Delete existing colors
            await db.query(
                'DELETE FROM PALETTE_COLORS WHERE palette_id = $1',
                [req.params.id]
            );

            // Insert new colors
            for (let i = 0; i < colors.length; i++) {
                await db.query(
                    `INSERT INTO PALETTE_COLORS(palette_id, hex_code, position) 
                     VALUES($1, $2, $3)`,
                    [req.params.id, colors[i], i]
                );
            }

            // Commit transaction
            await db.query('COMMIT');

            res.redirect(`/palettes/${req.params.id}`);
        } catch (error) {
            await db.query('ROLLBACK');
            console.error('Error updating palette:', error);
            res.status(500).render('error', { 
                title: 'Server Error',
                message: 'An error occurred while updating the palette.'
            });
        }
    }
);

// Delete palette
router.post('/:id/delete', isAuthenticated, async (req, res) => {
    try {
        // Get the palette to check if user is owner
        const paletteResult = await db.query(
            'SELECT user_id FROM PALETTES WHERE palette_id = $1',
            [req.params.id]
        );

        if (paletteResult.rows.length === 0) {
            return res.status(404).render('error', { 
                title: 'Not Found',
                message: 'The requested palette does not exist.'
            });
        }

        const isAdmin = req.session.user.role_id === 3; // Admin role_id is 3
        const isOwner = req.session.user.user_id === paletteResult.rows[0].user_id;
        
        if (!isOwner && !isAdmin) {
            return res.status(403).render('error', { 
                title: 'Permission Denied',
                message: 'You do not have permission to delete this palette.'
            });
        }

        // Delete the palette (cascade will delete colors and upvotes)
        await db.query(
            'DELETE FROM PALETTES WHERE palette_id = $1',
            [req.params.id]
        );

        res.redirect('/palettes');
    } catch (error) {
        console.error('Error deleting palette:', error);
        res.status(500).render('error', { 
            title: 'Server Error',
            message: 'An error occurred while deleting the palette.'
        });
    }
});

// Get user's palettes
router.get('/user/:username', async (req, res) => {
    try {
        // Get user ID from username
        const userResult = await db.query(
            'SELECT user_id, is_disabled FROM USERS WHERE username = $1',
            [req.params.username]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).render('error', { 
                title: 'Not Found',
                message: 'The requested user does not exist.'
            });
        }

        const userId = userResult.rows[0].user_id;
        const isDisabled = userResult.rows[0].is_disabled;

        // Check if viewing user's own profile
        const isOwnProfile = req.session.user && req.session.user.user_id === userId;

        // Query condition
        let condition = 'p.user_id = $1';
        if (!isOwnProfile) {
            condition += ' AND p.is_public = true';
        }

        // Get palettes
        const palettesResult = await db.query(`
            SELECT p.palette_id, p.name, p.description, p.upvote_count, 
                   p.created_at, p.is_public, u.username, 
                   array_agg(pc.hex_code ORDER BY pc.position) as colors
            FROM PALETTES p
            JOIN USERS u ON p.user_id = u.user_id
            JOIN PALETTE_COLORS pc ON p.palette_id = pc.palette_id
            WHERE ${condition}
            GROUP BY p.palette_id, u.username
            ORDER BY p.created_at DESC
        `, [userId]);

        res.render('palettes/user', { 
            title: `${req.params.username}'s Palettes`,
            palettes: palettesResult.rows,
            username: req.params.username,
            isOwnProfile,
            isDisabled,
            user: req.session.user || null
        });
    } catch (error) {
        console.error('Error fetching user palettes:', error);
        res.status(500).render('error', { 
            title: 'Server Error',
            message: 'An error occurred while loading user palettes.'
        });
    }
});

export default router;