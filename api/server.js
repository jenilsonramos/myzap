
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();
const EvolutionService = require('./EvolutionService');

const app = express();
app.use(cors());

// --- STRIPE WEBHOOK (Deve vir ANTES do express.json() para pegar o body raw) ---
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        const [rows] = await pool.execute("SELECT setting_value FROM system_settings WHERE setting_key = 'stripe_webhook_secret'");
        const webhookSecret = rows.length > 0 ? rows[0].setting_value : null;

        const stripeInst = await getStripe();
        if (!stripeInst || !webhookSecret) return res.status(400).send('Webhook Secret or Stripe Key missing');

        event = stripeInst.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error('Webhook Error:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userEmail = (session.metadata.user_email || session.customer_details.email || '').toLowerCase().trim();
        const planName = session.metadata.plan_name;
        const subscriptionId = session.subscription;
        const customerId = session.customer;

        console.log(`💰 [STRIPE WEBHOOK] Iniciando processamento... Email: ${userEmail}, Plano: ${planName}`);

        try {
            const [result] = await pool.execute(
                "UPDATE users SET plan = ?, status = 'active', trial_ends_at = NULL, stripe_subscription_id = ?, stripe_customer_id = ? WHERE LOWER(email) = ?",
                [planName, subscriptionId, customerId, userEmail]
            );

            if (result.affectedRows > 0) {
                console.log(`✅ [STRIPE WEBHOOK] Sucesso! Banco atualizado para ${userEmail}`);
            } else {
                console.warn(`⚠️ [STRIPE WEBHOOK] Falha: Nenhum usuário encontrado com o email [${userEmail}]`);
                // Fallback: Tentar buscar por metadata caso o email do Stripe seja diferente do login
                if (session.metadata.user_id) {
                    await pool.execute(
                        "UPDATE users SET plan = ?, status = 'active', trial_ends_at = NULL, stripe_subscription_id = ?, stripe_customer_id = ? WHERE id = ?",
                        [planName, subscriptionId, customerId, session.metadata.user_id]
                    );
                    console.log(`✅ [STRIPE WEBHOOK] Sucesso via fallback ID usuário.`);
                }
            }
        } catch (err) {
            console.error('❌ [STRIPE WEBHOOK] Erro crítico ao atualizar banco:', err);
        }
    }

    if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object;
        try {
            console.log(`🚫 [STRIPE WEBHOOK] Desativando assinatura: ${subscription.id}`);
            await pool.execute(
                "UPDATE users SET status = 'inactive' WHERE stripe_subscription_id = ?",
                [subscription.id]
            );
        } catch (err) {
            console.error('❌ [STRIPE WEBHOOK] Erro ao desativar:', err);
        }
    }
    res.json({ received: true });
});

