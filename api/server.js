
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

async function connectToDB() {
    try {
        pool = mysql.createPool(dbConfig);
        console.log('✅ Conectado ao MySQL com sucesso!');
    } catch (err) {
        console.error('❌ Erro ao conectar ao MySQL:', err.message);
    }
}

connectToDB();

// --- HEALTH CHECK ---
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', uptime: process.uptime(), mysql: pool ? 'Connected' : 'Disconnected' });
});

// --- ENDPOINTS DE AUTENTICAÇÃO ---

app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Preencha todos os campos.' });
    try {
        const [rows] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (rows.length > 0) return res.status(400).json({ error: 'Este email já está cadastrado.' });
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await pool.execute(
            'INSERT INTO users (name, email, password, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
            [name, email, hashedPassword]
        );
        res.status(201).json({ message: 'Usuário cadastrado com sucesso!', id: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Preencha email e senha.' });
    try {
        const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) return res.status(401).json({ error: 'Usuário não encontrado.' });
        const user = rows[0];
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) return res.status(401).json({ error: 'Senha incorreta.' });
        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name },
            process.env.JWT_SECRET || 'myzap_secret_key',
            { expiresIn: '7d' }
        );
        res.json({ message: 'Login realizado!', token, user: { id: user.id, name: user.name, email: user.email } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro interno.' });
    }
});

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token não fornecido.' });

    jwt.verify(token, process.env.JWT_SECRET || 'myzap_secret_key', (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido ou expirado.' });
        req.user = user;
        next();
    });
};

app.put('/api/auth/update', authenticateToken, async (req, res) => {
    const { name, email } = req.body;
    const userId = req.user.id;

    if (!name || !email) return res.status(400).json({ error: 'Nome e email são obrigatórios.' });

    try {
        // Verifica se o email já existe para outro usuário
        const [rows] = await pool.execute('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
        if (rows.length > 0) return res.status(400).json({ error: 'Este email já está em uso por outro usuário.' });

        await pool.execute(
            'UPDATE users SET name = ?, email = ?, updated_at = NOW() WHERE id = ?',
            [name, email, userId]
        );

        res.json({ message: 'Perfil atualizado com sucesso!', user: { id: userId, name, email } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao atualizar perfil no banco de dados.' });
    }
});

// --- GESTÃO DE USUÁRIOS (ADMIN) ---
async function setupUsersTable() {
    try {
        // Garante que as colunas status e plan existam
        const [columns] = await pool.execute('SHOW COLUMNS FROM users');
        const colNames = columns.map(c => c.Field);

        if (!colNames.includes('status')) {
            await pool.execute("ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active'");
        }
        if (!colNames.includes('plan')) {
            await pool.execute("ALTER TABLE users ADD COLUMN plan VARCHAR(50) DEFAULT 'Professional'");
        }
    } catch (err) {
        console.error('Erro ao configurar colunas de usuários:', err);
    }
}
setupUsersTable();

app.get('/api/admin/users', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT id, name, email, plan, status, created_at FROM users ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao listar usuários.' });
    }
});

app.put('/api/admin/users/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { status, plan } = req.body;
    try {
        await pool.execute(
            'UPDATE users SET status = ?, plan = ?, updated_at = NOW() WHERE id = ?',
            [status, plan, id]
        );
        res.json({ message: 'Usuário atualizado com sucesso!' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao atualizar usuário.' });
    }
});

app.delete('/api/admin/users/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.execute('DELETE FROM users WHERE id = ?', [id]);
        res.json({ message: 'Usuário removido com sucesso!' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao excluir usuário.' });
    }
});

// --- CONFIGURAÇÕES DE SISTEMA ---
async function setupSystemSettings() {
    try {
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS system_settings (
                setting_key VARCHAR(100) PRIMARY KEY,
                setting_value TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
    } catch (err) {
        console.error('Erro ao criar tabela de configurações:', err);
    }
}
setupSystemSettings();

app.get('/api/admin/settings', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT setting_key, setting_value FROM system_settings');
        const settings = rows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar configurações.' });
    }
});

app.post('/api/admin/settings', authenticateToken, async (req, res) => {
    const settings = req.body; // { key: value }
    try {
        for (const [key, value] of Object.entries(settings)) {
            await pool.execute(
                'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
                [key, value, value]
            );
        }
        res.json({ message: 'Configurações salvas!' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao salvar configurações.' });
    }
});

// --- PROXY EVOLUTION API ---
const getEvolutionConfig = async () => {
    const [rows] = await pool.execute('SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ("evolution_url", "evolution_apikey")');
    const config = rows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});
    return {
        url: config.evolution_url?.replace(/\/$/, ''),
        apiKey: config.evolution_apikey
    };
};

app.get('/api/evolution/instance/fetchInstances', authenticateToken, async (req, res) => {
    try {
        const { url, apiKey } = await getEvolutionConfig();
        if (!url || !apiKey) return res.status(400).json({ error: 'Evolution API não configurada no painel.' });

        const response = await fetch(`${url}/instance/fetchInstances`, {
            headers: { 'apikey': apiKey }
        });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar instâncias na Evolution API.' });
    }
});

app.post('/api/evolution/instance/create', authenticateToken, async (req, res) => {
    try {
        const { url, apiKey } = await getEvolutionConfig();
        if (!url || !apiKey) return res.status(400).json({ error: 'Evolution API não configurada.' });

        const response = await fetch(`${url}/instance/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao criar instância.' });
    }
});

app.get('/api/evolution/instance/connect/:instanceName', authenticateToken, async (req, res) => {
    try {
        const { url, apiKey } = await getEvolutionConfig();
        const { instanceName } = req.params;
        const response = await fetch(`${url}/instance/connect/${instanceName}`, {
            headers: { 'apikey': apiKey }
        });
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar QR Code.' });
    }
});

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 API do MyZap rodando em http://0.0.0.0:${PORT}`);
});
