
const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'ublochat_user',
    password: process.env.DB_PASSWORD || 'uBoX4+5pacw2WJBn',
    database: process.env.DB_NAME || 'ublochat_db'
};

async function checkRecentMessages() {
    let connection;
    try {
        console.log('Connecting to DB...');
        connection = await mysql.createConnection(dbConfig);

        console.log('\n--- LAST 10 MESSAGES ---');
        const [rows] = await connection.execute(
            `SELECT id, user_id, contact_id, instance_name, key_from_me, type, content, timestamp, msg_status 
             FROM messages 
             ORDER BY id DESC LIMIT 10`
        );
        console.table(rows);

        console.log('\n--- LAST 5 RECEIVED MESSAGES (key_from_me = 0) ---');
        const [received] = await connection.execute(
            `SELECT id, user_id, contact_id, instance_name, key_from_me, type, content, timestamp 
             FROM messages 
             WHERE key_from_me = 0 
             ORDER BY id DESC LIMIT 5`
        );
        console.table(received);

        if (received.length === 0) {
            console.log('❌ No received messages found in the last batch.');
        }

        console.log('\n--- CONTACT CHECK ---');
        if (received.length > 0 && received[0].contact_id) {
            const [contact] = await connection.execute('SELECT * FROM contacts WHERE id = ?', [received[0].contact_id]);
            console.log('Linked Contact:', contact[0]);
        } else if (received.length > 0) {
            console.log('⚠️ Received message has NULL contact_id!');
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        if (connection) await connection.end();
    }
}

checkRecentMessages();
