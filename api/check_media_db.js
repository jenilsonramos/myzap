const mysql = require('mysql2/promise');

async function checkMediaMessages() {
    const pool = mysql.createPool({
        host: 'localhost',
        port: 3306,
        user: 'ublochat_user',
        password: 'uBoX4+5pacw2WJBn',
        database: 'ublochat_db',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        const [rows] = await pool.query("SELECT * FROM messages WHERE type IN ('image', 'audio', 'video', 'document') ORDER BY id DESC LIMIT 5");
        console.log("--- ULTIMAS MENSAGENS DE MIDIA ---");
        console.log(JSON.stringify(rows, null, 2));

        if (rows.length > 0) {
            const contactIds = [...new Set(rows.map(r => r.contact_id))];
            const [contacts] = await pool.query("SELECT id, remote_jid, instance_name FROM contacts WHERE id IN (?)", [contactIds]);
            console.log("--- CONTATOS RELACIONADOS ---");
            console.log(JSON.stringify(contacts, null, 2));
        }

    } catch (err) {
        console.error("Erro:", err.message);
    } finally {
        await pool.end();
    }
}

checkMediaMessages();
