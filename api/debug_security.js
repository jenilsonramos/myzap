const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkSecurity() {
    const pool = await mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'ublochat_user',
        password: process.env.DB_PASSWORD || 'uBoX4+5pacw2WJBn',
        database: process.env.DB_NAME || 'ublochat_db'
    });

    try {
        console.log('--- USER DISTRIBUTION ---');
        const [users] = await pool.query('SELECT id, email FROM users');
        console.log(`Total users: ${users.length}`);

        console.log('\n--- INSTANCE OWNERSHIP ---');
        const [accounts] = await pool.query('SELECT user_id, business_name FROM whatsapp_accounts');
        console.table(accounts);

        const counts = {};
        accounts.forEach(a => {
            counts[a.user_id] = (counts[a.user_id] || 0) + 1;
        });
        console.log('\nInstances per User ID:', counts);

        // Check if there are instances with no user_id (though column is NOT NULL)
        const [nulls] = await pool.query('SELECT COUNT(*) as count FROM whatsapp_accounts WHERE user_id IS NULL OR user_id = 0');
        console.log('\nInstances with user_id 0 or NULL:', nulls[0].count);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

checkSecurity();
