
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
        console.log('🧹 [FAXINA] Iniciando limpeza forçada...');

        // 1. Forçar status 'active' para quem não é explicitamente 'inactive'
        await pool.execute("UPDATE users SET status = 'active' WHERE status IS NULL OR (status != 'active' AND status != 'inactive')");

        // 2. Garantir Plano Professional
        await pool.execute("UPDATE users SET plan = 'Professional' WHERE plan IS NULL OR plan = ''");

        // 3. Consertar Datas Nulas ou Zeradas
        await pool.execute("UPDATE users SET created_at = NOW() WHERE created_at IS NULL OR created_at = '0000-00-00 00:00:00' OR created_at = '0000-00-00' OR created_at = ''");
        await pool.execute("UPDATE users SET updated_at = NOW() WHERE updated_at IS NULL OR updated_at = '0000-00-00 00:00:00' OR updated_at = '0000-00-00' OR updated_at = ''");

        console.log('✨ [FAXINA] Banco de dados limpo e organizado!');
    } catch (err) {
        console.error('❌ [FAXINA] Falha ao limpar banco:', err.message);
    }
}

async function connectToDB() {
    try {
        pool = mysql.createPool({
            ...dbConfig,
            waitForConnections: true,
            connectionLimit: 5,
            queueLimit: 0
        });
        console.log('✅ Pool MySQL Conectado.');
        // Roda a primeira faxina na hora!
        await forceSanitize();
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

        // INSERT BLINDADO: Tenta o máximo, se falhar, tenta o básico
        let result;
        try {
            [result] = await pool.execute(
                "INSERT INTO users (name, email, password, status, plan, created_at, updated_at) VALUES (?, ?, ?, 'active', 'Professional', NOW(), NOW())",
                [name, email, hashedPassword]
            );
        } catch (e) {
            console.warn('⚠️ Fallback de registro para:', email);
            [result] = await pool.execute(
                "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
                [name, email, hashedPassword]
            );
            // Se usou fallback, força a faxina imediata para esse usuário
            await forceSanitize();
        }

        res.status(201).json({ message: 'Sucesso!' });
    } catch (err) {
        res.status(500).json({ error: 'Erro no servidor.', details: err.message });
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

// Middleware de Autenticação
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, process.env.JWT_SECRET || 'myzap_secret_key', (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- GESTÃO ADMIN ---
app.get('/api/admin/users', authenticateToken, async (req, res) => {
    try {
        // Roda a faxina toda vez que o admin entra, só por segurança!
        await forceSanitize();

        const [rows] = await pool.execute('SELECT id, name, email, plan, status, created_at FROM users ORDER BY created_at DESC');

        // Log diagnóstico (para eu ver no console do PM2)
        console.log('📋 Enviando lista de usuários para o Admin...');
        console.table(rows.map(u => ({ Nome: u.name, Status: u.status, Data: u.created_at })));

        res.json(rows);
    } catch (err) {
        console.error('Erro ao listar:', err);
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

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 MyZap API ON: ${PORT}`));
