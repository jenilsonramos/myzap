
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Configuração do Banco de Dados
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'myzap_user',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'myzap'
};

let pool;

async function setupUsersTable() {
    try {
        if (!pool) return;
        const [columns] = await pool.execute('SHOW COLUMNS FROM users');
        const colNames = columns.map(c => c.Field);

        // Garante colunas com DEFAULTS corretos
        if (!colNames.includes('status')) {
            await pool.execute("ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active'");
        }
        if (!colNames.includes('plan')) {
            await pool.execute("ALTER TABLE users ADD COLUMN plan VARCHAR(50) DEFAULT 'Professional'");
        }
        if (!colNames.includes('created_at')) {
            await pool.execute("ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
        }
        if (!colNames.includes('updated_at')) {
            await pool.execute("ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
        }

        // --- SANEAMENTO DE DADOS FORÇADO ---
        // Resolve o problema de usuários que nasceram com NULL
        await pool.execute("UPDATE users SET status = 'active' WHERE status IS NULL OR status = ''");
        await pool.execute("UPDATE users SET plan = 'Professional' WHERE plan IS NULL OR plan = ''");
        await pool.execute("UPDATE users SET created_at = NOW() WHERE created_at IS NULL OR created_at = '0000-00-00 00:00:00'");
        await pool.execute("UPDATE users SET updated_at = NOW() WHERE updated_at IS NULL OR updated_at = '0000-00-00 00:00:00'");

        console.log('✅ Banco de dados saneado e sincronizado.');
    } catch (err) {
        console.error('⚠️ Erro no setup do banco:', err.message);
    }
}

async function connectToDB() {
    try {
        pool = mysql.createPool({
            ...dbConfig,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
        console.log('✅ Conectado ao MySQL.');
        setTimeout(() => setupUsersTable(), 2000); // Roda após 2 segundos
    } catch (err) {
        console.error('❌ Erro MySQL:', err.message);
    }
}

connectToDB();

// --- ENDPOINTS ---

app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Campos obrigatórios.' });

    try {
        const [rows] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (rows.length > 0) return res.status(400).json({ error: 'Email já existe.' });

        const hashedPassword = await bcrypt.hash(password, 10);

        // Tenta inserir com o máximo de campos possível
        let result;
        try {
            [result] = await pool.execute(
                "INSERT INTO users (name, email, password, status, plan, created_at) VALUES (?, ?, ?, 'active', 'Professional', NOW())",
                [name, email, hashedPassword]
            );
        } catch (e) {
            console.warn('Fallback no registro para:', email);
            [result] = await pool.execute(
                "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
                [name, email, hashedPassword]
            );
        }

        res.status(201).json({ message: 'Sucesso!', id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: 'Erro no banco.', details: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) return res.status(401).json({ error: 'Usuário não encontrado.' });
        const user = rows[0];
        if (!await bcrypt.compare(password, user.password)) return res.status(401).json({ error: 'Senha incorreta.' });

        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name },
            process.env.JWT_SECRET || 'myzap_secret_key',
            { expiresIn: '7d' }
        );
        res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
    } catch (err) {
        res.status(500).json({ error: 'Erro no login.' });
    }
});

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, process.env.JWT_SECRET || 'myzap_secret_key', (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

app.get('/api/admin/users', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT id, name, email, plan, status, created_at FROM users ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao listar.' });
    }
});

app.put('/api/admin/users/:id', authenticateToken, async (req, res) => {
    const { status, plan } = req.body;
    try {
        await pool.execute('UPDATE users SET status = ?, plan = ?, updated_at = NOW() WHERE id = ?', [status, plan, req.params.id]);
        res.json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

app.delete('/api/admin/users/:id', authenticateToken, async (req, res) => {
    try {
        await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// --- SETTINGS ---
app.get('/api/admin/settings', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT setting_key, setting_value FROM system_settings');
        res.json(rows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {}));
    } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

app.post('/api/admin/settings', authenticateToken, async (req, res) => {
    try {
        for (const [key, value] of Object.entries(req.body)) {
            await pool.execute('INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?', [key, value, value]);
        }
        res.json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// --- EVOLUTION PROXY ---
app.get('/api/evolution/instance/fetchInstances', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ("evolution_url", "evolution_apikey")');
        const config = rows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});
        const url = config.evolution_url?.replace(/\/$/, '');
        if (!url || !config.evolution_apikey) return res.status(400).json({ error: 'Não configurado.' });

        const response = await fetch(`${url}/instance/fetchInstances`, { headers: { 'apikey': config.evolution_apikey } });
        res.json(await response.json());
    } catch (err) { res.status(500).json({ error: 'Erro Evolution.' }); }
});

app.get('/api/health', (req, res) => res.json({ status: 'OK' }));

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => console.log('🚀 Port 5000'));
