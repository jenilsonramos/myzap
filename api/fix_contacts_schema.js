const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'ublochat_user',
    password: process.env.DB_PASSWORD || 'uBoX4+5pacw2WJBn',
    database: process.env.DB_NAME || 'ublochat_db'
};

async function migrate() {
    let conn;
    try {
        console.log('🔌 Connecting to database...');
        conn = await mysql.createConnection(dbConfig);

        console.log('🛠️ Altering contacts table schema (TINYINT -> VARCHAR)...');
        // Modify column type
        await conn.query("ALTER TABLE contacts MODIFY COLUMN status VARCHAR(20) DEFAULT 'open'");
        console.log('✅ Column type updated.');

        console.log('🔄 updating old status values (0 -> open)...');
        // Update old values
        const [result] = await conn.query("UPDATE contacts SET status = 'open' WHERE status = '0'");
        console.log(`✅ Updated ${result.changedRows} rows.`);

        console.log('🎉 Migration finished successfully.');

    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        if (conn) await conn.end();
    }
}

migrate();