app.use(express.json());

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
        // Correção para MySQL strict mode: Evitar comparação direta com 0000-00-00 se possível, ou usar CAST
        await pool.execute("UPDATE users SET created_at = NOW() WHERE created_at IS NULL").catch(() => { });
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
            { name: 'instance_name', type: 'VARCHAR(100)' },
            { name: 'schedule_enabled', type: 'BOOLEAN DEFAULT 0' },
            { name: 'schedule_start', type: 'VARCHAR(5)' },
            { name: 'schedule_end', type: 'VARCHAR(5)' },
            { name: 'schedule_days', type: 'JSON' },
            { name: 'created_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
            { name: 'updated_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
        ];

        for (const col of columns) {
            await pool.query(`ALTER TABLE flows ADD COLUMN ${col.name} ${col.type}`).catch(() => {
                // Se falhar, tentamos modificar (caso a coluna já exista com tipo diferente)
                pool.query(`ALTER TABLE flows MODIFY COLUMN ${col.name} ${col.type}`).catch(() => { });
            });
        }

        // 3. Garantir colunas na tabela users
        await pool.query("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user'").catch(() => { });
        await pool.query("ALTER TABLE users MODIFY COLUMN status VARCHAR(20) DEFAULT 'active'").catch(() => { });
        await pool.query("ALTER TABLE users ADD COLUMN trial_ends_at DATETIME").catch(() => { });
        await pool.query("ALTER TABLE users ADD COLUMN stripe_subscription_id VARCHAR(255)").catch(() => { });
        await pool.query("ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255)").catch(() => { });

        // 4. Garantir configurações base (Troca de domínio)
        await pool.query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('app_url', 'https://ublochat.com.br') ON DUPLICATE KEY UPDATE setting_value = 'https://ublochat.com.br'");
        await pool.query("UPDATE system_settings SET setting_value = 'https://ublochat.com.br' WHERE setting_key = 'app_url' AND setting_value LIKE '%app.ublochat.com.br%'");



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

        // 5. Garantir tabela de configurações globais
        await pool.query(`
            CREATE TABLE IF NOT EXISTS system_settings (
                setting_key VARCHAR(100) PRIMARY KEY,
                setting_value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // 6. Garantir tabela de instâncias
        await pool.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_accounts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                business_name VARCHAR(100) NOT NULL,
                phone_number VARCHAR(20),
                phone_number_id VARCHAR(100),
                code_verification_status VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_instance (business_name)
            )
        `);

        // Garantir que user_id existe (caso a tabela tenha sido criada sem ele antes)
        await pool.query("ALTER TABLE whatsapp_accounts ADD COLUMN user_id INT NOT NULL AFTER id").catch(() => { });
        await pool.query("ALTER TABLE whatsapp_accounts MODIFY COLUMN business_name VARCHAR(100) NOT NULL").catch(() => { });

        // 6. Garantir Tabelas de Chat (Contacts & Messages)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS contacts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                remote_jid VARCHAR(255) NOT NULL,
                name VARCHAR(255),
                profile_pic TEXT,
                status VARCHAR(20) DEFAULT 'open',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_contact (user_id, remote_jid)
            )
        `);

        // Correções incrementais para a tabela contacts
        await pool.query("ALTER TABLE contacts ADD COLUMN user_id INT AFTER id").catch(() => { });
        await pool.query("ALTER TABLE contacts ADD COLUMN remote_jid VARCHAR(255) NOT NULL AFTER user_id").catch(() => { });
        await pool.query("ALTER TABLE contacts ADD COLUMN name VARCHAR(255) AFTER remote_jid").catch(() => { });
        await pool.query("ALTER TABLE contacts ADD COLUMN profile_pic TEXT AFTER name").catch(() => { });
        await pool.query("ALTER TABLE contacts ADD COLUMN status VARCHAR(20) DEFAULT 'open' AFTER profile_pic").catch(() => { });
        await pool.query("ALTER TABLE contacts MODIFY COLUMN status VARCHAR(20) DEFAULT 'open'").catch(() => { });
        await pool.query("ALTER TABLE contacts ADD UNIQUE KEY unique_contact (user_id, remote_jid)").catch(() => { });

        await pool.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                contact_id INT,
                instance_name VARCHAR(100),
                uid VARCHAR(255) UNIQUE, 
                key_from_me BOOLEAN,
                content TEXT,
                type VARCHAR(50), 
                timestamp BIGINT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Correções incrementais para a tabela messages
        await pool.query("ALTER TABLE messages ADD COLUMN user_id INT AFTER id").catch(() => { });
        await pool.query("ALTER TABLE messages ADD COLUMN contact_id INT AFTER user_id").catch(() => { });
        await pool.query("ALTER TABLE messages ADD COLUMN instance_name VARCHAR(100) AFTER contact_id").catch(() => { });
        await pool.query("ALTER TABLE messages ADD COLUMN uid VARCHAR(255) AFTER instance_name").catch(() => { });
        await pool.query("ALTER TABLE messages ADD COLUMN key_from_me BOOLEAN AFTER uid").catch(() => { });
        await pool.query("ALTER TABLE messages ADD COLUMN content TEXT AFTER key_from_me").catch(() => { });
        await pool.query("ALTER TABLE messages ADD COLUMN type VARCHAR(50) AFTER content").catch(() => { });
        // Forçar mudança de tipo caso tenha sido criado errado (ex: INT)
        await pool.query("ALTER TABLE messages MODIFY COLUMN type VARCHAR(50)").catch(() => { });
        await pool.query("ALTER TABLE messages ADD COLUMN timestamp BIGINT AFTER type").catch(() => { });
        await pool.query("ALTER TABLE messages ADD COLUMN source VARCHAR(20) DEFAULT 'user' AFTER timestamp").catch(() => { });
        await pool.query("ALTER TABLE messages ADD COLUMN media_url TEXT AFTER source").catch(() => { });
        await pool.query("ALTER TABLE messages ADD COLUMN msg_status VARCHAR(20) DEFAULT 'sent' AFTER media_url").catch(() => { });
        await pool.query("ALTER TABLE messages ADD UNIQUE KEY unique_msg_uid (uid)").catch(() => { });
        await pool.query("ALTER TABLE messages MODIFY COLUMN content TEXT").catch(() => { });

        // Flow State table (for tracking pending inputs during flow execution)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS flow_state (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                remote_jid VARCHAR(255),
                flow_id VARCHAR(255),
                current_node_id VARCHAR(255),
                variable_name VARCHAR(100),
                variables JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_state (user_id, remote_jid)
            )
        `);

        // Flow Cooldowns table (for tracking when flow was last triggered per contact)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS flow_cooldowns (
                flow_id VARCHAR(255),
                remote_jid VARCHAR(255),
                last_triggered TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (flow_id, remote_jid)
            )
        `);

        // ========== NOVAS TABELAS ==========

        // Tabela para controle de CRONs
        await pool.query(`
            CREATE TABLE IF NOT EXISTS cron_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                cron_name VARCHAR(100) NOT NULL,
                last_execution DATETIME,
                next_execution DATETIME,
                status VARCHAR(50),
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabela para Chatbot por palavras-chave
        await pool.query(`
            CREATE TABLE IF NOT EXISTS keyword_chatbot (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                instance_name VARCHAR(100),
                is_active BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Tabela para mensagens do Chatbot
        await pool.query(`
            CREATE TABLE IF NOT EXISTS keyword_chatbot_rules (
                id INT AUTO_INCREMENT PRIMARY KEY,
                chatbot_id INT NOT NULL,
                match_type ENUM('starts', 'contains', 'ends', 'any') DEFAULT 'contains',
                keyword VARCHAR(255),
                response_order INT DEFAULT 0,
                message_content TEXT,
                delay_seconds INT DEFAULT 0
            )
        `);

        // Tabela para métricas de saúde do servidor
        await pool.query(`
            CREATE TABLE IF NOT EXISTS server_health_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                cpu_usage DECIMAL(5,2),
                ram_usage DECIMAL(5,2),
                ram_used_mb INT,
                ram_total_mb INT,
                classification ENUM('boa', 'estavel', 'ruim', 'pessima'),
                is_peak BOOLEAN DEFAULT FALSE
            )
        `);

        // Adicionar coluna unread_count aos contatos
        await pool.query("ALTER TABLE contacts ADD COLUMN unread_count INT DEFAULT 0").catch(() => { });

        // Adicionar coluna instance_name aos contatos
        await pool.query("ALTER TABLE contacts ADD COLUMN instance_name VARCHAR(100)").catch(() => { });

        // Adicionar coluna is_blocked aos usuários (para bloqueio por assinatura)
        await pool.query("ALTER TABLE users ADD COLUMN is_blocked BOOLEAN DEFAULT FALSE").catch(() => { });

        // Adicionar colunas ao flow_state para persistência de variáveis
        await pool.query("ALTER TABLE flow_state ADD COLUMN flow_id VARCHAR(255)").catch(() => { });
        await pool.query("ALTER TABLE flow_state ADD COLUMN current_node_id VARCHAR(255)").catch(() => { });

        // ========== FIM NOVAS TABELAS ==========

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
        console.log(`📡 [DB] Tentando conexão: Host=${dbConfig.host}, User=${dbConfig.user}`);
        pool = mysql.createPool({
            ...dbConfig,
            waitForConnections: true,
            connectionLimit: 10,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0
        });
        console.log('✅ MyZap MySQL Pool Criado.');

        // TESTE DE CONEXÃO IMEDIATO
        const connection = await pool.getConnection();
        console.log('✅ Conexão com o Banco de Dados estabelecida com sucesso.');
        connection.release();

        setTimeout(setupTables, 1000);
    } catch (err) {
        console.error('❌ ERRO CRÍTICO NA CONEXÃO COM O BANCO DE DADOS:', err.message);
        console.error('Verifique as credenciais no arquivo .env e se o banco está rodando.');
    }
}

connectToDB();

// stripe integration (inicializado sob demanda)
let stripe;
const getStripe = async () => {
    if (stripe) return stripe;
    try {
        const [rows] = await pool.execute("SELECT setting_value FROM system_settings WHERE setting_key = 'stripe_secret_key'");
        if (rows.length > 0 && rows[0].setting_value) {
            stripe = require('stripe')(rows[0].setting_value);
            return stripe;
        }
    } catch (err) { console.error('Stripe Init Error:', err); }
    return null;
};


const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, process.env.JWT_SECRET || 'myzap_secret_key', (err, user) => {
        if (err) {
            console.log(`❌ [AUTH] Token inválido ou expirado: ${err.message}`);
            return res.status(403).json({ error: 'Sessão expirada ou token inválido. Por favor, faça login novamente.', code: 'TOKEN_INVALID' });
        }
        req.user = user;
        // Log discreto para cada request autenticada
        console.log(`👤 [USER] ${user.id} (${user.email}) -> ${req.method} ${req.url}`);
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
    } catch (err) {
        console.error('❌ [AUTH] Erro no login:', err);
        res.status(500).json({
            error: `Erro interno no login: ${err.message}`,
            details: err.message,
            code: 'SERVER_ERROR'
        });
    }
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

app.get('/api/admin/settings', authenticateAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT setting_key, setting_value FROM system_settings');
        const settings = {};
        rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });
        res.json(settings);
    } catch (err) { res.status(500).json({ error: 'Erro ao buscar configurações' }); }
});

app.post('/api/admin/settings', authenticateAdmin, async (req, res) => {
    try {
        for (const [key, value] of Object.entries(req.body)) {
            await pool.execute('INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?', [key, value, value]);
        }
        // Reset stripe instance if secret key changed
        if (req.body.stripe_secret_key) stripe = null;
        res.json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: 'Erro ao salvar configurações' }); }
});

// --- GOOGLE GEMINI / AI SETTINGS ---
app.post('/api/admin/ai-settings', authenticateAdmin, async (req, res) => {
    // Reutiliza a lógica de settings globais
    try {
        for (const [key, value] of Object.entries(req.body)) {
            await pool.execute('INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?', [key, value, value]);
        }
        res.json({ message: 'OK' });
    } catch (err) { res.status(500).json({ error: 'Erro' }); }
});



app.post('/api/stripe/create-checkout-session', authenticateToken, async (req, res) => {
    const { planName, price, successUrl, cancelUrl } = req.body;

    try {
        const stripeInst = await getStripe();
        if (!stripeInst) return res.status(500).json({ error: 'Stripe não configurado pelo administrador.' });

        const session = await stripeInst.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'brl',
                    product_data: {
                        name: `Plano ${planName}`,
                        description: 'Assinatura Mensal MyZap Pro',
                    },
                    unit_amount: Math.round(parseFloat(price) * 100),
                    recurring: { interval: 'month' },
                },
                quantity: 1,
            }],
            mode: 'subscription',
            customer_email: req.user.email,
            success_url: successUrl,
            cancel_url: cancelUrl,
            metadata: {
                plan_name: planName,
                user_email: req.user.email,
                user_id: req.user.id
            }
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error('❌ [STRIPE CHECKOUT ERROR]:', err);
        res.status(500).json({ error: 'Erro ao criar sessão de checkout', details: err.message });
    }
});




// --- CHAT / LIVE CHAT ---
app.get('/api/contacts', authenticateToken, async (req, res) => {
    try {
        let query = `
            SELECT c.*, 
            (SELECT content FROM messages m WHERE m.contact_id = c.id ORDER BY m.timestamp DESC LIMIT 1) as lastMessage,
            (SELECT timestamp FROM messages m WHERE m.contact_id = c.id ORDER BY m.timestamp DESC LIMIT 1) as lastTime
            FROM contacts c 
        `;

        const params = [];

        if (req.user.role !== 'admin') {
            query += ' WHERE c.user_id = ? ';
            params.push(req.user.id);
        }

        query += ' ORDER BY lastTime DESC';

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Erro ao listar contatos' }); }
});

// Update contact status (open, pending, closed)
app.patch('/api/contacts/:contactId/status', authenticateToken, async (req, res) => {
    try {
        const { status } = req.body;
        if (!['open', 'pending', 'closed'].includes(status)) {
            return res.status(400).json({ error: 'Status inválido' });
        }
        await pool.query(
            "UPDATE contacts SET status = ? WHERE id = ? AND user_id = ?",
            [status, req.params.contactId, req.user.id]
        );
        res.json({ success: true, status });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao atualizar status' });
    }
});

app.get('/api/messages/:contactId', authenticateToken, async (req, res) => {
    try {
        let query = "SELECT id, user_id, contact_id, instance_name, uid, key_from_me, content, type, timestamp, source, media_url, msg_status as status FROM messages WHERE contact_id = ? ORDER BY timestamp ASC";
        let params = [req.params.contactId];

        // Se NÃO for admin, filtra pelo usuário
        if (req.user.role !== 'admin') {
            query = "SELECT id, user_id, contact_id, instance_name, uid, key_from_me, content, type, timestamp, source, media_url, msg_status as status FROM messages WHERE contact_id = ? AND user_id = ? ORDER BY timestamp ASC";
            params.push(req.user.id);
        }

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Erro ao buscar mensagens' }); }
});

// Send media message
app.post('/api/messages/send-media', authenticateToken, async (req, res) => {
    try {
        // Check if multer is available, otherwise handle base64
        const { contactId, mediaUrl, mediaType, caption } = req.body;

        const [contacts] = await pool.query("SELECT remote_jid FROM contacts WHERE id = ? AND user_id = ?", [contactId, req.user.id]);
        if (contacts.length === 0) return res.status(404).json({ error: 'Contato não encontrado' });

        const remoteJid = contacts[0].remote_jid;
        const [instance] = await pool.query("SELECT business_name FROM whatsapp_accounts WHERE user_id = ? LIMIT 1", [req.user.id]);
        if (instance.length === 0) return res.status(400).json({ error: 'Nenhuma instância configurada' });

        const instanceName = instance[0].business_name;
        const evo = await getEvolutionService();

        let result;
        if (mediaType === 'image') {
            result = await evo.sendImage(instanceName, remoteJid, mediaUrl, caption);
        } else if (mediaType === 'video') {
            result = await evo.sendVideo(instanceName, remoteJid, mediaUrl, caption);
        } else if (mediaType === 'audio') {
            result = await evo.sendAudio(instanceName, remoteJid, mediaUrl);
        } else {
            result = await evo.sendDocument(instanceName, remoteJid, mediaUrl, caption);
        }

        const msgId = result?.key?.id || result?.id || `MEDIA-${Date.now()}`;
        const timestamp = Math.floor(Date.now() / 1000);

        await pool.query(`
            INSERT INTO messages (user_id, contact_id, instance_name, uid, key_from_me, content, type, timestamp, media_url)
            VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE content = VALUES(content)
        `, [req.user.id, contactId, instanceName, msgId, caption || '', mediaType, timestamp, mediaUrl]);

        res.json(result);
    } catch (err) {
        console.error('Erro ao enviar mídia:', err);
        res.status(500).json({ error: 'Erro ao enviar mídia', details: err.message });
    }
});

// --- ANALYTICS DASHBOARD ---
app.get('/api/analytics/dashboard', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(`📊 [ANALYTICS] Request UserID: ${userId}`);

        // 1. Totais Gerais
        const [totalMsg] = await pool.query("SELECT COUNT(*) as count FROM messages WHERE user_id = ?", [userId]);
        const [sentMsg] = await pool.query("SELECT COUNT(*) as count FROM messages WHERE user_id = ? AND key_from_me = 1", [userId]);
        const [contacts] = await pool.query("SELECT COUNT(*) as count FROM contacts WHERE user_id = ?", [userId]);

        console.log(`📊 [ANALYTICS] Stats for ${userId}: Total=${totalMsg[0].count}, Sent=${sentMsg[0].count}, Contacts=${contacts[0].count}`);

        // 2. Volume Semanal (Últimos 7 dias)
        // Agrupa por dia da semana (Dom, Seg, Ter...)
        const [weekly] = await pool.query(`
            SELECT 
                DATE_FORMAT(FROM_UNIXTIME(timestamp), '%a') as name, 
                COUNT(*) as value 
            FROM messages 
            WHERE user_id = ? AND timestamp >= UNIX_TIMESTAMP(DATE_SUB(NOW(), INTERVAL 7 DAY)) 
            GROUP BY DATE(FROM_UNIXTIME(timestamp)) 
            ORDER BY timestamp ASC
        `, [userId]);

        // 3. Status (Enviadas vs Recebidas)
        // key_from_me = 1 (Enviada), 0 (Recebida)
        const receivedCount = totalMsg[0].count - sentMsg[0].count;
        const pieData = [
            { name: 'Recebidas', value: receivedCount, color: '#6366f1' }, // Indigo
            { name: 'Enviadas', value: sentMsg[0].count, color: '#22c55e' } // Green
        ];

        // Normalização simplificada para gráfico de barras (garante 7 dias preenchidos se quiser, mas array simples serve por agora)

        res.json({
            totalMessages: totalMsg[0].count,
            sentMessages: sentMsg[0].count,
            totalContacts: contacts[0].count,
            weeklyVolume: weekly,
            pieChart: pieData,
            avgResponseTime: "2m" // Mock por enquanto, cálculo complexo
        });

    } catch (err) {
        console.error('❌ Erro Analytics:', err);
        res.status(500).json({ error: 'Erro ao gerar análise' });
    }
});

// Debug endpoint for analytics troubleshooting
app.get('/api/analytics/debug', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // Total messages in system
        const [allMsgs] = await pool.query("SELECT COUNT(*) as total FROM messages");

        // Messages with user_id matching current user
        const [userMsgs] = await pool.query("SELECT COUNT(*) as total FROM messages WHERE user_id = ?", [userId]);

        // Messages grouped by user_id
        const [byUser] = await pool.query("SELECT user_id, COUNT(*) as count FROM messages GROUP BY user_id LIMIT 10");

        // Last 5 messages
        const [recentMsgs] = await pool.query("SELECT id, user_id, contact_id, instance_name, key_from_me, LEFT(content, 50) as preview, timestamp FROM messages ORDER BY id DESC LIMIT 5");

        // Contacts for current user
        const [userContacts] = await pool.query("SELECT COUNT(*) as total FROM contacts WHERE user_id = ?", [userId]);

        // Instances for current user
        const [userInstances] = await pool.query("SELECT business_name FROM whatsapp_accounts WHERE user_id = ?", [userId]);

        res.json({
            currentUserId: userId,
            totalMessagesInSystem: allMsgs[0].total,
            messagesForCurrentUser: userMsgs[0].total,
            contactsForCurrentUser: userContacts[0].total,
            instancesForUser: userInstances.map(i => i.business_name),
            messagesByUserId: byUser,
            recentMessages: recentMsgs
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/messages/send', authenticateToken, async (req, res) => {
    const { contactId, content } = req.body;
    try {
        // 1. Achar contato e instância
        const [contacts] = await pool.query("SELECT remote_jid FROM contacts WHERE id = ? AND user_id = ?", [contactId, req.user.id]);
        if (contacts.length === 0) return res.status(404).json({ error: 'Contato não encontrado' });
        const remoteJid = contacts[0].remote_jid;

        // Precisamos saber qual instância usar.
        // Simplificação: Pegar a primeira instância conectada do usuário.
        const evo = await getEvolutionService();
        if (!evo) return res.status(500).json({ error: 'Evolution offline' });

        const [instances] = await pool.query("SELECT business_name FROM whatsapp_accounts WHERE user_id = ?", [req.user.id]);
        if (instances.length === 0) return res.status(400).json({ error: 'Nenhuma instância conectada' });
        const instanceName = instances[0].business_name; // Pega a primeira

        // 2. Enviar via Evolution
        const result = await evo._request(`/message/sendText/${instanceName}`, 'POST', {
            number: remoteJid.replace('@s.whatsapp.net', ''),
            text: content,
            delay: 1200
        });

        // 3. Salvar no banco MANUALMENTE (Para garantir que apareça no chat)
        // O webhook pode demorar ou não vir se a configuração estiver errada.
        // Tenta pegar o ID da resposta da Evolution, senão gera um timestamp
        const msgId = result?.key?.id || result?.id || `SEND-${Date.now()}`;
        const timestamp = Math.floor(Date.now() / 1000);

        await pool.query(`
            INSERT INTO messages (user_id, contact_id, instance_name, uid, key_from_me, content, type, timestamp)
            VALUES (?, ?, ?, ?, 1, ?, 'text', ?)
            ON DUPLICATE KEY UPDATE content = VALUES(content)
        `, [req.user.id, contactId, instanceName, msgId, content, timestamp]);

        console.log(`✅ [SEND] Mensagem enviada e salva: ${msgId}`);

        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao enviar mensagem' });
    }
});

app.get('/api/flows', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, name, status, instance_name, schedule_enabled, schedule_start, schedule_end, schedule_days, updated_at FROM flows WHERE user_id = ? ORDER BY updated_at DESC',
            [req.user.id]
        );
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
    } catch (err) {
        res.status(500).json({ error: 'Erro ao excluir fluxo' });
    }
});

// Toggle flow status (active/paused)
app.patch('/api/flows/:id/toggle', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT status FROM flows WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Fluxo não encontrado' });

        const newStatus = rows[0].status === 'active' ? 'paused' : 'active';
        await pool.query('UPDATE flows SET status = ? WHERE id = ?', [newStatus, req.params.id]);
        res.json({ status: newStatus });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao alternar status', details: err.message });
    }
});

// Update flow settings (instance, schedule)
app.patch('/api/flows/:id/settings', authenticateToken, async (req, res) => {
    const { instance_name, schedule_enabled, schedule_start, schedule_end, schedule_days } = req.body;
    try {
        await pool.query(`
            UPDATE flows SET 
                instance_name = ?,
                schedule_enabled = ?,
                schedule_start = ?,
                schedule_end = ?,
                schedule_days = ?
            WHERE id = ? AND user_id = ?
        `, [
            instance_name || null,
            schedule_enabled ? 1 : 0,
            schedule_start || null,
            schedule_end || null,
            schedule_days ? JSON.stringify(schedule_days) : null,
            req.params.id,
            req.user.id
        ]);
        res.json({ message: 'OK' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao salvar configurações', details: err.message });
    }
});

// Debug endpoint for analytics
app.get('/api/debug/messages', authenticateToken, async (req, res) => {
    try {
        const [all] = await pool.query("SELECT COUNT(*) as total FROM messages");
        const [byUser] = await pool.query("SELECT COUNT(*) as total FROM messages WHERE user_id = ?", [req.user.id]);
        const [breakdown] = await pool.query("SELECT user_id, instance_name, COUNT(*) as count FROM messages GROUP BY user_id, instance_name LIMIT 20");
        const [recentMsgs] = await pool.query("SELECT id, user_id, instance_name, content, timestamp FROM messages ORDER BY id DESC LIMIT 5");
        res.json({
            totalInSystem: all[0].total,
            forCurrentUser: byUser[0].total,
            currentUserId: req.user.id,
            breakdown,
            recentMessages: recentMsgs
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/user/subscription', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            "SELECT plan, status, stripe_subscription_id FROM users WHERE id = ?",
            [req.user.id]
        );
        const user = rows[0];

        if (!user.stripe_subscription_id) {
            return res.json({ active: false });
        }

        const stripeInst = await getStripe();
        const subscription = await stripeInst.subscriptions.retrieve(user.stripe_subscription_id);

        res.json({
            active: true,
            plan: user.plan,
            status: subscription.status,
            current_period_end: subscription.current_period_end,
            cancel_at_period_end: subscription.cancel_at_period_end,
        });
    } catch (err) {
        console.error('Error fetching subscription:', err);
        res.status(500).json({ error: 'Erro ao buscar dados da assinatura' });
    }
});

app.post('/api/stripe/cancel-subscription', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            "SELECT stripe_subscription_id FROM users WHERE id = ?",
            [req.user.id]
        );
        const subId = rows[0].stripe_subscription_id;

        if (!subId) return res.status(400).json({ error: 'Nenhuma assinatura encontrada' });

        const stripeInst = await getStripe();
        // Cancela no final do período
        await stripeInst.subscriptions.update(subId, {
            cancel_at_period_end: true
        });

        res.json({ message: 'Sua assinatura será cancelada ao final do período vigente.' });
    } catch (err) {
        console.error('Error cancelling subscription:', err);
        res.status(500).json({ error: 'Erro ao cancelar assinatura' });
    }
});

app.get('/api/user/usage', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Instâncias
        const [instanceRows] = await pool.query(
            "SELECT COUNT(*) as total FROM whatsapp_accounts WHERE user_id = ?",
            [userId]
        );
        const instances = instanceRows[0]?.total || 0;

        // 2. Mensagens
        const [messageRows] = await pool.query(
            "SELECT COUNT(*) as total FROM messages WHERE user_id = ?",
            [userId]
        );
        const messages = messageRows[0]?.total || 0;

        // 3. Flows & AI Nodes
        const [flowRows] = await pool.query(
            "SELECT content FROM flows WHERE user_id = ?",
            [userId]
        );
        const flows = flowRows.length;

        let aiNodes = 0;
        flowRows.forEach(flow => {
            try {
                const content = typeof flow.content === 'string' ? JSON.parse(flow.content) : flow.content;
                if (content && content.nodes) {
                    aiNodes += content.nodes.filter(n => n.type === 'ai').length;
                }
            } catch (e) {
                // Ignore parse errors
            }
        });

        res.json({
            instances,
            messages,
            flows,
            aiNodes
        });
    } catch (err) {
        console.error('❌ Erro GET /api/user/usage:', err);
        res.status(500).json({ error: 'Erro ao buscar dados de uso' });
    }
});




async function getEvolutionService() {
    const [rows] = await pool.query(
        "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('evolution_url', 'evolution_apikey')"
    );
    const settings = {};
    rows.forEach(r => settings[r.setting_key] = r.setting_value);

    if (!settings.evolution_url || !settings.evolution_apikey) {
        return null;
    }
    return new EvolutionService(settings.evolution_url, settings.evolution_apikey);
}

// =================================
// FLOW EXECUTION ENGINE
// =================================

// Get user's active flows
async function getActiveFlows(userId) {
    const [rows] = await pool.query(
        "SELECT * FROM flows WHERE user_id = ? AND status = 'active'",
        [userId]
    );
    return rows;
}

// Find flow that matches the trigger (with instance and schedule filtering)
function findMatchingFlow(flows, message, currentInstance) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;
    const days = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
    const currentDay = days[now.getDay()];

    for (const flow of flows) {
        try {
            // Check instance filter
            if (flow.instance_name && flow.instance_name !== currentInstance) {
                console.log(`💤 [FLOW] Flow "${flow.name}" is for instance "${flow.instance_name}", not "${currentInstance}"`);
                continue;
            }

            // Check schedule filter
            if (flow.schedule_enabled) {
                // Check days
                let allowedDays = flow.schedule_days;
                if (typeof allowedDays === 'string') {
                    try { allowedDays = JSON.parse(allowedDays); } catch (e) { allowedDays = []; }
                }
                if (allowedDays && allowedDays.length > 0 && !allowedDays.includes(currentDay)) {
                    console.log(`📅 [FLOW] Flow "${flow.name}" not allowed on ${currentDay}`);
                    continue;
                }

                // Check time range
                if (flow.schedule_start && flow.schedule_end) {
                    const [startH, startM] = flow.schedule_start.split(':').map(Number);
                    const [endH, endM] = flow.schedule_end.split(':').map(Number);
                    const startTime = startH * 60 + startM;
                    const endTime = endH * 60 + endM;

                    if (currentTime < startTime || currentTime > endTime) {
                        console.log(`⏰ [FLOW] Flow "${flow.name}" outside schedule (${flow.schedule_start}-${flow.schedule_end})`);
                        continue;
                    }
                }
            }

            const content = typeof flow.content === 'string' ? JSON.parse(flow.content) : flow.content;
            if (!content?.nodes) continue;

            const triggerNode = content.nodes.find(n => n.type === 'trigger');
            if (!triggerNode) continue;

            const triggerType = triggerNode.data?.type || 'all';
            const keywordsRaw = triggerNode.data?.keyword?.toLowerCase() || '';
            const matchType = triggerNode.data?.matchType || 'contains';
            const cooldownHours = triggerNode.data?.cooldownHours ?? 6;

            if (triggerType === 'all') {
                return { flow, content, triggerNode, cooldownHours };
            }

            if (triggerType === 'keyword' && keywordsRaw) {
                // Split multiple keywords by comma
                const keywords = keywordsRaw.split(',').map(k => k.trim()).filter(k => k.length > 0);
                const msgLower = message.toLowerCase();

                for (const keyword of keywords) {
                    let matched = false;

                    switch (matchType) {
                        case 'contains':
                            matched = msgLower.includes(keyword);
                            break;
                        case 'starts':
                            matched = msgLower.startsWith(keyword);
                            break;
                        case 'ends':
                            matched = msgLower.endsWith(keyword);
                            break;
                        case 'exact':
                            matched = msgLower === keyword;
                            break;
                        default:
                            matched = msgLower.includes(keyword);
                    }

                    if (matched) {
                        console.log(`🎯 [FLOW] Matched keyword "${keyword}" with type "${matchType}"`);
                        return { flow, content, triggerNode, cooldownHours: 0 };
                    }
                }
            }
        } catch (e) {
            console.error('Error parsing flow:', e);
        }
    }
    return null;
}

// Check cooldown for a contact/flow combination
async function checkFlowCooldown(flowId, remoteJid, cooldownHours) {
    if (cooldownHours <= 0) return true; // No cooldown, always allow

    try {
        const [rows] = await pool.query(
            `SELECT last_triggered FROM flow_cooldowns WHERE flow_id = ? AND remote_jid = ?`,
            [flowId, remoteJid]
        );

        if (rows.length === 0) return true; // Never triggered before

        const lastTriggered = new Date(rows[0].last_triggered);
        const now = new Date();
        const hoursSince = (now - lastTriggered) / (1000 * 60 * 60);

        return hoursSince >= cooldownHours;
    } catch (e) {
        console.error('Error checking cooldown:', e);
        return true; // Allow on error
    }
}

// Update cooldown timestamp
async function updateFlowCooldown(flowId, remoteJid) {
    try {
        await pool.query(`
            INSERT INTO flow_cooldowns (flow_id, remote_jid, last_triggered)
            VALUES (?, ?, NOW())
            ON DUPLICATE KEY UPDATE last_triggered = NOW()
        `, [flowId, remoteJid]);
    } catch (e) {
        console.error('Error updating cooldown:', e);
    }
}

// Execute a flow starting from trigger node
async function executeFlow(flowData, userId, remoteJid, instanceName, messageContent, contactId = null) {
    const { content, triggerNode } = flowData;
    const context = {
        userId,
        remoteJid,
        instanceName,
        contactId,
        variables: {
            contact: { phone: remoteJid.replace('@s.whatsapp.net', '') },
            message: messageContent,
            last_input: messageContent
        },
        visitedNodes: new Set()
    };

    console.log(`🚀 [FLOW] Executing flow for user ${userId}, contact ${remoteJid}`);

    // Find next node after trigger
    const edges = content.edges || [];
    const nextEdge = edges.find(e => e.source === triggerNode.id);

    if (nextEdge) {
        const nextNode = content.nodes.find(n => n.id === nextEdge.target);
        if (nextNode) {
            await processNode(nextNode, content, context);
        }
    }
}

// Process a single node
async function processNode(node, flowContent, context) {
    if (context.visitedNodes.has(node.id)) {
        console.log(`⚠️ [FLOW] Loop detected at node ${node.id}, stopping`);
        return;
    }
    context.visitedNodes.add(node.id);

    console.log(`📦 [FLOW] Processing node: ${node.type} (${node.id})`);

    let shouldContinue = true;
    let nextNodeId = null;

    try {
        switch (node.type) {
            case 'message':
                await processMessageNode(node, context);
                break;

            case 'delay':
                await processDelayNode(node, context);
                break;

            case 'condition':
                nextNodeId = await processConditionNode(node, flowContent, context);
                shouldContinue = !!nextNodeId;
                break;

            case 'input':
                await processInputNode(node, context);
                shouldContinue = false; // Wait for user response
                break;

            case 'set_variable':
                processSetVariableNode(node, context);
                break;

            case 'action':
                await processActionNode(node, context);
                break;

            case 'handoff':
                await processHandoffNode(node, context);
                shouldContinue = false;
                break;

            case 'ai_agent':
                await processAiAgentNode(node, context);
                break;

            case 'api':
                await processApiNode(node, context);
                break;

            case 'validator':
                const valid = await processValidatorNode(node, context);
                if (!valid) shouldContinue = false;
                break;

            case 'ab_split':
                nextNodeId = await processAbSplitNode(node, flowContent, context);
                break;

            case 'switch':
                nextNodeId = await processSwitchNode(node, flowContent, context);
                break;

            case 'schedule':
                shouldContinue = processScheduleNode(node, context);
                break;

            case 'end':
                console.log(`🏁 [FLOW] Flow ended`);
                shouldContinue = false;
                break;

            case 'note':
                // Notes are just for documentation, skip
                break;

            case 'media':
                await processMediaNode(node, context);
                break;

            case 'interactive':
                await processInteractiveNode(node, context);
                break;

            default:
                console.log(`❌ [FLOW] Unknown node type: ${node.type}`);
        }
    } catch (err) {
        console.error(`❌ [FLOW] Error processing node ${node.id}:`, err);
        shouldContinue = false;
    }

    // Continue to next node
    if (shouldContinue) {
        const edges = flowContent.edges || [];
        let nextEdge;

        if (nextNodeId) {
            nextEdge = { target: nextNodeId };
        } else {
            nextEdge = edges.find(e => e.source === node.id);
        }

        if (nextEdge) {
            const nextNode = flowContent.nodes.find(n => n.id === nextEdge.target);
            if (nextNode) {
                await processNode(nextNode, flowContent, context);
            }
        }
    }
}

// ===== NODE PROCESSORS =====

async function processMessageNode(node, context) {
    // Check if it's a media message
    if (node.data.messageType === 'media') {
        console.log(`📎 [FLOW] Delegating MessageNode to MediaNode processor`);
        return await processMediaNode(node, context);
    }

    const message = replaceVariables(node.data.message || '', context);
    const result = await sendWhatsAppMessage(context.instanceName, context.remoteJid, message);

    // Save message to database with source='flow'
    try {
        const msgId = result?.key?.id || result?.id || `FLOW-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await pool.query(`
            INSERT INTO messages (user_id, contact_id, instance_name, uid, key_from_me, content, type, timestamp,source)
            VALUES (?, ?, ?, ?, 1, ?, 'text', ?, 'flow')
            ON DUPLICATE KEY UPDATE content = VALUES(content)
        `, [context.userId, context.contactId, context.instanceName, msgId, message, Math.floor(Date.now() / 1000)]);
        console.log(`💾 [FLOW] Message saved to database with source=flow`);
    } catch (err) {
        console.error(`❌ [FLOW] Error saving message to database:`, err.message);
    }
}

