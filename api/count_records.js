const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

async function check() {
    try {
        const pool = await mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'ublochat_user',
            password: process.env.DB_PASSWORD || 'uBoX4+5pacw2WJBn',
            database: process.env.DB_NAME || 'ublochat_db'
        });

        const [users] = await pool.query("SELECT COUNT(*) as count FROM users");
        const [accounts] = await pool.query("SELECT COUNT(*) as count FROM whatsapp_accounts");
        const [contacts] = await pool.query("SELECT COUNT(*) as count FROM contacts");
        const [messages] = await pool.query("SELECT COUNT(*) as count FROM messages");

        console.log(`Users: ${users[0].count}`);
        console.log(`WhatsApp Accounts: ${accounts[0].count}`);
        console.log(`Contacts: ${contacts[0].count}`);
        console.log(`Messages: ${messages[0].count}`);

        await pool.end();
    } catch (err) {
        console.error("Error:", err.message);
    }
}
check();
