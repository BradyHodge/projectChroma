import { Router } from 'express';
import db from '../models/index.js';

const router = Router();

// Admin role check middleware
const isAdmin = async (req, res, next) => {
    if (!req.session.user) {
        req.session.returnTo = req.originalUrl;
        return res.redirect('/auth/login');
    }

    try {
        // Get user role 
        const result = await db.query(
            'SELECT role_name FROM USER_ROLES WHERE role_id = $1',
            [req.session.user.role_id]
        );

        if (result.rows.length === 0 || 
            (result.rows[0].role_name !== 'Administrator' && 
             result.rows[0].role_name !== 'Moderator')) {
            return res.status(403).render('error', { 
                title: 'Access Denied',
                message: 'You do not have permission to access the admin panel.'
            });
        }

        // Set isAdministrator flag for template use
        res.locals.isAdministrator = result.rows[0].role_name === 'Administrator';
        next();
    } catch (error) {
        console.error('Admin check error:', error);
        return res.status(500).render('error', { 
            title: 'Server Error',
            message: 'An error occurred while checking admin permissions.'
        });
    }
};

// Admin dashboard
router.get('/', isAdmin, async (req, res) => {
    try {
        // Get counts for dashboard
        const counts = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM USERS) AS user_count,
                (SELECT COUNT(*) FROM PALETTES) AS palette_count,
                (SELECT COUNT(*) FROM UPVOTES) AS upvote_count,
                (SELECT COUNT(*) FROM CONTACT_MESSAGES WHERE is_resolved = false) AS open_messages
        `);

        // Get recent user registrations
        const recentUsers = await db.query(`
            SELECT user_id, username, email, created_at
            FROM USERS
            ORDER BY created_at DESC
            LIMIT 5
        `);

        // Get recent palettes
        const recentPalettes = await db.query(`
            SELECT p.palette_id, p.name, u.username, p.created_at
            FROM PALETTES p
            JOIN USERS u ON p.user_id = u.user_id
            ORDER BY p.created_at DESC
            LIMIT 5
        `);

        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            user: req.session.user,
            stats: counts.rows[0],
            recentUsers: recentUsers.rows,
            recentPalettes: recentPalettes.rows
        });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).render('error', { 
            title: 'Server Error',
            message: 'An error occurred while loading the admin dashboard.'
        });
    }
});

// User management page
router.get('/users', isAdmin, async (req, res) => {
    try {
        const users = await db.query(`
            SELECT u.user_id, u.username, u.email, u.created_at, u.last_login, 
                   u.is_disabled, r.role_name
            FROM USERS u
            JOIN USER_ROLES r ON u.role_id = r.role_id
            ORDER BY u.created_at DESC
        `);

        res.render('admin/users', {
            title: 'User Management',
            user: req.session.user,
            users: users.rows
        });
    } catch (error) {
        console.error('User management error:', error);
        res.status(500).render('error', { 
            title: 'Server Error',
            message: 'An error occurred while loading the user management page.'
        });
    }
});

// Toggle user disabled status (Moderator+)
router.post('/users/:id/toggle-status', isAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        
        // Don't allow disabling own account
        if (userId == req.session.user.user_id) {
            return res.status(400).json({
                success: false,
                message: 'You cannot disable your own account'
            });
        }
        
        // Get current status
        const userResult = await db.query(
            'SELECT is_disabled FROM USERS WHERE user_id = $1',
            [userId]
        );
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        const isCurrentlyDisabled = userResult.rows[0].is_disabled;
        
        // Toggle status
        await db.query(
            'UPDATE USERS SET is_disabled = $1 WHERE user_id = $2',
            [!isCurrentlyDisabled, userId]
        );
        
        return res.json({
            success: true,
            newStatus: !isCurrentlyDisabled
        });
    } catch (error) {
        console.error('Toggle user status error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Change user role (Administrator only)
router.post('/users/:id/change-role', isAdmin, async (req, res) => {
    // Only administrators can change roles
    if (!res.locals.isAdministrator) {
        return res.status(403).json({
            success: false,
            message: 'Only administrators can change user roles'
        });
    }
    
    const userId = req.params.id;
    const { roleId } = req.body;
    
    // Validate role ID
    if (!roleId || isNaN(parseInt(roleId))) {
        return res.status(400).json({
            success: false,
            message: 'Invalid role ID'
        });
    }
    
    try {
        // Don't allow changing own role
        if (userId == req.session.user.user_id) {
            return res.status(400).json({
                success: false,
                message: 'You cannot change your own role'
            });
        }
        
        // Check if role exists
        const roleResult = await db.query(
            'SELECT role_name FROM USER_ROLES WHERE role_id = $1',
            [roleId]
        );
        
        if (roleResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Role not found'
            });
        }
        
        // Update user role
        await db.query(
            'UPDATE USERS SET role_id = $1 WHERE user_id = $2',
            [roleId, userId]
        );
        
        return res.json({
            success: true,
            newRole: roleResult.rows[0].role_name
        });
    } catch (error) {
        console.error('Change user role error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Delete user (Administrator only)
router.post('/users/:id/delete', isAdmin, async (req, res) => {
    // Only administrators can delete users
    if (!res.locals.isAdministrator) {
        return res.status(403).json({
            success: false,
            message: 'Only administrators can delete users'
        });
    }
    
    const userId = req.params.id;
    
    try {
        // Don't allow deleting own account
        if (userId == req.session.user.user_id) {
            return res.status(400).json({
                success: false,
                message: 'You cannot delete your own account'
            });
        }
        
        // Delete user (this will cascade delete all their palettes and upvotes)
        await db.query('DELETE FROM USERS WHERE user_id = $1', [userId]);
        
        return res.json({
            success: true
        });
    } catch (error) {
        console.error('Delete user error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Contact messages management
router.get('/messages', isAdmin, async (req, res) => {
    try {
        const messages = await db.query(`
            SELECT cm.message_id, cm.subject, cm.message_content, cm.submitted_at,
                   cm.is_resolved, cm.resolved_at, u.username as submitted_by,
                   ru.username as resolved_by
            FROM CONTACT_MESSAGES cm
            LEFT JOIN USERS u ON cm.user_id = u.user_id
            LEFT JOIN USERS ru ON cm.resolved_by_user_id = ru.user_id
            ORDER BY cm.is_resolved ASC, cm.submitted_at DESC
        `);
        
        res.render('admin/messages', {
            title: 'Contact Messages',
            user: req.session.user,
            messages: messages.rows
        });
    } catch (error) {
        console.error('Contact messages error:', error);
        res.status(500).render('error', { 
            title: 'Server Error',
            message: 'An error occurred while loading contact messages.'
        });
    }
});

// Mark message as resolved
router.post('/messages/:id/resolve', isAdmin, async (req, res) => {
    try {
        const messageId = req.params.id;
        
        await db.query(`
            UPDATE CONTACT_MESSAGES 
            SET is_resolved = true, 
                resolved_by_user_id = $1,
                resolved_at = CURRENT_TIMESTAMP
            WHERE message_id = $2
        `, [req.session.user.user_id, messageId]);
        
        return res.json({
            success: true
        });
    } catch (error) {
        console.error('Resolve message error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Palette management
router.get('/palettes', isAdmin, async (req, res) => {
    try {
        const palettes = await db.query(`
            SELECT p.palette_id, p.name, p.description, p.created_at,
                   p.upvote_count, p.is_public, u.username
            FROM PALETTES p
            JOIN USERS u ON p.user_id = u.user_id
            ORDER BY p.created_at DESC
        `);
        
        res.render('admin/palettes', {
            title: 'Palette Management',
            user: req.session.user,
            palettes: palettes.rows
        });
    } catch (error) {
        console.error('Palette management error:', error);
        res.status(500).render('error', { 
            title: 'Server Error',
            message: 'An error occurred while loading the palette management page.'
        });
    }
});

// Delete palette (Administrator only)
router.post('/palettes/:id/delete', isAdmin, async (req, res) => {
    // Only administrators can delete palettes they don't own
    if (!res.locals.isAdministrator) {
        return res.status(403).json({
            success: false,
            message: 'Only administrators can delete palettes'
        });
    }
    
    const paletteId = req.params.id;
    
    try {
        // Delete palette
        await db.query('DELETE FROM PALETTES WHERE palette_id = $1', [paletteId]);
        
        return res.json({
            success: true
        });
    } catch (error) {
        console.error('Delete palette error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

export default router;