async function processDelayNode(node, context) {
    const delaySeconds = node.data.delay || 1;
    console.log(`⏰ [FLOW] Waiting ${delaySeconds} seconds...`);
    await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
}

async function processConditionNode(node, flowContent, context) {
    const rule = node.data.rule || '';
    const result = evaluateCondition(rule, context);

    // Find edges - look for "true" and "false" handles or first/second edge
    const edges = flowContent.edges.filter(e => e.source === node.id);

    if (result && edges.length > 0) {
        return edges[0].target; // True path
    } else if (!result && edges.length > 1) {
        return edges[1].target; // False path
    }
    return null;
}

async function processInputNode(node, context) {
    const question = replaceVariables(node.data.question || '', context);
    await sendWhatsAppMessage(context.instanceName, context.remoteJid, question);

    // Store pending input state
    await pool.query(`
        INSERT INTO flow_state (user_id, remote_jid, variable_name, created_at)
        VALUES (?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE variable_name = VALUES(variable_name), created_at = NOW()
    `, [context.userId, context.remoteJid, node.data.variable || 'user_input']);
}

function processSetVariableNode(node, context) {
    const name = node.data.variableName || 'var';
    const value = replaceVariables(node.data.value || '', context);
    context.variables[name] = value;
    console.log(`📝 [FLOW] Set ${name} = ${value}`);
}

