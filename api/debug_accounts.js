const mysql = require('mysql2/promise');
require('dotenv').config();

async function debugDB() {
    const pool = await mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'ublochat_user',
        password: process.env.DB_PASSWORD || 'uBoX4+5pacw2WJBn',
        database: process.env.DB_NAME || 'ublochat_db'
    });

    try {
        console.log('--- USERS ---');
        const [users] = await pool.query('SELECT id, name, email FROM users');
        console.table(users);

        console.log('\n--- ALL TABLES ---');
        const [allTables] = await pool.query('SHOW TABLES');
        console.table(allTables);

        console.log('\n--- WHATSAPP_ACCOUNTS INFO ---');
        const [tables] = await pool.query("SHOW TABLES LIKE 'whatsapp_accounts'");
        if (tables.length === 0) {
            console.log('Table whatsapp_accounts does not exist!');
            return;
        }

        const [accounts] = await pool.query('SELECT user_id, business_name FROM whatsapp_accounts');
        console.table(accounts);

        console.log('\n--- SESSION INFO ---');
        console.log('JWT_SECRET configured:', !!process.env.JWT_SECRET);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

debugDB();
