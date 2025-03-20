import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import db from '../models/index.js';

const router = Router();

// Show contact form
router.get('/', (req, res) => {
    res.render('contact/index', { 
        title: 'Contact Us',
        user: req.session.user || null
    });
});

// Process contact form submission
router.post(
    '/',
    [
        body('subject').trim().isLength({ min: 5, max: 200 }).withMessage('Subject must be between 5 and 200 characters'),
        body('message').trim().isLength({ min: 20, max: 2000 }).withMessage('Message must be between 20 and 2000 characters'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).render('contact/index', {
                title: 'Contact Us',
                errors: errors.array(),
                formData: req.body,
                user: req.session.user || null
            });
        }

        try {
            // Determine user_id (if logged in)
            const userId = req.session.user ? req.session.user.user_id : null;
            
            // Insert message
            await db.query(
                `INSERT INTO CONTACT_MESSAGES(user_id, subject, message_content) 
                 VALUES($1, $2, $3)`,
                [userId, req.body.subject, req.body.message]
            );

            res.render('contact/success', { 
                title: 'Message Sent',
                user: req.session.user || null
            });
        } catch (error) {
            console.error('Contact form error:', error);
            res.status(500).render('error', { 
                title: 'Server Error',
                message: 'An error occurred while sending your message. Please try again later.'
            });
        }
    }
);

export default router;