async function processActionNode(node, context) {
    const actionType = node.data.actionType || '';
    const tag = node.data.tag || '';

    if (actionType === 'add_tag' && tag) {
        console.log(`🏷️ [FLOW] Adding tag: ${tag}`);
        // Store tag in contacts table or separate tags table
    }
}

async function processHandoffNode(node, context) {
    const message = replaceVariables(node.data.message || 'Transferindo para atendimento...', context);
    await sendWhatsAppMessage(context.instanceName, context.remoteJid, message);
    console.log(`🤝 [FLOW] Handoff to department: ${node.data.department}`);
}

async function processAiAgentNode(node, context) {
    const [rows] = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key = 'gemini_api_key'");
    const apiKey = rows[0]?.setting_value;

    if (!apiKey) {
        console.log(`⚠️ [FLOW] AI Agent: No API key configured`);
        return;
    }

    const prompt = replaceVariables(node.data.prompt || '', context);
    const userMessage = context.variables.last_input || '';

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${node.data.model || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    { role: 'user', parts: [{ text: `${prompt}\n\nUsuário: ${userMessage}` }] }
                ]
            })
        });

        const data = await response.json();
        const aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Desculpe, não consegui processar.';

        await sendWhatsAppMessage(context.instanceName, context.remoteJid, aiResponse);
        context.variables.ai_response = aiResponse;
    } catch (err) {
        console.error('AI Agent Error:', err);
    }
}

async function processApiNode(node, context) {
    const url = replaceVariables(node.data.url || '', context);
    const method = node.data.method || 'GET';
    const body = replaceVariables(node.data.body || '{}', context);

    try {
        const options = { method, headers: { 'Content-Type': 'application/json' } };
        if (['POST', 'PUT', 'PATCH'].includes(method)) {
            options.body = body;
        }

        const response = await fetch(url, options);
        const data = await response.json();
        context.variables.api_response = JSON.stringify(data);
        console.log(`🌐 [FLOW] API Response:`, data);
    } catch (err) {
        console.error('API Node Error:', err);
    }
}

async function processValidatorNode(node, context) {
    const input = context.variables.last_input || '';
    const type = node.data.validationType || 'text';

    const validators = {
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        phone: /^\+?[\d\s-]{10,}$/,
        cpf: /^\d{11}$/,
        number: /^\d+$/
    };

    const regex = validators[type];
    const testValue = type === 'cpf' || type === 'number' ? input.replace(/\D/g, '') : input;

    if (regex && !regex.test(testValue)) {
        const errorMsg = replaceVariables(node.data.errorMessage || 'Formato inválido!', context);
        await sendWhatsAppMessage(context.instanceName, context.remoteJid, errorMsg);
        return false;
    }
    return true;
}

async function processAbSplitNode(node, flowContent, context) {
    const variantA = parseInt(node.data.variantA) || 50;
    const random = Math.random() * 100;

    const edges = flowContent.edges.filter(e => e.source === node.id);
    if (random < variantA && edges.length > 0) {
        return edges[0].target;
    } else if (edges.length > 1) {
        return edges[1].target;
    }
    return null;
}

async function processSwitchNode(node, flowContent, context) {
    const variable = context.variables[node.data.variable] || context.variables.last_input || '';
    const cases = node.data.cases || [];

    const edges = flowContent.edges.filter(e => e.source === node.id);

    for (let i = 0; i < cases.length; i++) {
        if (variable.toLowerCase().includes(cases[i].toLowerCase())) {
            if (edges[i]) return edges[i].target;
        }
    }

    // Default case (last edge)
    if (edges.length > cases.length) {
        return edges[edges.length - 1].target;
    }
    return null;
}

