
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

        if (!colNames.includes('status')) {
            await pool.execute("ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active'");
        }
        if (!colNames.includes('plan')) {
            await pool.execute("ALTER TABLE users ADD COLUMN plan VARCHAR(50) DEFAULT 'Professional'");
        }
        if (!colNames.includes('created_at')) {
            await pool.execute("ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP");
        }
        if (!colNames.includes('updated_at')) {
            await pool.execute("ALTER TABLE users ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
        }

        // Saneamento leve (evita loops pesados)
        await pool.execute("UPDATE users SET status = 'active' WHERE status IS NULL OR (status != 'active' AND status != 'inactive')");
        await pool.execute("UPDATE users SET plan = 'Professional' WHERE plan IS NULL OR plan = ''");

        console.log('✅ Estrutura da tabela de usuários verificada.');
    } catch (err) {
        console.warn('⚠️ Aviso no setupUsersTable (não crítico):', err.message);
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
        console.log('✅ Pool de conexões MySQL criado.');
        // Rodar setup em background para não travar o início
        setupUsersTable().catch(err => console.error('Erro no setup inicial:', err));
    } catch (err) {
        console.error('❌ Erro crítico ao conectar ao MySQL:', err.message);
    }
}

connectToDB();

// --- HEALTH CHECK ---
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', mysql: pool ? 'Connected' : 'Disconnected' });
});

// --- ENDPOINTS DE AUTENTICAÇÃO ---

app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Preencha todos os campos.' });

    try {
        const [rows] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (rows.length > 0) return res.status(400).json({ error: 'Este email já está cadastrado.' });

        const hashedPassword = await bcrypt.hash(password, 10);

        let result;
        try {
            // Tentativa 1: INSERT Completo (Ideal)
            console.log('Tentando registro completo para:', email);
            [result] = await pool.execute(
                "INSERT INTO users (name, email, password, status, plan, created_at, updated_at) VALUES (?, ?, ?, 'active', 'Professional', NOW(), NOW())",
                [name, email, hashedPassword]
            );
        } catch (sqlErr) {
            console.warn('⚠️ SQL Completo Falhou, tentando minimalista:', sqlErr.message);
            // Tentativa 2: INSERT Minimalista (Fallback de Segurança)
            try {
                [result] = await pool.execute(
                    "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
                    [name, email, hashedPassword]
                );
            } catch (minErr) {
                console.error('❌ Erro fatal no registro:', minErr.message);
                throw minErr; // Repassa para o catch principal
            }
        }

        res.status(201).json({ message: 'Usuário cadastrado com sucesso!', id: result.insertId });
    } catch (err) {
        console.error('ERRO NO REGISTRO:', err.message);
        res.status(500).json({
            error: 'Erro ao criar conta.',
            details: err.message
        });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
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
        res.status(500).json({ error: 'Erro interno no login.' });
    }
});

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    jwt.verify(token, process.env.JWT_SECRET || 'myzap_secret_key', (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};

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
        await pool.execute('UPDATE users SET status = ?, plan = ? WHERE id = ?', [status, plan, id]);
        res.json({ message: 'OK' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao atualizar.' });
    }
});

app.delete('/api/admin/users/:id', authenticateToken, async (req, res) => {
    try {
        await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ message: 'OK' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao excluir.' });
    }
});

// --- SETTINGS ---
app.get('/api/admin/settings', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT setting_key, setting_value FROM system_settings');
        const settings = rows.reduce((acc, row) => ({ ...acc, [row.setting_key]: row.setting_value }), {});
        res.json(settings);
    } catch (err) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/admin/settings', authenticateToken, async (req, res) => {
    try {
        for (const [key, value] of Object.entries(req.body)) {
            await pool.execute('INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?', [key, value, value]);
        }
        res.json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: 'Error' }); }
});

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 API rodando na porta ${PORT}`);
});
