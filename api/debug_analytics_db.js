const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../.env' });

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
};

async function checkData() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Connected to DB');

        const [rows] = await connection.execute('SELECT * FROM messages ORDER BY id DESC LIMIT 5');
        console.log('--- Last 5 Messages ---');
        console.log(JSON.stringify(rows, null, 2));

        const [count] = await connection.execute('SELECT COUNT(*) as total FROM messages');
        console.log('Total Messages:', count[0].total);

        // Check timestamp format of one record
        if (rows.length > 0) {
            console.log('Sample Timestamp:', rows[0].timestamp, 'Type:', typeof rows[0].timestamp);
            console.log('Sample CreatedAt:', rows[0].created_at);
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        if (connection) await connection.end();
    }
}

checkData();