function processScheduleNode(node, context) {
    const now = new Date();
    const days = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
    const currentDay = days[now.getDay()];
    const allowedDays = node.data.days || [];

    if (allowedDays.length > 0 && !allowedDays.includes(currentDay)) {
        console.log(`📅 [FLOW] Schedule: Day ${currentDay} not allowed`);
        return false;
    }

    // Check time if specified
    if (node.data.time) {
        const [hours, minutes] = node.data.time.split(':').map(Number);
        const scheduleTime = hours * 60 + minutes;
        const currentTime = now.getHours() * 60 + now.getMinutes();

        // Allow 30 min window
        if (Math.abs(currentTime - scheduleTime) > 30) {
            console.log(`⏰ [FLOW] Schedule: Time ${node.data.time} not matched`);
            return false;
        }
    }

    return true;
}

async function processMediaNode(node, context) {
    const mediaUrl = replaceVariables(node.data.url || '', context);
    const caption = replaceVariables(node.data.caption || '', context);
    const mediaType = node.data.mediaType || 'image';

    try {
        const evo = await getEvolutionService();
        if (!evo) return;

        const number = context.remoteJid.replace('@s.whatsapp.net', '');

        if (mediaType === 'image') {
            await evo._request(`/message/sendMedia/${context.instanceName}`, 'POST', {
                number,
                mediatype: 'image',
                media: mediaUrl,
                caption
            });
        } else if (mediaType === 'document') {
            await evo._request(`/message/sendMedia/${context.instanceName}`, 'POST', {
                number,
                mediatype: 'document',
                media: mediaUrl,
                caption
            });
        }

        console.log(`📷 [FLOW] Media sent: ${mediaType}`);
    } catch (err) {
        console.error('Media Node Error:', err);
    }
}

async function processInteractiveNode(node, context) {
    // Interactive messages (buttons/lists) for WhatsApp Business
    const body = replaceVariables(node.data.body || '', context);
    const options = node.data.options || [];

    try {
        const evo = await getEvolutionService();
        if (!evo) return;

        const number = context.remoteJid.replace('@s.whatsapp.net', '');

        if (node.data.type === 'button' && options.length > 0) {
            await evo._request(`/message/sendButtons/${context.instanceName}`, 'POST', {
                number,
                title: 'Escolha uma opção',
                description: body,
                buttons: options.slice(0, 3).map((opt, i) => ({ buttonId: `btn_${i}`, buttonText: { displayText: opt } }))
            });
        } else {
            // Fallback to text with numbered options
            const optionsText = options.map((opt, i) => `${i + 1}. ${opt}`).join('\n');
            await sendWhatsAppMessage(context.instanceName, context.remoteJid, `${body}\n\n${optionsText}`);
        }

        console.log(`🎛️ [FLOW] Interactive message sent`);
    } catch (err) {
        console.error('Interactive Node Error:', err);
    }
}

// ===== HELPER FUNCTIONS =====

function replaceVariables(text, context) {
    return text.replace(/\{\{(\w+(?:\.\w+)?)\}\}/g, (match, path) => {
        const parts = path.split('.');
        let value = context.variables;
        for (const part of parts) {
            value = value?.[part];
        }
        return value !== undefined ? String(value) : match;
    });
}

function evaluateCondition(rule, context) {
    try {
        // Simple evaluation - parse "variable == value" style
        const match = rule.match(/(\w+)\s*(==|!=|>=|<=|>|<|contains)\s*['""]?(.+?)['""]?\s*$/);
        if (!match) return false;

        const [, varName, operator, expected] = match;
        const actual = String(context.variables[varName] || '').toLowerCase();
        const expectedLower = expected.toLowerCase();

        switch (operator) {
            case '==': return actual === expectedLower;
            case '!=': return actual !== expectedLower;
            case '>': return parseFloat(actual) > parseFloat(expected);
            case '<': return parseFloat(actual) < parseFloat(expected);
            case '>=': return parseFloat(actual) >= parseFloat(expected);
            case '<=': return parseFloat(actual) <= parseFloat(expected);
            case 'contains': return actual.includes(expectedLower);
            default: return false;
        }
    } catch (err) {
        console.error('Condition evaluation error:', err);
        return false;
    }
}

async function sendWhatsAppMessage(instanceName, remoteJid, text) {
    try {
        const evo = await getEvolutionService();
        if (!evo) {
            console.error('❌ [FLOW] Evolution API not available');
            return;
        }

        const number = remoteJid.replace('@s.whatsapp.net', '');
        await evo._request(`/message/sendText/${instanceName}`, 'POST', {
            number,
            text,
            delay: 1200
        });

        console.log(`✉️ [FLOW] Sent message to ${number}`);
    } catch (err) {
        console.error('❌ [FLOW] Failed to send message:', err);
    }
}

// --- EVOLUTION API ENDPOINTS ---

app.get('/api/instances', authenticateToken, async (req, res) => {
    try {
        console.log(`🔒 [SECURITY-CHECK] User Request: ${req.user.id} - ${req.user.email}`);

        // 1. Buscar instâncias que pertencem ao usuário no DB local
        const [userAccounts] = await pool.query(
            "SELECT business_name FROM whatsapp_accounts WHERE user_id = ?",
            [req.user.id]
        );
        const ownedInstanceNames = userAccounts.map(acc => acc.business_name.toLowerCase());
        console.log(`🔍 [SECURITY] User ${req.user.id} whitelist: [${ownedInstanceNames.join(', ')}]`);

        // SE NÃO TEM NADA NO DB, nem tenta buscar da Evolution (Segurança máxima)
        if (ownedInstanceNames.length === 0) {
            console.log(`⚠️ [SECURITY] User ${req.user.id} has NO instances in local DB.`);
            return res.json([]);
        }

        const evo = await getEvolutionService();
        if (evo) {
            try {
                // Tenta buscar da Evolution
                const instancesResponse = await evo.fetchInstances();

                // Formatação básica (pode variar conforme a versão da Evolution)
                // Se a Evolution retornar um objeto com a chave "instances"
                const rawList = Array.isArray(instancesResponse) ? instancesResponse : (instancesResponse.instances || []);

                // 2. FILTRAGEM STRICTA NO SERVIDOR
                const filtered = rawList.filter(i => {
                    // Tenta achar o nome em qualquer propriedade comum da Evolution
                    const iName = (i.name || i.instanceName || i.instance?.instanceName || i.instance?.name || '').toLowerCase();
                    const isOwned = ownedInstanceNames.includes(iName);

                    if (!isOwned && iName) {
                        // console.log(`🚫 [BLOCK] Instância '${iName}' bloqueada para usuário ${req.user.id}`);
                    }
                    return isOwned;
                });

                const mappedInstances = filtered.map(i => {
                    const status = i.connectionStatus || i.status || i.instance?.status || i.state || 'unknown';
                    const name = i.name || i.instanceName || i.instance?.instanceName || i.instance?.name;
                    const owner = i.owner || i.ownerJid || i.instance?.owner || i.instance?.ownerJid || '';

                    return {
                        id: name,
                        business_name: name,
                        code_verification_status: ['open', 'connected', 'online', 'authenticated'].includes(status) ? 'VERIFIED' : 'NOT_VERIFIED',
                        status: status,
                        phone_number: owner
                    };
                });

                console.log(`✅ [SECURITY] User ${req.user.id} received ${mappedInstances.length} instances.`);
                return res.json(mappedInstances);
            } catch (evoErr) {
                console.warn('⚠️ [EVOLUTION] Erro na API, usando fallback:', evoErr.message);
            }
        }

        // Fallback apenas se a API da Evolution falhar
        const [rows] = await pool.query(
            "SELECT id, business_name, phone_number, code_verification_status, updated_at FROM whatsapp_accounts WHERE user_id = ?",
            [req.user.id]
        );
        res.json(rows.map(r => ({ ...r, status: 'offline' })));
    } catch (err) {
        console.error('❌ Erro GET /api/instances:', err);
        res.status(500).json({ error: 'Erro de segurança ao buscar instâncias' });
    }
});

