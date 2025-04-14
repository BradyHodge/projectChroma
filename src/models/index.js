import pg from 'pg';
import fs from 'fs';

const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
    });

let dbClient;

if (process.env.NODE_ENV.toLowerCase().includes('dev')) {
    /**
     * Instead of giving the user the original pool object, we can create a
     * wrapper that allows us to control what actions the user can take on the
     * pool. In this case, we only want the user to be able to query the pool
     * and we want to automatically log all queries that are executed.
     */
    dbClient = {
        async query(text, params) {
            try {
                const res = await pool.query(text, params);
                // console.log('Executed query:', { text });
                return res;
            } catch (error) {
                console.error('Error in query:', { text });
                throw error;
            }
        }
    };
} else {
    // We are in production, so we can just export the pool object directly.
    dbClient = pool;
}

// Setup function that can be used on server startup
export const setupDatabase = async () => {
    console.log("database init")
    const sql = fs.readFileSync('./src/models/setup.sql', 'utf-8');
    await dbClient.query(sql);
};

// Test function that can be used to test the database
export const testDatabase = async () => {
    try {
        const res = await dbClient.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        if (res.rows.length === 0) {
            console.log('No tables found in the database.');
            await setupDatabase();
        } else {
            console.log('Tables in the database:', res.rows.map(row => row.table_name));
        }
    } catch (error) {
        console.error('Error fetching tables:', error);
    }
};

export default dbClient;