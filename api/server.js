
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
        const evo = await getEvolutionService();
        if (evo) {
            try {
                // Tenta buscar da Evolution
                const instances = await evo.fetchInstances();
                console.log('📦 [DEBUG] Raw Instances from Evolution:', JSON.stringify(instances, null, 2));

                // Opcional: Sincronizar com DB local se necessário
                // Por simplicidade, retornamos direto, mas mantemos o formato esperado

                // Formatação básica (pode variar conforme a versão da Evolution)
                const formatted = Array.isArray(instances) ? instances : (instances.instances || []);

                const mappedInstances = formatted.map(i => {
                    // Tenta encontrar o status em vários lugares possíveis (v1 vs v2)
                    const status = i.connectionStatus || i.status || i.instance?.status || i.state || 'unknown';
                    const name = i.name || i.instanceName || i.instance?.instanceName || i.instance?.name;
                    const owner = i.owner || i.ownerJid || i.instance?.owner || i.instance?.ownerJid || '';

                    return {
                        id: name,
                        business_name: name,
                        // Aceita 'open', 'connected', 'online' como conectado
                        code_verification_status: ['open', 'connected', 'online', 'authenticated'].includes(status) ? 'VERIFIED' : 'NOT_VERIFIED',
                        status: status,
                        phone_number: owner
                    };
                });
                console.log('🔄 [DEBUG] Mapped Instances:', JSON.stringify(mappedInstances, null, 2));
                return res.json(mappedInstances);
            } catch (evoErr) {
                console.warn('⚠️ [EVOLUTION] Falha ao listar instâncias, fallback para DB:', evoErr.message);
            }
        }

        // Fallback para DB local
        const [rows] = await pool.query(
            "SELECT id, business_name, phone_number, code_verification_status, updated_at FROM whatsapp_accounts WHERE user_id = ?",
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        console.error('❌ Erro GET /api/instances:', err);
        res.status(500).json({ error: 'Erro ao buscar instâncias' });
    }
});

app.post('/api/instances', authenticateToken, async (req, res) => {
    const { instanceName } = req.body;
    try {
        const evo = await getEvolutionService();
        if (!evo) return res.status(400).json({ error: 'Evolution API não configurada' });

        const result = await evo.createInstance(instanceName, req.user.id);

        // Salvar referência no DB local para contagem
        await pool.query(
            "INSERT INTO whatsapp_accounts (user_id, business_name, code_verification_status, phone_number_id) VALUES (?, ?, 'PENDING', '')",
            [req.user.id, instanceName]
        );

        res.json(result);
    } catch (err) {
        console.error('❌ Erro POST /api/instances:', err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/instances/:name', authenticateToken, async (req, res) => {
    try {
        const evo = await getEvolutionService();
        if (!evo) return res.status(400).json({ error: 'Evolution API não configurada' });

        await evo.deleteInstance(req.params.name);

        // Remover do DB local
        await pool.query("DELETE FROM whatsapp_accounts WHERE business_name = ?", [req.params.name]);

        res.json({ message: 'Instância removida' });
    } catch (err) {
        console.error('❌ Erro DELETE /api/instances:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/instances/:name/connect', authenticateToken, async (req, res) => {
    try {
        const evo = await getEvolutionService();
        if (!evo) return res.status(400).json({ error: 'Evolution API não configurada' });

        const data = await evo.connectInstance(req.params.name);
        res.json(data); // Espera-se que retorne base64 do QR Code ou dados dele
    } catch (err) {
        console.error('❌ Erro GET connect:', err);
        res.status(500).json({ error: err.message });
    }
});

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 API: ${PORT}`));
