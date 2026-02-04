const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'ublochat_user',
    password: process.env.DB_PASSWORD || 'uBoX4+5pacw2WJBn',
    database: process.env.DB_NAME || 'ublochat_db'
};

async function check() {
    try {
        const conn = await mysql.createConnection(dbConfig);

        console.log('\n--- SCHEMA: CONTACTS ---');
        const [schema] = await conn.query('DESCRIBE contacts');
        // Filter for relevant columns to keep output concise
        console.table(schema.filter(c => ['id', 'user_id', 'status', 'remote_jid'].includes(c.Field)));

        console.log('\n--- CONTACTS COUNT BY USER ---');
        const [counts] = await conn.query('SELECT user_id, COUNT(*) as count FROM contacts GROUP BY user_id');
        console.table(counts);

        console.log('\n--- RECENT CONTACTS DETAILS ---');
        const [recent] = await conn.query('SELECT id, user_id, name, remote_jid, status FROM contacts ORDER BY id DESC LIMIT 5');
        console.table(recent);

        await conn.end();
    } catch (err) {
        console.error('Error:', err.message);
    }
}

check();
