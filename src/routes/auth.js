import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import db from '../models/index.js';
import crypto from 'crypto';

const router = Router();

// Function to hash a password with salt
const hashPassword = (password) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
};

// Function to verify password
const verifyPassword = (password, storedPassword) => {
    const [salt, hash] = storedPassword.split(':');
    const calculatedHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === calculatedHash;
};

// Middleware to redirect authenticated users
const redirectIfAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    next();
};

// Registration form
router.get('/register', redirectIfAuthenticated, (req, res) => {
    res.render('auth/register', { title: 'Register' });
});

// Process registration
router.post(
    '/register',
    redirectIfAuthenticated,
    [
        body('username')
            .trim()
            .isLength({ min: 3, max: 50 })
            .withMessage('Username must be between 3 and 50 characters')
            .matches(/^[a-zA-Z0-9_]+$/)
            .withMessage('Username can only contain letters, numbers, and underscores'),
        body('email')
            .trim()
            .isEmail()
            .withMessage('Please provide a valid email address'),
        body('password')
            .isLength({ min: 8 })
            .withMessage('Password must be at least 8 characters long'),
        body('confirmPassword')
            .custom((value, { req }) => {
                if (value !== req.body.password) {
                    throw new Error('Passwords do not match');
                }
                return true;
            })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).render('auth/register', {
                title: 'Register',
                errors: errors.array(),
                formData: {
                    username: req.body.username,
                    email: req.body.email
                }
            });
        }

        try {
            // Check if username or email already exists
            const existingUser = await db.query(
                'SELECT 1 FROM USERS WHERE username = $1 OR email = $2',
                [req.body.username, req.body.email]
            );

            if (existingUser.rows.length > 0) {
                return res.status(400).render('auth/register', {
                    title: 'Register',
                    errors: [{ msg: 'Username or email already in use' }],
                    formData: {
                        username: req.body.username,
                        email: req.body.email
                    }
                });
            }

            // Hash password
            const passwordHash = hashPassword(req.body.password);

            // Insert new user with 'Default' role (role_id = 1)
            const result = await db.query(
                `INSERT INTO USERS(username, email, password_hash, role_id) 
                 VALUES($1, $2, $3, 1) RETURNING user_id, username, email, role_id`,
                [req.body.username, req.body.email, passwordHash]
            );

            // Set user session
            const user = result.rows[0];
            req.session.user = user;

            res.redirect('/');
        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).render('error', { 
                title: 'Server Error',
                message: 'An error occurred during registration.'
            });
        }
    }
);

// Login form
router.get('/login', redirectIfAuthenticated, (req, res) => {
    res.render('auth/login', { title: 'Login' });
});

// Process login
router.post(
    '/login',
    redirectIfAuthenticated,
    [
        body('username').trim().notEmpty().withMessage('Username is required'),
        body('password').notEmpty().withMessage('Password is required')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).render('auth/login', {
                title: 'Login',
                errors: errors.array(),
                formData: {
                    username: req.body.username
                }
            });
        }

        try {
            // Find user by username
            const result = await db.query(
                'SELECT user_id, username, email, password_hash, role_id, is_disabled FROM USERS WHERE username = $1',
                [req.body.username]
            );

            if (result.rows.length === 0) {
                return res.status(400).render('auth/login', {
                    title: 'Login',
                    errors: [{ msg: 'Invalid username or password' }],
                    formData: {
                        username: req.body.username
                    }
                });
            }

            const user = result.rows[0];

            // Check if account is disabled
            if (user.is_disabled) {
                return res.status(403).render('auth/login', {
                    title: 'Login',
                    errors: [{ msg: 'Your account has been disabled. Please contact support.' }],
                    formData: {
                        username: req.body.username
                    }
                });
            }

            // Verify password
            if (!verifyPassword(req.body.password, user.password_hash)) {
                return res.status(400).render('auth/login', {
                    title: 'Login',
                    errors: [{ msg: 'Invalid username or password' }],
                    formData: {
                        username: req.body.username
                    }
                });
            }

            // Update last login time
            await db.query(
                'UPDATE USERS SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1',
                [user.user_id]
            );

            // Set user session (excluding password hash)
            delete user.password_hash;
            delete user.is_disabled;
            req.session.user = user;

            // Redirect to intended location or home
            const redirectTo = req.session.returnTo || '/';
            delete req.session.returnTo;
            res.redirect(redirectTo);
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).render('error', { 
                title: 'Server Error',
                message: 'An error occurred during login.'
            });
        }
    }
);

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).render('error', { 
                title: 'Server Error',
                message: 'An error occurred during logout.'
            });
        }
        res.redirect('/');
    });
});

export default router;