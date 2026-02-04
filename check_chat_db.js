require('dotenv').config();
const mysql = require('mysql2/promise');

async function check() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'ublochat_user',
        password: process.env.DB_PASSWORD || 'uBoX4+5pacw2WJBn',
        database: process.env.DB_NAME || 'ublochat_db'
    });

    try {
        const [contacts] = await pool.query("SELECT * FROM contacts");
        const [messages] = await pool.query("SELECT * FROM messages");

        console.log('📊 Contatos:', contacts.length);
        console.log(JSON.stringify(contacts, null, 2));

        console.log('📊 Mensagens:', messages.length);
        console.log(JSON.stringify(messages, null, 2));

    } catch (err) {
        console.error('❌ Erro:', err.message);
    } finally {
        await pool.end();
    }
}
check();
