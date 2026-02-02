
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

async function forceSanitize() {
    try {
        if (!pool) return;
        console.log('🧹 [FAXINA] Iniciando limpeza...');

        await pool.execute("UPDATE users SET status = 'active' WHERE status IS NULL OR (status != 'active' AND status != 'inactive')");
        await pool.execute("UPDATE users SET plan = 'Professional' WHERE plan IS NULL OR plan = ''");
        await pool.execute("UPDATE users SET created_at = NOW() WHERE created_at IS NULL OR created_at = '0000-00-00 00:00:00' OR created_at = '0000-00-00' OR created_at = ''");

        console.log(`✨ [FAXINA] Concluída.`);
    } catch (err) {
        console.error('❌ [FAXINA] Erro:', err.message);
    }
}

async function setupTables() {
    try {
        console.log('🏗️ [DB] Verificando tabelas...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS flows (
                id VARCHAR(50) PRIMARY KEY,
                user_id INT,
                name VARCHAR(255),
                content LONGTEXT,
                status VARCHAR(20) DEFAULT 'paused',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Tenta converter content para LONGTEXT silenciando erros se já estiver correto
        await pool.query('ALTER TABLE flows MODIFY COLUMN content LONGTEXT').catch(() => { });

        console.log('✅ [DB] Tabelas prontas.');
        await forceSanitize();
    } catch (err) {
        console.error('❌ [DB] Erro no setup:', err.message);
    }
}

async function connectToDB() {
    try {
        pool = mysql.createPool({
            ...dbConfig,
            waitForConnections: true,
            connectionLimit: 10,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0
        });
        console.log('✅ MyZap MySQL Pool Criado.');

        // Setup de tabelas pós-inicialização para não travar o server
        setTimeout(setupTables, 1000);
    } catch (err) {
        console.error('❌ Erro Crítico MySQL:', err.message);
    }
}

connectToDB();

// --- ENDPOINTS ---

app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const [rows] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (rows.length > 0) return res.status(400).json({ error: 'Email já cadastrado.' });

        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.execute(
            "INSERT INTO users (name, email, password, status, plan, created_at, updated_at) VALUES (?, ?, ?, 'active', 'Professional', NOW(), NOW())",
            [name, email, hashedPassword]
        ).catch(async () => {
            await pool.execute("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", [name, email, hashedPassword]);
        });

        res.status(201).json({ message: 'Sucesso!' });
    } catch (err) {
        res.status(500).json({ error: 'Erro no servidor.' });
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
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, process.env.JWT_SECRET || 'myzap_secret_key', (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- ADMIN ---
app.get('/api/admin/users', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT id, name, email, plan, status, created_at FROM users ORDER BY created_at DESC');
        res.json(rows.map(u => ({
            ...u,
            status: (u.status === 'active' || u.status === 'inactive') ? u.status : 'active',
            plan: u.plan || 'Professional',
            created_at: (u.created_at && u.created_at !== '0000-00-00 00:00:00') ? u.created_at : new Date()
        })));
    } catch (err) {
        res.status(500).json({ error: 'Erro' });
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

// --- FLUXOS ---

app.get('/api/flows', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT id, name, status, updated_at FROM flows WHERE user_id = ? ORDER BY updated_at DESC', [req.user.id]);
        res.json(rows);
    } catch (err) {
        console.error('❌ Erro GET /api/flows:', err.message);
        res.status(500).json({ error: 'Erro' });
    }
});

app.post('/api/flows', authenticateToken, async (req, res) => {
    const { id, name } = req.body;
    try {
        const emptyContent = JSON.stringify({ nodes: [], edges: [] });
        await pool.execute(
            'INSERT INTO flows (id, user_id, name, content, status) VALUES (?, ?, ?, ?, ?)',
            [id, req.user.id, name, emptyContent, 'paused']
        );
        res.status(201).json({ message: 'OK' });
    } catch (err) {
        console.error('❌ Erro POST /api/flows:', err.message);
        res.status(500).json({ error: 'Erro ao criar fluxo', details: err.message });
    }
});

app.get('/api/flows/:id', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM flows WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Nao encontrado' });
        res.json(rows[0]);
    } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

app.put('/api/flows/:id', authenticateToken, async (req, res) => {
    const { name, content, status } = req.body;
    try {
        await pool.execute(
            'UPDATE flows SET name = ?, content = ?, status = ?, updated_at = NOW() WHERE id = ? AND user_id = ?',
            [name, JSON.stringify(content), status, req.params.id, req.user.id]
        );
        res.json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

app.delete('/api/flows/:id', authenticateToken, async (req, res) => {
    try {
        await pool.execute('DELETE FROM flows WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 API ON: ${PORT}`));
