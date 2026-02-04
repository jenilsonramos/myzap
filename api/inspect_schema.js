const mysql = require('mysql2/promise');
require('dotenv').config();

async function inspect() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        const tables = ['contacts', 'messages'];
        for (const table of tables) {
            console.log(`\n--- SCHEMA: ${table} ---`);
            try {
                const [rows] = await pool.query(`DESCRIBE ${table}`);
                console.table(rows.map(r => ({ Field: r.Field, Type: r.Type, Null: r.Null, Key: r.Key })));
            } catch (err) {
                console.error(`Error describing ${table}:`, err.message);
            }
        }
    } catch (err) {
        console.error('Fatal Error:', err.message);
    } finally {
        await pool.end();
    }
}

inspect();
