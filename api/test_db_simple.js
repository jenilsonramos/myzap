const mysql = require('mysql2/promise');

async function test() {
    console.log('Connecting...');
    try {
        const conn = await mysql.createConnection({
            host: 'ublochat.com.br',
            user: 'ublochat_user',
            password: 'uBoX4+5pacw2WJBn',
            database: 'ublochat_db'
        });
        console.log('Connected!');

        const [tables] = await conn.query('SHOW TABLES');
        console.log('Tables:', tables);

        await conn.end();
    } catch (err) {
        console.error('Connection failed:', err.message);
    }
}

test();
