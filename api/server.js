
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

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 API do MyZap rodando em http://0.0.0.0:${PORT}`);
});
