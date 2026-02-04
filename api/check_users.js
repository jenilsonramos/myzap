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
        console.log('--- USERS ---');
        const [users] = await conn.query('SELECT id, name, email, plan FROM users');
        console.table(users);

        console.log('\n--- INSTANCES ---');
        const [instances] = await conn.query('SELECT business_name, user_id FROM whatsapp_accounts');
        console.table(instances);

        if (instances.length > 0) {
            console.log('\n--- DIAGNOSIS ---');
            instances.forEach(i => {
                const owner = users.find(u => u.id === i.user_id);
                console.log(`Instance '${i.business_name}' belongs to User ID ${i.user_id} (${owner ? owner.name : 'Unknown'})`);
            });
        }

        await conn.end();
    } catch (err) {
        console.error('Error:', err.message);
    }
}

check();
