import configNodeEnv from './src/middleware/node-env.js';
import express from "express";
import fileUploads from './src/middleware/file-uploads.js';
import homeRoute from './src/routes/index.js';
import paletteRoutes from './src/routes/palette.js';
import authRoutes from './src/routes/auth.js';
import adminRoutes from './src/routes/admin.js';
import contactRoutes from './src/routes/contact.js';
import layouts from './src/middleware/layouts.js';
import path from "path";
import { configureStaticPaths } from './src/utils/index.js';
import { fileURLToPath } from 'url';
import { testDatabase, setupDatabase } from './src/models/index.js';
import expressSession from 'express-session';
import pgSession from 'connect-pg-simple';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mode = process.env.NODE_ENV;
const port = process.env.PORT;

const app = express();

// Configure the application based on environment settings
app.use(configNodeEnv);

// Configure static paths (public dirs) for the Express application
configureStaticPaths(app);

// Set up session middleware with PostgreSQL session store
const PostgresqlStore = pgSession(expressSession);
app.use(expressSession({
    store: new PostgresqlStore({
        conString: process.env.DB_URL,
        tableName: 'SESSIONS',
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || 'color-palette-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        secure: !mode.includes('dev')
    }
}));

// Set EJS as the view engine and record the location of the views directory
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

// Set Layouts middleware to automatically wrap views in a layout and configure default layout
app.set('layout default', 'default');
app.set('layouts', path.join(__dirname, 'src/views/layouts'));
app.use(layouts);

// Middleware to process multipart form data with file uploads
app.use(fileUploads);

// Middleware to parse JSON data in request body
app.use(express.json());

// Middleware to parse URL-encoded form data (like from a standard HTML form)
app.use(express.urlencoded({ extended: true }));

// Make user available to all views
app.use((req, res, next) => {
    if (req.session.user) {
        res.locals.user = req.session.user;
    }
    next();
});

/**
 * Routes
 */

app.use('/', homeRoute);
app.use('/palettes', paletteRoutes);
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/contact', contactRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).render('error', {
        title: 'Page Not Found',
        message: 'The page you requested does not exist.'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    res.status(500).render('error', {
        title: 'Server Error',
        message: mode.includes('dev') ? err.message : 'An unexpected error occurred.'
    });
});

/**
 * Start the server
 */

// When in development mode, start a WebSocket server for live reloading
if (mode.includes('dev')) {
    const ws = await import('ws');

    try {
        const wsPort = parseInt(port) + 1;
        const wsServer = new ws.WebSocketServer({ port: wsPort });

        wsServer.on('listening', () => {
            console.log(`WebSocket server is running on port ${wsPort}`);
        });

        wsServer.on('error', (error) => {
            console.error('WebSocket server error:', error);
        });
    } catch (error) {
        console.error('Failed to start WebSocket server:', error);
    }
}

// Start the Express server
app.listen(port, async () => {
    await testDatabase();
    await setupDatabase();
    console.log(`Server running on http://127.0.0.1:${port}`);
});