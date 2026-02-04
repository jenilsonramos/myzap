
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
        await pool.query("ALTER TABLE messages ADD UNIQUE KEY unique_msg_uid (uid)").catch(() => { });
        await pool.query("ALTER TABLE messages MODIFY COLUMN content TEXT").catch(() => { });


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
        const [rows] = await pool.query(`
            SELECT c.*, 
            (SELECT content FROM messages m WHERE m.contact_id = c.id ORDER BY m.timestamp DESC LIMIT 1) as lastMessage,
            (SELECT timestamp FROM messages m WHERE m.contact_id = c.id ORDER BY m.timestamp DESC LIMIT 1) as lastTime
            FROM contacts c 
            WHERE c.user_id = ?
            ORDER BY lastTime DESC
        `, [req.user.id]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Erro ao listar contatos' }); }
});

app.get('/api/messages/:contactId', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT * FROM messages WHERE contact_id = ? AND user_id = ? ORDER BY timestamp ASC",
            [req.params.contactId, req.user.id]
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Erro ao buscar mensagens' }); }
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

        // 3. Salvar no banco (O webhook salvaria, mas para UI ficar rápida salvamos já)
        // await pool.query(...) // Deixar o webhook cuidar ou salvar com key_from_me=1

        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao enviar mensagem' });
    }
});

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
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar perfil' });
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
            "SELECT COUNT(*) as total FROM messages WHERE user_id = ? AND type = 1",
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
        const { type, instance, data } = req.body;
        console.log(`🔔 [WEBHOOK] Recebido evento: ${type} | Instância: ${instance}`);

        // Log do payload para debug
        console.log('📦 [WEBHOOK] Payload recebido:', JSON.stringify(req.body, null, 2));

        if (type === 'MESSAGES_UPSERT' || type === 'messages.upsert' || type === 'SEND_MESSAGE') {
            const msg = data.data || data; // V2 data structure vary
            if (!msg || !msg.key) {
                console.log('⚠️ [WEBHOOK] Payload inválido ou vazio');
                return res.status(200).send('OK');
            }

            console.log(`📨 [WEBHOOK] Processando mensagem de ${msg.key.remoteJid}`);

            // 1. Achar dono da instancia
            // Tentativa 1: Nome exato
            let [rows] = await pool.query("SELECT user_id FROM whatsapp_accounts WHERE business_name = ?", [instance]);

            if (rows.length === 0) {
                // Tentativa 2: Case-insensitive
                [rows] = await pool.query("SELECT user_id FROM whatsapp_accounts WHERE LOWER(business_name) = LOWER(?)", [instance]);
            }

            if (rows.length === 0 && instance.includes('-')) {
                // Tentativa 3: Se o nome vier com sufixo (comum em algumas versões da Evolution)
                const simpleName = instance.split('-')[0];
                console.log(`🔍 [WEBHOOK] Tentando nome simplificado: ${simpleName}`);
                [rows] = await pool.query("SELECT user_id FROM whatsapp_accounts WHERE LOWER(business_name) = LOWER(?)", [simpleName]);
            }

            if (rows.length === 0) {
                console.log(`❌ [WEBHOOK] Instância '${instance}' não vinculada a nenhum usuário no DB.`);
                return res.status(200).send('OK');
            }

            const userId = rows[0].user_id;
            console.log(`👤 [WEBHOOK] Usuário identificado: ${userId}`);

            const remoteJid = msg.key.remoteJid;
            const fromMe = msg.key.fromMe;
            const pushName = msg.pushName || (fromMe ? 'Eu' : 'Desconhecido');
            const messageType = msg.messageType || (msg.message ? Object.keys(msg.message)[0] : 'unknown');

            // Extrair conteúdo de forma mais robusta
            let content = '';
            if (msg.message?.conversation) {
                content = msg.message.conversation;
            } else if (msg.message?.extendedTextMessage?.text) {
                content = msg.message.extendedTextMessage.text;
            } else if (msg.message?.imageMessage?.caption) {
                content = msg.message.imageMessage.caption;
            } else if (msg.message?.videoMessage?.caption) {
                content = msg.message.videoMessage.caption;
            } else {
                content = `[Mensagem do tipo ${messageType}]`;
            }

            // 2. Upsert Contact
            if (remoteJid === 'status@broadcast') return res.status(200).send('OK');

            console.log(`📇 [WEBHOOK] Upsert contato: ${remoteJid} (${pushName})`);
            await pool.query(`
                INSERT INTO contacts (user_id, remote_jid, name, updated_at)
                VALUES (?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE name = VALUES(name), updated_at = NOW()
            `, [userId, remoteJid, pushName]);

            // 3. Pegar ID do contato
            const [contactRows] = await pool.query("SELECT id FROM contacts WHERE user_id = ? AND remote_jid = ?", [userId, remoteJid]);
            const contactId = contactRows[0]?.id;

            // 4. Salvar Mensagem
            console.log(`💾 [WEBHOOK] Salvando mensagem no banco...`);
            await pool.query(`
                INSERT INTO messages (user_id, contact_id, instance_name, uid, key_from_me, content, type, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE content = VALUES(content)
            `, [
                userId,
                contactId,
                instance,
                msg.key.id,
                fromMe ? 1 : 0,
                content,
                messageType,
                msg.messageTimestamp || Math.floor(Date.now() / 1000)
            ]);

            console.log(`✅ [WEBHOOK] Mensagem salva com sucesso!`);
        } else {
            console.log(`ℹ️ [WEBHOOK] Evento ignorado: ${type}`);
        }

        res.status(200).send('OK');
    } catch (err) {
        console.error('❌ [WEBHOOK] Erro Fatal:', err);
        res.status(500).json({
            error: 'Erro no processamento do webhook',
            details: err.message,
            code: err.code
        });
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
    res.json({ status: 'UP', version: '2.0.2', timestamp: new Date().toISOString() });
});

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`🌍 Domínio: ublochat.com.br`);
    setupTables();
});
