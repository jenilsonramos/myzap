const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'ublochat_user',
    password: process.env.DB_PASSWORD || 'uBoX4+5pacw2WJBn',
    database: process.env.DB_NAME || 'ublochat_db'
};

async function check() {
    try {
        const conn = await mysql.createConnection(dbConfig);
        console.log('Connected!');
        const [rows] = await conn.query('SHOW TABLES');
        console.log('Tables:', rows);
        await conn.end();
    } catch (err) {
        console.error('Error:', err.message);
    }
}

check();