// ENDPOINT DE DEBUG PARA O USUÁRIO TESTAR
app.get('/api/debug/security-check', authenticateToken, async (req, res) => {
    try {
        const [userAccounts] = await pool.query("SELECT * FROM whatsapp_accounts WHERE user_id = ?", [req.user.id]);
        const [allAccounts] = await pool.query("SELECT COUNT(*) as total FROM whatsapp_accounts");

        res.json({
            user: req.user,
            your_instances_in_db: userAccounts,
            total_instances_in_system_db: allAccounts[0].total,
            server_time: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/webhook/evolution', async (req, res) => {
    try {
        const { type, event, instance, data } = req.body;
        const actualType = type || event; // CORREÇÃO CRÍTICA
        console.log(`🔔 [WEBHOOK] Recebido evento: ${actualType} | Instância: ${instance}`);

        // HELPER LOG (Global scope for this handler)
        const logDebug = (msg) => {
            const fs = require('fs');
            const time = new Date().toISOString();
            try {
                fs.appendFileSync('webhook_debug.log', `[${time}] ${msg}\n`);
            } catch (e) { console.error('Log Error:', e); }
        };

        // Salva Payload Bruto
        const fs = require('fs');
        fs.appendFileSync('webhook_debug.log', JSON.stringify({ time: new Date().toISOString(), body: req.body }) + '\n');

        const safeType = String(actualType || '').toUpperCase().trim();
        logDebug(`🏁 HANDLER INICIADO: Tipo='${actualType}' (Safe: ${safeType}) | Instancia='${instance}'`);

        if (safeType.includes('UPSERT') || safeType.includes('SEND_MESSAGE')) {
            const msg = data?.data || data;
            if (!msg || !msg.key) {
                logDebug('⚠️ Payload sem key (ignorado)');
                return res.status(200).send('OK');
            }

            logDebug(`📨 MSG DETECTADA: ${msg.key.remoteJid}`);

            // 1. Achar dono da instancia (Lógica Simplificada)
            let userId = null;

            // Busca Exata
            let [rows] = await pool.query("SELECT user_id FROM whatsapp_accounts WHERE business_name = ?", [instance]);
            if (rows.length > 0) userId = rows[0].user_id;

            // Busca Case-Insensitive
            if (!userId) {
                [rows] = await pool.query("SELECT user_id FROM whatsapp_accounts WHERE LOWER(business_name) = LOWER(?)", [instance]);
                if (rows.length > 0) userId = rows[0].user_id;

                if (userId) logDebug('🔍 Achei por nome case-insensitive');
            }

            // Busca Simplificada (remove sufixos)
            if (!userId && instance.includes('-')) {
                const simple = instance.split('-')[0];
                [rows] = await pool.query("SELECT user_id FROM whatsapp_accounts WHERE LOWER(business_name) = LOWER(?)", [simple]);
                if (rows.length > 0) userId = rows[0].user_id;

                if (userId) logDebug('🔍 Achei por nome simplificado (sem hifen)');
            }

            if (!userId) {
                logDebug(`❌ ERRO FATAL: Instância '${instance}' não tem dono no banco!`);
                return res.status(200).send('OK'); // Retorna 200 pra Evolution parar de tentar
            }

            logDebug(`✅ USER ID: ${userId}`);

            const remoteJid = msg.key.remoteJid;
            const fromMe = msg.key.fromMe ? 1 : 0;
            const pushName = msg.pushName || 'Desconhecido';

            // Conteúdo e Tipo de Mensagem
            let content = '';
            let type = 'text';
            let mediaUrl = null;

            if (msg.message?.conversation) {
                content = msg.message.conversation;
                type = 'text';
            } else if (msg.message?.extendedTextMessage?.text) {
                content = msg.message.extendedTextMessage.text;
                type = 'text';
            } else if (msg.message?.imageMessage) {
                content = msg.message.imageMessage.caption || '';
                type = 'image';
                mediaUrl = msg.message.imageMessage.url;
            } else if (msg.message?.videoMessage) {
                content = msg.message.videoMessage.caption || '';
                type = 'video';
                mediaUrl = msg.message.videoMessage.url;
            } else if (msg.message?.audioMessage) {
                content = '';
                type = 'audio';
                mediaUrl = msg.message.audioMessage.url;
            } else if (msg.message?.documentMessage) {
                content = msg.message.documentMessage.title || msg.message.documentMessage.caption || '';
                type = 'document';
                mediaUrl = msg.message.documentMessage.url;
            } else if (msg.message?.buttonsResponseMessage) {
                content = msg.message.buttonsResponseMessage.selectedButtonId;
                type = 'text';
            } else if (msg.message?.listResponseMessage) {
                content = msg.message.listResponseMessage.title;
                type = 'text';
            } else {
                content = '[Mensagem não suportada]';
                type = 'text';
            }

            if (remoteJid !== 'status@broadcast') {
                // 2. Contato (Sempre força 'open' se for mensagem recebida)
                logDebug(`📇 Gravando contato: ${remoteJid}`);
                await pool.query(`
                    INSERT INTO contacts (user_id, remote_jid, name, instance_name, status, unread_count) 
                    VALUES (?, ?, ?, ?, 'open', IF(? = 0, 1, 0)) 
                    ON DUPLICATE KEY UPDATE 
                        name = VALUES(name),
                        instance_name = COALESCE(instance_name, VALUES(instance_name)),
                        status = IF(? = 0, 'open', status),
                        unread_count = IF(? = 0, unread_count + 1, unread_count)
                `, [userId, remoteJid, pushName, instance, fromMe, fromMe, fromMe]);

                // 3. ID do Contato
                const [cRows] = await pool.query("SELECT id FROM contacts WHERE user_id = ? AND remote_jid = ?", [userId, remoteJid]);
                const contactId = cRows[0]?.id;

                if (!contactId) {
                    console.error(`❌ [WEBHOOK] CRÍTICO: Contact ID não encontrado para ${remoteJid} (User: ${userId})`);
                    // Fallback: tentar buscar apenas pelo número se houver falha de sufixo?
                    // Por enquanto apenas loga erro.
                }

                // Definir status corretamente
                const initialStatus = fromMe ? 'sent' : 'received'; // Fix v2

                // 4. Mensagem
                logDebug(`💾 Gravando mensagem [${fromMe ? 'SENT' : 'RX'}] type=${type} contact=${contactId}...`);
                await pool.query(`
                    INSERT INTO messages (user_id, contact_id, instance_name, uid, key_from_me, content, type, timestamp, media_url, msg_status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE 
                        content = VALUES(content),
                        media_url = VALUES(media_url),
                        msg_status = VALUES(msg_status)
                  `, [
                    userId, contactId, instance, msg.key.id, fromMe, content, type, Math.floor(Date.now() / 1000), mediaUrl, initialStatus
                ])
                    .then(() => logDebug('🏆 SUCESSO! MENSAGEM NO BANCO.'))
                    .catch(err => console.error('❌ ERRO AO SALVAR MSG:', err));

                // ======= CHATBOT POR PALAVRAS-CHAVE =======
                // Verifica se há chatbot ativo antes do FlowBuild
                if (!fromMe) {
                    try {
                        const [chatbotRows] = await pool.query(
                            "SELECT kc.id, kc.is_active FROM keyword_chatbot kc WHERE kc.user_id = ? AND (kc.instance_name IS NULL OR kc.instance_name = ?)",
                            [userId, instance]
                        );

                        if (chatbotRows.length > 0 && chatbotRows[0].is_active) {
                            const chatbotId = chatbotRows[0].id;
                            logDebug(`🤖 [CHATBOT] Chatbot ativo encontrado (ID: ${chatbotId})`);

                            // Buscar regras do chatbot
                            const [rules] = await pool.query(
                                "SELECT * FROM keyword_chatbot_rules WHERE chatbot_id = ? ORDER BY response_order ASC",
                                [chatbotId]
                            );

                            let matched = false;
                            const msgLower = content.toLowerCase();

                            for (const rule of rules) {
                                if (matched) break;

                                const keyword = (rule.keyword || '').toLowerCase();

                                switch (rule.match_type) {
                                    case 'starts':
                                        matched = msgLower.startsWith(keyword);
                                        break;
                                    case 'ends':
                                        matched = msgLower.endsWith(keyword);
                                        break;
                                    case 'contains':
                                        matched = msgLower.includes(keyword);
                                        break;
                                    case 'any':
                                        matched = true;
                                        break;
                                }

                                if (matched && rule.message_content) {
                                    logDebug(`🤖 [CHATBOT] Regra encontrada: ${rule.match_type} "${keyword}"`);

                                    // Aplicar delay se configurado
                                    if (rule.delay_seconds > 0) {
                                        await new Promise(r => setTimeout(r, rule.delay_seconds * 1000));
                                    }

                                    // Enviar resposta
                                    await sendWhatsAppMessage(instance, remoteJid, rule.message_content);

                                    // Salvar mensagem no banco
                                    const chatbotMsgId = `CHATBOT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                                    await pool.query(`
                                        INSERT INTO messages (user_id, contact_id, instance_name, uid, key_from_me, content, type, timestamp, source)
                                        VALUES (?, ?, ?, ?, 1, ?, 'text', ?, 'chatbot')
                                    `, [userId, contactId, instance, chatbotMsgId, rule.message_content, Math.floor(Date.now() / 1000)]);

                                    logDebug(`🤖 [CHATBOT] Resposta enviada: "${rule.message_content.substring(0, 50)}..."`);
                                }
                            }

                            // Se chatbot respondeu, não processar FlowBuild
                            if (matched) {
                                logDebug(`🤖 [CHATBOT] FlowBuild ignorado (chatbot ativo e respondeu)`);
                                return res.status(200).send('OK');
                            }
                        }
                    } catch (chatbotErr) {
                        logDebug(`❌ [CHATBOT] Erro: ${chatbotErr.message}`);
                    }
                }

                // ======= FLOW EXECUTION =======
                // Check if user has active flows and execute matching ones
                try {
                    // Only process if it's an incoming message (not from me)
                    if (!fromMe) {
                        const activeFlows = await getActiveFlows(userId);
                        if (activeFlows.length > 0) {
                            logDebug(`🔍 [FLOW] Found ${activeFlows.length} active flows for user ${userId}`);
                            const matchedFlow = findMatchingFlow(activeFlows, content, instance);

                            if (matchedFlow) {
                                // Check cooldown (only for "all messages" type triggers)
                                const cooldownOk = await checkFlowCooldown(matchedFlow.flow.id, remoteJid, matchedFlow.cooldownHours || 0);

                                if (!cooldownOk) {
                                    logDebug(`⏳ [FLOW] Flow "${matchedFlow.flow.name}" in cooldown for ${remoteJid}`);
                                } else {
                                    logDebug(`✅ [FLOW] Matched flow: ${matchedFlow.flow.name}`);

                                    // Update cooldown timestamp
                                    await updateFlowCooldown(matchedFlow.flow.id, remoteJid);

                                    // Execute flow asynchronously to not block webhook response
                                    executeFlow(matchedFlow, userId, remoteJid, instance, content, contactId)
                                        .then(() => logDebug(`🏁 [FLOW] Flow execution completed`))
                                        .catch(err => logDebug(`❌ [FLOW] Flow execution error: ${err.message}`));
                                }
                            } else {
                                logDebug(`💤 [FLOW] No matching trigger found`);
                            }
                        }
                    }
                } catch (flowErr) {
                    logDebug(`❌ [FLOW] Execution error: ${flowErr.message}`);
                }
            }
        } else if (safeType.includes('MESSAGE_UPDATE') || safeType.includes('MESSAGES.UPDATE')) {
            // Handle message status updates (delivered, read)
            const msg = data?.data || data;
            if (msg?.key?.id) {
                const msgId = msg.key.id;
                let newStatus = 'sent';

                const update = msg.update || msg;
                if (update.status === 3 || update.status === 'DELIVERY_ACK') {
                    newStatus = 'delivered';
                } else if (update.status === 4 || update.status === 'READ' || update.status === 'PLAYED') {
                    newStatus = 'read';
                }

                logDebug(`📬 [STATUS] Updating message ${msgId} to ${newStatus}`);
                await pool.query(
                    "UPDATE messages SET msg_status = ? WHERE uid = ?",
                    [newStatus, msgId]
                ).catch(err => logDebug(`❌ Error updating status: ${err.message}`));
            }
        } else {
            logDebug(`💤 Ignorando tipo: ${safeType}`);
        }

        res.status(200).send('OK');
    } catch (err) {
        console.error('SERVER ERROR:', err);
        const fs = require('fs');
        fs.appendFileSync('webhook_debug.log', `[FATAL EXCEPTION] ${err.message}\n`);
        res.status(500).send('Erro interno');
    }
});


app.post('/api/instances/:name/webhook', authenticateToken, async (req, res) => {
    try {
        const { name } = req.params;

        // VERIFICAÇÃO DE PROPRIEDADE
        const [ownership] = await pool.query("SELECT id FROM whatsapp_accounts WHERE business_name = ? AND user_id = ?", [name, req.user.id]);
        if (ownership.length === 0) return res.status(403).json({ error: 'Acesso negado para esta instância.' });

        const enabled = req.body.enabled !== false;
        const evo = await getEvolutionService();
        if (!evo) throw new Error('Evolution API offline');

        const [rows] = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key = 'app_url'");
        const appUrl = rows[0]?.setting_value || 'https://ublochat.com.br';
        const webhookUrl = `${appUrl}/api/webhook/evolution`;

        console.log(`🔗 [MANUAL] Configurando Webhook para ${name}: ${webhookUrl}`);
        const result = await evo.setWebhook(name, webhookUrl, enabled);

        // Verifica se deu erro na response da Evolution
        if (result?.status === 400 || result?.error) {
            throw new Error(result.message || JSON.stringify(result));
        }

        res.json(result || { message: 'Configurado com sucesso' });
    } catch (err) {
        console.error('❌ Erro Config Webhook:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/instances', authenticateToken, async (req, res) => {
    const { instanceName } = req.body;
    if (!instanceName) return res.status(400).json({ error: 'Nome da instância obrigatório' });

    try {
        const evo = await getEvolutionService();
        if (!evo) return res.status(500).json({ error: 'Evolution API não configurada' });

        // VERIFICAÇÃO DE DISPONIBILIDADE NO DB LOCAL
        const [existing] = await pool.query("SELECT user_id, business_name FROM whatsapp_accounts WHERE business_name = ?", [instanceName]);

        if (existing.length > 0) {
            if (existing[0].user_id !== req.user.id) {
                console.warn(`🚫 [SECURITY] Usuário ${req.user.id} tentou criar instância '${instanceName}' que já pertence ao usuário ${existing[0].user_id}`);
                return res.status(403).json({ error: 'Este nome de instância já está em uso por outro usuário.', code: 'INSTANCE_TAKEN' });
            } else {
                console.log(`ℹ️ [INFO] Usuário ${req.user.id} está recriando/atualizando sua própria instância '${instanceName}'`);
                // Se já for do usuário, removemos a referência antiga para inserir a nova limpa
                await pool.query("DELETE FROM whatsapp_accounts WHERE business_name = ? AND user_id = ?", [instanceName, req.user.id]);
            }
        }

        // Pega token do usuário para usar como API Key da instância (segurança extra)
        // ou gera um aleatório.
        const token = req.headers['authorization']?.split(' ')[1] || 'default-token';

        const data = await evo.createInstance(instanceName, token);

        // Configura Webhook automaticamente
        try {
            const [rows] = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key = 'app_url'");
            const appUrl = rows[0]?.setting_value || 'https://ublochat.com.br';
            const webhookUrl = `${appUrl}/api/webhook/evolution`;

            console.log(`🔗 Configurando Webhook para ${instanceName}: ${webhookUrl}`);
            await evo.setWebhook(instanceName, webhookUrl, true);
        } catch (whErr) {
            console.error('⚠️ Falha ao configurar webhook:', whErr.message);
        }

        // Salvar referência no DB local para contagem
        await pool.query(
            "INSERT INTO whatsapp_accounts (user_id, business_name, code_verification_status, phone_number_id) VALUES (?, ?, 'PENDING', '')",
            [req.user.id, instanceName]
        );

        res.json(data);
    } catch (err) {
        console.error('❌ Erro POST /api/instances:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/instances/:name', authenticateToken, async (req, res) => {
    try {
        const { name } = req.params;

        // VERIFICAÇÃO DE PROPRIEDADE
        const [ownership] = await pool.query("SELECT id FROM whatsapp_accounts WHERE business_name = ? AND user_id = ?", [name, req.user.id]);
        if (ownership.length === 0) return res.status(403).json({ error: 'Acesso negado para esta instância.' });

        const evo = await getEvolutionService();
        if (!evo) return res.status(400).json({ error: 'Evolution API não configurada' });

        await evo.deleteInstance(name);

        // Remover do DB local
        await pool.query("DELETE FROM whatsapp_accounts WHERE business_name = ? AND user_id = ?", [name, req.user.id]);

        res.json({ message: 'Instância removida' });
    } catch (err) {
        console.error('❌ Erro DELETE /api/instances:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/instances/:name/connect', authenticateToken, async (req, res) => {
    try {
        const { name } = req.params;

        // VERIFICAÇÃO DE PROPRIEDADE
        const [ownership] = await pool.query("SELECT id FROM whatsapp_accounts WHERE business_name = ? AND user_id = ?", [name, req.user.id]);
        if (ownership.length === 0) return res.status(403).json({ error: 'Acesso negado para esta instância.' });

        const evo = await getEvolutionService();
        if (!evo) return res.status(400).json({ error: 'Evolution API não configurada' });

        const data = await evo.connectInstance(name);
        res.json(data); // Espera-se que retorne base64 do QR Code ou dados dele
    } catch (err) {
        console.error('❌ Erro GET connect:', err);
        res.status(500).json({ error: err.message });
    }
});

// VERSION CHECK
app.get('/api/health', (req, res) => {
    res.json({ status: 'UP', version: '2.1.0', timestamp: new Date().toISOString() });
});

// ========== NOVAS FUNCIONALIDADES ==========

// --- CONTADOR DE MENSAGENS NÃO LIDAS ---
app.post('/api/contacts/:id/read', authenticateToken, async (req, res) => {
    try {
        await pool.query("UPDATE contacts SET unread_count = 0 WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao marcar como lido' });
    }
});

// --- ENCAMINHAMENTO DE CONVERSA ---
app.get('/api/admin/agents', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT id, name, email FROM users WHERE status = 'active' AND id != ?", [req.user.id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao listar atendentes' });
    }
});

app.post('/api/contacts/:id/transfer', authenticateToken, async (req, res) => {
    try {
        const { target_user_id } = req.body;
        if (!target_user_id) return res.status(400).json({ error: 'ID do atendente destino obrigatório' });

        await pool.query("UPDATE contacts SET user_id = ? WHERE id = ? AND user_id = ?", [target_user_id, req.params.id, req.user.id]);
        res.json({ success: true, message: 'Conversa transferida com sucesso' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao transferir conversa' });
    }
});

// --- PESQUISA DE MENSAGENS ---
app.get('/api/messages/:contactId/search', authenticateToken, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.json([]);

        const [rows] = await pool.query(
            "SELECT * FROM messages WHERE contact_id = ? AND user_id = ? AND content LIKE ? ORDER BY timestamp DESC LIMIT 50",
            [req.params.contactId, req.user.id, `%${q}%`]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Erro na pesquisa' });
    }
});

// --- ENVIO DE ÁUDIO ---
app.post('/api/messages/send-audio', authenticateToken, async (req, res) => {
    try {
        const { contactId, audioBase64, audioUrl } = req.body;

        const [contacts] = await pool.query("SELECT remote_jid FROM contacts WHERE id = ? AND user_id = ?", [contactId, req.user.id]);
        if (contacts.length === 0) return res.status(404).json({ error: 'Contato não encontrado' });

        const remoteJid = contacts[0].remote_jid;
        const [instance] = await pool.query("SELECT business_name FROM whatsapp_accounts WHERE user_id = ? LIMIT 1", [req.user.id]);
        if (instance.length === 0) return res.status(400).json({ error: 'Nenhuma instância configurada' });

        const instanceName = instance[0].business_name;
        const evo = await getEvolutionService();
        if (!evo) return res.status(500).json({ error: 'Evolution API offline' });

        const number = remoteJid.replace('@s.whatsapp.net', '');
        const mediaSource = audioUrl || audioBase64;

        const result = await evo._request(`/message/sendMedia/${instanceName}`, 'POST', {
            number,
            mediatype: 'audio',
            media: mediaSource,
            mimetype: 'audio/ogg; codecs=opus'
        });

        const msgId = result?.key?.id || `AUDIO-${Date.now()}`;
        const timestamp = Math.floor(Date.now() / 1000);

        await pool.query(`
            INSERT INTO messages (user_id, contact_id, instance_name, uid, key_from_me, content, type, timestamp, media_url)
            VALUES (?, ?, ?, ?, 1, '', 'audio', ?, ?)
            ON DUPLICATE KEY UPDATE content = VALUES(content)
        `, [req.user.id, contactId, instanceName, msgId, timestamp, mediaSource]);

        res.json(result);
    } catch (err) {
        console.error('Erro ao enviar áudio:', err);
        res.status(500).json({ error: 'Erro ao enviar áudio', details: err.message });
    }
});

// --- ASSISTENTE DE IA PARA TEXTO ---
app.post('/api/ai/improve-text', authenticateToken, async (req, res) => {
    try {
        const { text, tone } = req.body;
        if (!text) return res.status(400).json({ error: 'Texto obrigatório' });

        const [rows] = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key = 'gemini_api_key'");
        const apiKey = rows[0]?.setting_value;

        if (!apiKey) {
            return res.status(400).json({
                error: 'IA não configurada',
                message: 'Configure sua API Key do Gemini nas Integrações de IA.',
                code: 'AI_NOT_CONFIGURED'
            });
        }

        const tonePrompts = {
            serio: 'Reescreva o texto abaixo com um tom sério e formal:',
            educado: 'Reescreva o texto abaixo de forma educada e cortês:',
            bravo: 'Reescreva o texto abaixo com um tom mais firme e assertivo:',
            engracado: 'Reescreva o texto abaixo de forma divertida e bem-humorada:',
            profissional: 'Reescreva o texto abaixo de forma profissional e corporativa:',
            ortografia: 'Corrija a ortografia e gramática do texto abaixo, mantendo o sentido original:'
        };

        const prompt = tonePrompts[tone] || tonePrompts.profissional;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: `${prompt}\n\n"${text}"\n\nRetorne APENAS o texto reescrito, sem explicações.` }] }]
            })
        });

        const data = await response.json();
        const improvedText = data?.candidates?.[0]?.content?.parts?.[0]?.text || text;

        res.json({ original: text, improved: improvedText.trim() });
    } catch (err) {
        console.error('Erro AI:', err);
        res.status(500).json({ error: 'Erro ao processar IA' });
    }
});

// --- CHATBOT POR PALAVRAS-CHAVE ---
app.get('/api/chatbot/keywords', authenticateToken, async (req, res) => {
    try {
        const [chatbots] = await pool.query("SELECT * FROM keyword_chatbot WHERE user_id = ?", [req.user.id]);
        const chatbot = chatbots[0];

        if (!chatbot) {
            return res.json({ chatbot: null, rules: [] });
        }

        const [rules] = await pool.query("SELECT * FROM keyword_chatbot_rules WHERE chatbot_id = ? ORDER BY response_order ASC", [chatbot.id]);
        res.json({ chatbot, rules });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar chatbot' });
    }
});

app.post('/api/chatbot/keywords', authenticateToken, async (req, res) => {
    try {
        const { instance_name, rules } = req.body;

        // Criar ou atualizar chatbot
        const [existing] = await pool.query("SELECT id FROM keyword_chatbot WHERE user_id = ?", [req.user.id]);
        let chatbotId;

        if (existing.length > 0) {
            chatbotId = existing[0].id;
            await pool.query("UPDATE keyword_chatbot SET instance_name = ?, updated_at = NOW() WHERE id = ?", [instance_name, chatbotId]);
            await pool.query("DELETE FROM keyword_chatbot_rules WHERE chatbot_id = ?", [chatbotId]);
        } else {
            const [result] = await pool.query("INSERT INTO keyword_chatbot (user_id, instance_name) VALUES (?, ?)", [req.user.id, instance_name]);
            chatbotId = result.insertId;
        }

        // Inserir regras
        if (rules && rules.length > 0) {
            for (const rule of rules) {
                await pool.query(
                    "INSERT INTO keyword_chatbot_rules (chatbot_id, match_type, keyword, response_order, message_content, delay_seconds) VALUES (?, ?, ?, ?, ?, ?)",
                    [chatbotId, rule.match_type, rule.keyword, rule.response_order || 0, rule.message_content, rule.delay_seconds || 0]
                );
            }
        }

        res.json({ success: true, chatbot_id: chatbotId });
    } catch (err) {
        console.error('Erro ao salvar chatbot:', err);
        res.status(500).json({ error: 'Erro ao salvar chatbot' });
    }
});

app.patch('/api/chatbot/keywords/toggle', authenticateToken, async (req, res) => {
    try {
        const { is_active } = req.body;

        // Atualizar status do chatbot
        await pool.query("UPDATE keyword_chatbot SET is_active = ? WHERE user_id = ?", [is_active ? 1 : 0, req.user.id]);

        // Se ativando chatbot, pausar todos os FlowBuilds do usuário
        if (is_active) {
            await pool.query("UPDATE flows SET status = 'paused' WHERE user_id = ? AND status = 'active'", [req.user.id]);
        }

        res.json({ success: true, is_active, flowsDisabled: is_active });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao alternar chatbot' });
    }
});

// --- SAÚDE DO SERVIDOR ---
const os = require('os');

app.get('/api/admin/server-health', authenticateAdmin, async (req, res) => {
    try {
        // Métricas atuais
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const ramUsage = ((usedMem / totalMem) * 100).toFixed(2);

        const cpus = os.cpus();
        let cpuUsage = 0;
        for (const cpu of cpus) {
            const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
            const idle = cpu.times.idle;
            cpuUsage += ((total - idle) / total) * 100;
        }
        cpuUsage = (cpuUsage / cpus.length).toFixed(2);

        // Classificação
        let classification = 'boa';
        if (ramUsage > 90 || cpuUsage > 90) classification = 'pessima';
        else if (ramUsage > 75 || cpuUsage > 75) classification = 'ruim';
        else if (ramUsage > 50 || cpuUsage > 50) classification = 'estavel';

        // Salvar log
        await pool.query(`
            INSERT INTO server_health_logs (cpu_usage, ram_usage, ram_used_mb, ram_total_mb, classification)
            VALUES (?, ?, ?, ?, ?)
        `, [cpuUsage, ramUsage, Math.round(usedMem / 1024 / 1024), Math.round(totalMem / 1024 / 1024), classification]);

        // Buscar pico
        const [peak] = await pool.query(`
            SELECT timestamp, cpu_usage, ram_usage FROM server_health_logs 
            WHERE ram_usage = (SELECT MAX(ram_usage) FROM server_health_logs)
            ORDER BY timestamp DESC LIMIT 1
        `);

        // Buscar logs dos CRONs
        const [cronLogs] = await pool.query("SELECT * FROM cron_logs ORDER BY cron_name");

        res.json({
            current: {
                cpu_usage: parseFloat(cpuUsage),
                ram_usage: parseFloat(ramUsage),
                ram_used_mb: Math.round(usedMem / 1024 / 1024),
                ram_total_mb: Math.round(totalMem / 1024 / 1024),
                classification
            },
            peak: peak[0] || null,
            uptime: os.uptime(),
            cronLogs
        });
    } catch (err) {
        console.error('Erro health:', err);
        res.status(500).json({ error: 'Erro ao buscar saúde do servidor' });
    }
});

// ========== CRONS DO SISTEMA ==========
const nodemailer = require('nodemailer');

// Configuração do ZeptoMail
const emailTransport = nodemailer.createTransport({
    host: "smtp.zeptomail.com",
    port: 587,
    auth: {
        user: "emailapikey",
        pass: "wSsVR61x+Rb5W/sozjP4Irw7zFtTVVv2EEh13lP363L5T/uXocdqkRKaDAbyT6NKQmM6RjYRp756nk8I0mFYj4wszQ0DXiiF9mqRe1U4J3x17qnvhDzJXmhcmhWPK44IwwVukmlmEcsm+g=="
    }
});

async function sendEmail(to, subject, html) {
    try {
        await emailTransport.sendMail({
            from: '"UbloChat" <noreply@ublochat.com.br>',
            to,
            subject,
            html
        });
        console.log(`📧 Email enviado para ${to}`);
        return true;
    } catch (err) {
        console.error(`❌ Erro ao enviar email:`, err.message);
        return false;
    }
}

async function logCronExecution(cronName, status, details = '') {
    try {
        const nextExecution = new Date();

        // Calcular próxima execução baseado no CRON
        if (cronName === 'check_subscriptions') {
            nextExecution.setDate(nextExecution.getDate() + 1);
            nextExecution.setHours(1, 0, 0, 0);
        } else if (cronName === 'send_expired_email') {
            nextExecution.setDate(nextExecution.getDate() + 1);
            nextExecution.setHours(9, 0, 0, 0);
        } else if (cronName === 'notify_expiring_plans') {
            nextExecution.setDate(nextExecution.getDate() + 1);
            nextExecution.setHours(14, 0, 0, 0);
        } else if (cronName === 'update_trial_days') {
            nextExecution.setDate(nextExecution.getDate() + 1);
            nextExecution.setHours(0, 0, 0, 0);
        }

        await pool.query(`
            INSERT INTO cron_logs (cron_name, last_execution, next_execution, status, details)
            VALUES (?, NOW(), ?, ?, ?)
            ON DUPLICATE KEY UPDATE last_execution = NOW(), next_execution = VALUES(next_execution), status = VALUES(status), details = VALUES(details)
        `, [cronName, nextExecution, status, details]);
    } catch (err) {
        console.error('Erro ao logar CRON:', err.message);
    }
}

// CRON 01:00 - Verificar assinaturas vencidas e bloquear
async function cronCheckSubscriptions() {
    console.log('🔄 [CRON 01:00] Verificando assinaturas...');
    try {
        // Usuários com trial expirado ou assinatura vencida
        const [expired] = await pool.query(`
            SELECT id, email, name, plan FROM users 
            WHERE (plan = 'Teste Grátis' AND trial_ends_at < NOW()) 
            OR (status = 'inactive')
        `);

        let blocked = 0;
        for (const user of expired) {
            await pool.query("UPDATE users SET is_blocked = TRUE WHERE id = ?", [user.id]);
            blocked++;
        }

        await logCronExecution('check_subscriptions', 'success', `${blocked} usuários bloqueados`);
        console.log(`✅ [CRON 01:00] ${blocked} usuários bloqueados por assinatura vencida`);
    } catch (err) {
        await logCronExecution('check_subscriptions', 'error', err.message);
        console.error('❌ [CRON 01:00] Erro:', err.message);
    }
}

// CRON 09:00 - Enviar email de assinatura vencida
async function cronSendExpiredEmail() {
    console.log('🔄 [CRON 09:00] Enviando emails de assinatura vencida...');
    try {
        const [blocked] = await pool.query(`
            SELECT id, email, name FROM users 
            WHERE is_blocked = TRUE AND email IS NOT NULL
        `);

        let sent = 0;
        for (const user of blocked) {
            const emailHtml = `
                <h2>Olá ${user.name},</h2>
                <p>Sua assinatura do <strong>UbloChat</strong> expirou.</p>
                <p>Os seguintes recursos foram bloqueados:</p>
                <ul>
                    <li>Chat ao vivo</li>
                    <li>Respostas do FlowBuild</li>
                    <li>Chatbot automático</li>
                </ul>
                <p>Para reativar sua conta, acesse o painel e escolha um plano:</p>
                <p><a href="https://ublochat.com.br/#/planos" style="background:#22c55e;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;">Escolher Plano</a></p>
                <p>Equipe UbloChat</p>
            `;

            const success = await sendEmail(user.email, '⚠️ Sua assinatura UbloChat expirou', emailHtml);
            if (success) sent++;
        }

        await logCronExecution('send_expired_email', 'success', `${sent} emails enviados`);
        console.log(`✅ [CRON 09:00] ${sent} emails enviados`);
    } catch (err) {
        await logCronExecution('send_expired_email', 'error', err.message);
        console.error('❌ [CRON 09:00] Erro:', err.message);
    }
}

// CRON 14:00 - Notificar planos prestes a vencer
async function cronNotifyExpiringPlans() {
    console.log('🔄 [CRON 14:00] Verificando planos prestes a vencer...');
    try {
        // Planos que vencem em 3, 2 ou 1 dia
        const [expiring] = await pool.query(`
            SELECT id, email, name, trial_ends_at,
                DATEDIFF(trial_ends_at, NOW()) as days_left
            FROM users 
            WHERE plan = 'Teste Grátis' 
            AND trial_ends_at IS NOT NULL
            AND DATEDIFF(trial_ends_at, NOW()) IN (3, 2, 1, 0)
            AND is_blocked = FALSE
        `);

        let notified = 0;
        for (const user of expiring) {
            let subject, message;

            if (user.days_left === 0) {
                subject = '🚨 Seu teste grátis termina HOJE!';
                message = 'Seu período de teste grátis termina <strong>hoje</strong>! Assine agora para não perder acesso.';
            } else if (user.days_left === 1) {
                subject = '⏰ Seu teste grátis termina amanhã!';
                message = 'Seu período de teste grátis termina <strong>amanhã</strong>! Não perca tempo.';
            } else {
                subject = `⏰ Seu teste grátis termina em ${user.days_left} dias`;
                message = `Seu período de teste grátis termina em <strong>${user.days_left} dias</strong>.`;
            }

            const emailHtml = `
                <h2>Olá ${user.name},</h2>
                <p>${message}</p>
                <p>Assine um plano e continue usando todos os recursos do UbloChat:</p>
                <p><a href="https://ublochat.com.br/#/planos" style="background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;">Ver Planos</a></p>
                <p>Equipe UbloChat</p>
            `;

            const success = await sendEmail(user.email, subject, emailHtml);
            if (success) notified++;
        }

        await logCronExecution('notify_expiring_plans', 'success', `${notified} notificações enviadas`);
        console.log(`✅ [CRON 14:00] ${notified} notificações enviadas`);
    } catch (err) {
        await logCronExecution('notify_expiring_plans', 'error', err.message);
        console.error('❌ [CRON 14:00] Erro:', err.message);
    }
}

// CRON 00:00 - Atualizar dias de teste grátis
async function cronUpdateTrialDays() {
    console.log('🔄 [CRON 00:00] Atualizando dias de teste...');
    try {
        // O trial_ends_at já é uma data, então não precisa decrementar
        // Apenas verificamos e bloqueamos os expirados
        const [expired] = await pool.query(`
            SELECT COUNT(*) as count FROM users 
            WHERE plan = 'Teste Grátis' 
            AND trial_ends_at < NOW() 
            AND is_blocked = FALSE
        `);

        if (expired[0].count > 0) {
            await pool.query(`
                UPDATE users SET is_blocked = TRUE 
                WHERE plan = 'Teste Grátis' 
                AND trial_ends_at < NOW() 
                AND is_blocked = FALSE
            `);
        }

        await logCronExecution('update_trial_days', 'success', `${expired[0].count} trials expirados`);
        console.log(`✅ [CRON 00:00] ${expired[0].count} trials expirados verificados`);
    } catch (err) {
        await logCronExecution('update_trial_days', 'error', err.message);
        console.error('❌ [CRON 00:00] Erro:', err.message);
    }
}

// Agendar CRONs (usando setInterval simples, pode ser substituído por node-cron depois)
function scheduleCrons() {
    const now = new Date();

    // Calcular tempo até próxima execução de cada CRON
    function msUntil(hour) {
        const target = new Date();
        target.setHours(hour, 0, 0, 0);
        if (target <= now) target.setDate(target.getDate() + 1);
        return target - now;
    }

    // CRON 01:00
    setTimeout(() => {
        cronCheckSubscriptions();
        setInterval(cronCheckSubscriptions, 24 * 60 * 60 * 1000);
    }, msUntil(1));

    // CRON 09:00
    setTimeout(() => {
        cronSendExpiredEmail();
        setInterval(cronSendExpiredEmail, 24 * 60 * 60 * 1000);
    }, msUntil(9));

    // CRON 14:00
    setTimeout(() => {
        cronNotifyExpiringPlans();
        setInterval(cronNotifyExpiringPlans, 24 * 60 * 60 * 1000);
    }, msUntil(14));

    // CRON 00:00
    setTimeout(() => {
        cronUpdateTrialDays();
        setInterval(cronUpdateTrialDays, 24 * 60 * 60 * 1000);
    }, msUntil(0));

    console.log('⏰ [CRON] Tarefas agendadas');
}

// Inicializar CRONs após conexão com banco
setTimeout(scheduleCrons, 5000);

// ========== FIM NOVAS FUNCIONALIDADES ==========

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`🌍 Domínio: ublochat.com.br`);
    setupTables();
});
