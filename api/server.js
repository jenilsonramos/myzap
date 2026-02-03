
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
    user: process.env.DB_USER || 'ublochat_user',
    password: process.env.DB_PASSWORD || 'uBoX4+5pacw2WJBn',
    database: process.env.DB_NAME || 'ublochat_db'
};

let pool;

async function forceSanitize() {
    try {
        if (!pool) return;
        await pool.execute("UPDATE users SET status = 'active' WHERE status IS NULL OR (status != 'active' AND status != 'inactive')");
        await pool.execute("UPDATE users SET plan = 'Professional' WHERE plan IS NULL OR plan = ''");
        await pool.execute("UPDATE users SET role = 'user' WHERE role IS NULL OR role = ''");
        await pool.execute("UPDATE users SET role = 'admin' WHERE email = 'jenilson@outlook.com.br'");
        await pool.execute("DELETE FROM users WHERE email = 'admin@site.com'");
        await pool.execute("UPDATE users SET created_at = NOW() WHERE created_at IS NULL OR created_at = '0000-00-00 00:00:00'");
    } catch (err) {
        console.error('❌ [FAXINA] Erro:', err.message);
    }
}

async function setupTables() {
    try {
        console.log('🏗️ [DB] Verificando e reparando esquema de tabelas...');

        // 1. Criar tabela base se não existir
        await pool.query(`CREATE TABLE IF NOT EXISTS flows (id VARCHAR(255) PRIMARY KEY)`);

        // Forçar correção da coluna id caso tenha sido criada errado antes
        await pool.query(`ALTER TABLE flows MODIFY COLUMN id VARCHAR(255)`).catch(() => { });

        // 2. Garantir colunas necessárias (correção de esquema incremental)
        const columns = [
            { name: 'user_id', type: 'INT' },
            { name: 'name', type: 'VARCHAR(255)' },
            { name: 'content', type: 'LONGTEXT' },
            { name: 'status', type: 'VARCHAR(20) DEFAULT "paused"' },
            { name: 'created_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
            { name: 'updated_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
        ];

        for (const col of columns) {
            await pool.query(`ALTER TABLE flows ADD COLUMN ${col.name} ${col.type}`).catch(() => {
                if (col.name === 'content') {
                    pool.query(`ALTER TABLE flows MODIFY COLUMN content LONGTEXT`).catch(() => { });
                }
            });
        }

        // 3. Garantir colunas na tabela users
        await pool.query("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user'").catch(() => { });
        await pool.query("ALTER TABLE users MODIFY COLUMN status VARCHAR(20) DEFAULT 'active'").catch(() => { });
        await pool.query("ALTER TABLE users ADD COLUMN trial_ends_at DATETIME").catch(() => { });

        // 4. Garantir tabela de planos
        await pool.query(`
            CREATE TABLE IF NOT EXISTS plans (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) UNIQUE,
                price DECIMAL(10,2),
                instances INT,
                messages INT,
                ai_nodes INT,
                ai_tokens INT,
                features JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Inserir planos padrão se a tabela estiver vazia
        const [planRows] = await pool.query("SELECT COUNT(*) as count FROM plans");
        if (planRows[0].count === 0) {
            console.log('💎 [DB] Inserindo planos padrão...');
            const defaultPlans = [
                ['Teste Grátis', 0, 3, 1000, 5, 10000, JSON.stringify(['Filtros Básicos'])],
                ['Professional', 99, 10, 100000, 50, 500000, JSON.stringify(['Suporte Especializado', 'Webhooks'])],
                ['Master IA', 299, 50, 1000000, 200, 5000000, JSON.stringify(['Filtros Avançados', 'AI Agent Pro'])],
                ['Enterprise', 499, 999, 9999999, 999, 99999999, JSON.stringify(['SLA 99.9%', 'White-label'])]
            ];
            for (const p of defaultPlans) {
                await pool.query("INSERT INTO plans (name, price, instances, messages, ai_nodes, ai_tokens, features) VALUES (?, ?, ?, ?, ?, ?, ?)", p);
            }
        }

        // 4. Garantir Usuário Admin Mestre (Jenilson)
        const jenilsonEmail = 'jenilson@outlook.com.br';
        const jenilsonPass = '125714Ab#';
        const hashedPass = await bcrypt.hash(jenilsonPass, 10);

        const [existing] = await pool.query("SELECT id FROM users WHERE email = ?", [jenilsonEmail]);
        if (existing.length === 0) {
            console.log('👤 [DB] Criando administrador mestre...');
            await pool.query(
                "INSERT INTO users (name, email, password, role, status, plan) VALUES (?, ?, ?, ?, ?, ?)",
                ['Jenilson Ramos', jenilsonEmail, hashedPass, 'admin', 'active', 'Professional']
            );
        } else {
            console.log('👤 [DB] Atualizando cargo/senha do administrador mestre...');
            await pool.query(
                "UPDATE users SET role = 'admin', password = ?, status = 'active' WHERE email = ?",
                [hashedPass, jenilsonEmail]
            );
        }

        console.log('✅ [DB] Esquema e Administração verificados.');
        await forceSanitize();
    } catch (err) {
        console.error('❌ [DB] Falha crítica no setup:', err.message);
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
        setTimeout(setupTables, 1000);
    } catch (err) {
        console.error('❌ Erro Crítico MySQL:', err.message);
    }
}

connectToDB();

const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, process.env.JWT_SECRET || 'myzap_secret_key', (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const authenticateAdmin = (req, res, next) => {
    authenticateToken(req, res, () => {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
        }
        next();
    });
};

// --- AUTH ---

app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const [rows] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (rows.length > 0) return res.status(400).json({ error: 'Email ja cadastrado' });

        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.execute(
            "INSERT INTO users (name, email, password, status, plan, created_at, trial_ends_at) VALUES (?, ?, ?, 'active', 'Teste Grátis', NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY))",
            [name, email, hashedPassword]
        );

        res.status(201).json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) return res.status(401).json({ error: 'Nao encontrado' });
        const user = rows[0];
        if (!await bcrypt.compare(password, user.password)) return res.status(401).json({ error: 'Senha incorreta' });

        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name, role: user.role || 'user' },
            process.env.JWT_SECRET || 'myzap_secret_key',
            { expiresIn: '7d' }
        );
        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role || 'user',
                plan: user.plan || 'Teste Grátis',
                trial_ends_at: user.trial_ends_at
            }
        });
    } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT id, name, email, plan, role, status, trial_ends_at FROM users WHERE id = ?', [req.user.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Usuario nao encontrado' });
        res.json(rows[0]);
    } catch (err) { res.status(500).json({ error: 'Erro ao buscar dados do usuario' }); }
});

app.put('/api/auth/update', authenticateToken, async (req, res) => {
    const { name, email } = req.body;
    try {
        await pool.execute('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, req.user.id]);
        res.json({ message: 'Perfil atualizado com sucesso' });
    } catch (err) { res.status(500).json({ error: 'Erro ao atualizar perfil' }); }
});

const cleanupTrials = async () => {
    try {
        console.log('🧹 [CRON] Verificando trials expirados...');
        // Usuarios 'Teste Grátis' com data passada -> Muda para 'Inativo' ou 'Expirado'
        // Por simplicidade, vamos apenas mudar o status ou plano se necessário
        const [result] = await pool.execute(
            "UPDATE users SET status = 'inactive' WHERE plan = 'Teste Grátis' AND trial_ends_at < NOW() AND status = 'active'"
        );
        if (result.affectedRows > 0) {
            console.log(`✅ [CRON] ${result.affectedRows} trials expirados foram desativados.`);
        }
    } catch (err) {
        console.error('❌ [CRON] Erro no cleanup:', err.message);
    }
};

// Executa limpeza a cada 1 hora
setInterval(cleanupTrials, 60 * 60 * 1000);
setTimeout(cleanupTrials, 5000); // Executa 5s apos iniciar

// --- ADMIN / SETTINGS ---

app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT id, name, email, plan, status, role, created_at, trial_ends_at FROM users ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// --- PLANOS ---
app.get('/api/plans', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM plans ORDER BY price ASC');
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

app.post('/api/admin/plans', authenticateAdmin, async (req, res) => {
    const { name, price, instances, messages, ai_nodes, ai_tokens, features } = req.body;
    try {
        await pool.query(
            'INSERT INTO plans (name, price, instances, messages, ai_nodes, ai_tokens, features) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, parseFloat(price) || 0, instances, messages, ai_nodes, ai_tokens, JSON.stringify(features)]
        );
        res.status(201).json({ message: 'OK' });
    } catch (err) {
        console.error('❌ Erro POST /api/admin/plans:', err);
        res.status(500).json({ error: 'Erro ao criar plano', details: err.message });
    }
});

app.put('/api/admin/plans/:id', authenticateAdmin, async (req, res) => {
    const { name, price, instances, messages, ai_nodes, ai_tokens, features } = req.body;
    try {
        console.log('📝 [DEBUG] Atualizando plano:', req.params.id, req.body);
        await pool.query(
            'UPDATE plans SET name = ?, price = ?, instances = ?, messages = ?, ai_nodes = ?, ai_tokens = ?, features = ? WHERE id = ?',
            [name, parseFloat(price) || 0, instances, messages, ai_nodes, ai_tokens, JSON.stringify(features), req.params.id]
        );
        res.json({ message: 'OK' });
    } catch (err) {
        console.error('❌ Erro PUT /api/admin/plans:', err);
        res.status(500).json({ error: 'Erro ao atualizar plano', details: err.message });
    }
});

app.delete('/api/admin/plans/:id', authenticateAdmin, async (req, res) => {
    try {
        await pool.execute('DELETE FROM plans WHERE id = ?', [req.params.id]);
        res.json({ message: 'OK' });
    } catch (err) {
        console.error('❌ Erro DELETE /api/admin/plans:', err);
        res.status(500).json({ error: 'Erro ao excluir plano', details: err.message });
    }
});

app.put('/api/admin/users/:id', authenticateAdmin, async (req, res) => {
    const { status, plan, role } = req.body;
    try {
        await pool.execute('UPDATE users SET status = ?, plan = ?, role = ?, updated_at = NOW() WHERE id = ?', [status, plan, role, req.params.id]);
        res.json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

app.post('/api/admin/settings', authenticateAdmin, async (req, res) => {
    try {
        for (const [key, value] of Object.entries(req.body)) {
            await pool.execute('INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?', [key, value, value]);
        }
        res.json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: 'Erro' }); }
});

// --- FLUXOS (COM LOGS EXTREMOS PARA DEBUG) ---

app.get('/api/flows', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, name, status, updated_at FROM flows WHERE user_id = ? ORDER BY updated_at DESC', [req.user.id]);
        res.json(rows);
    } catch (err) {
        console.error('❌ Erro GET /api/flows:', err);
        res.status(500).json({ error: 'Erro', details: err.message });
    }
});

app.post('/api/flows', authenticateToken, async (req, res) => {
    console.log('🚀 [DEBUG] Tentativa de criar fluxo. Body:', req.body, 'User:', req.user);
    const { id, name } = req.body;

    if (!id || !name) {
        console.error('❌ [DEBUG] Dados faltando no request');
        return res.status(400).json({ error: 'ID ou Nome faltando' });
    }

    try {
        const emptyContent = JSON.stringify({ nodes: [], edges: [] });
        // Usando .query em vez de .execute para maior compatibilidade em alguns ambientes
        await pool.query(
            'INSERT INTO flows (id, user_id, name, content, status) VALUES (?, ?, ?, ?, ?)',
            [id, req.user.id, name, emptyContent, 'paused']
        );
        console.log('✅ [DEBUG] Fluxo criado com sucesso no banco!');
        res.status(201).json({ message: 'OK' });
    } catch (err) {
        console.error('❌ [DEBUG] Falha ao inserir fluxo:', err);
        res.status(500).json({
            error: 'Erro no banco de dados',
            details: err.message,
            code: err.code,
            sqlMessage: err.sqlMessage
        });
    }
});

app.get('/api/flows/:id', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM flows WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Nao encontrado' });
        res.json(rows[0]);
    } catch (err) { res.status(500).json({ error: 'Erro', details: err.message }); }
});

app.put('/api/flows/:id', authenticateToken, async (req, res) => {
    const { name, content, status } = req.body;
    try {
        await pool.query(
            'UPDATE flows SET name = ?, content = ?, status = ?, updated_at = NOW() WHERE id = ? AND user_id = ?',
            [name, JSON.stringify(content), status, req.params.id, req.user.id]
        );
        res.json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: 'Erro', details: err.message }); }
});

app.delete('/api/flows/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM flows WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: 'Erro', details: err.message }); }
});

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 API: ${PORT}`));
