
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const axios = require('axios');
const nodemailer = require('nodemailer');
const EvolutionService = require('./EvolutionService');
const WhatsAppCloudService = require('./WhatsAppCloudService');

const app = express();

const authenticateToken = (req, res, next) => {
    let token = req.headers['authorization']?.split(' ')[1];
    if (!token && req.query.token) token = req.query.token;

    if (!token) return res.sendStatus(401);
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        console.error('❌ [CRITICAL] JWT_SECRET não configurado no .env!');
        return res.status(500).json({ error: 'Erro de configuração do servidor' });
    }

    jwt.verify(token, secret, async (err, decoded) => {
        if (err) {
            console.log(`❌ [AUTH] Token inválido ou expirado: ${err.message}`);
            return res.status(403).json({ error: 'Sessão expirada ou token inválido. Por favor, faça login novamente.', code: 'TOKEN_INVALID' });
        }

        if (decoded.role === 'admin') {
            req.user = decoded;
            return next();
        }

        try {
            const [rows] = await pool.execute('SELECT id, email, name, role, status, plan, trial_ends_at FROM users WHERE id = ?', [decoded.id]);
            if (rows.length === 0) return res.status(401).json({ error: 'Usuário não encontrado' });

            const user = rows[0];

            if (user.status === 'expired' && user.plan === 'Teste Grátis' && user.trial_ends_at && new Date(user.trial_ends_at) > new Date()) {
                console.log(`🚑 [SELF-HEAL] Reativando usuário ${user.email} (Trial válido até ${user.trial_ends_at})`);
                await pool.execute("UPDATE users SET status = 'active', is_blocked = FALSE WHERE id = ?", [user.id]);
                user.status = 'active';
            }

            req.user = user;
            console.log(`👤 [USER] ${user.id} (${user.email}) -> ${req.method} ${req.url} [Plan: ${user.plan}, Status: ${user.status}]`);

            const allowedPaths = ['/api/user/subscription', '/api/plans', '/api/stripe/create-checkout-session', '/api/auth/me', '/api/admin/settings'];
            const isAllowed = allowedPaths.some(path => req.url.startsWith(path));

            const isBlocked = ['inactive', 'suspended', 'expired'].includes(user.status);
            if (isBlocked && user.role !== 'admin' && !isAllowed) {
                console.warn(`🚫 [BLOCK] Usuário ${user.id} (${user.email}) tentando acessar ${req.url} com status: ${user.status}.`);

                let errorMessage = 'Sua assinatura expirou. Por favor, renove para continuar.';
                let errorCode = 'SUBSCRIPTION_EXPIRED';

                if (user.status === 'suspended') {
                    errorMessage = 'Sua conta foi suspensa. Entre em contato com o suporte.';
                    errorCode = 'ACCOUNT_SUSPENDED';
                }

                return res.status(403).json({ error: errorMessage, code: errorCode });
            }

            next();
        } catch (err) { return res.sendStatus(500); }
    });
};

const authenticateAdmin = (req, res, next) => {
    authenticateToken(req, res, () => {
        if (req.user.role === 'admin') {
            next();
        } else {
            res.sendStatus(403);
        }
    });
};


// Configurações de Segurança Nativas
app.use(helmet({
    contentSecurityPolicy: false, // Pode causar problemas com React se não configurado finamente
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Configuração de CORS (Mais restrito que *)
const corsOptions = {
    origin: process.env.APP_URL || 'https://ublochat.com.br',
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate Limiting (Proteção contra Bruta Force e DoS)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // limite de 100 requests por IP
    message: { error: 'Muitas requisições deste IP, tente novamente após 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10, // limite de 10 tentativas para login/registro
    message: { error: 'Muitas tentativas de login/registro. Tente novamente após 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const MASTER_TEMPLATE = (title, content, ctaText = null, ctaUrl = null) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Outfit', 'Segoe UI', sans-serif; background-color: #f1f5f9; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
        .wrapper { width: 100%; table-layout: fixed; background-color: #f1f5f9; padding: 40px 0; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 32px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.08); border: 1px solid rgba(255,255,255,0.1); }
        .header { background: linear-gradient(135deg, #6366f1 0%, #10b981 100%); padding: 60px 40px; text-align: center; }
        .logo { font-size: 32px; font-weight: 800; color: #ffffff; letter-spacing: -1.5px; text-transform: uppercase; }
        .content { padding: 50px 40px; color: #334155; line-height: 1.8; }
        .title { font-size: 28px; font-weight: 800; color: #0f172a; margin-bottom: 24px; letter-spacing: -1px; }
        .text { font-size: 16px; margin-bottom: 24px; color: #475569; }
        .btn-container { text-align: center; margin: 40px 0; }
        .btn { background: #6366f1; color: #ffffff !important; padding: 18px 36px; text-decoration: none; border-radius: 18px; font-weight: 700; font-size: 15px; letter-spacing: 0.5px; display: inline-block; transition: all 0.3s ease; box-shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.4); }
        .footer { padding: 40px; text-align: center; color: #94a3b8; font-size: 13px; background: #f8fafc; border-top: 1px solid #f1f5f9; }
        .divider { height: 1px; background: linear-gradient(to right, transparent, #e2e8f0, transparent); margin: 40px 0; }
        .badge { display: inline-block; padding: 6px 14px; background: #e0e7ff; border-radius: 99px; font-size: 11px; font-weight: 800; color: #4338ca; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 1.5px; }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <div class="header">
                <div class="logo">MyZap</div>
            </div>
            <div class="content">
                ${content}
                ${ctaText && ctaUrl ? `
                <div class="btn-container">
                    <a href="${ctaUrl}" class="btn">${ctaText}</a>
                </div>
                ` : ''}
                <div class="divider"></div>
                <p class="text" style="font-size: 14px; color: #64748b; text-align: center;">
                    Dúvidas? Estamos aqui para ajudar.<br>
                    <strong>Suporte Premium:</strong> hello@ublochat.com.br
                </p>
            </div>
            <div class="footer">
                <p>&copy; 2026 MyZap Enterprise. Sua automação inteligente.<br>Florianópolis, SC - Brasil</p>
            </div>
        </div>
    </div>
</body>
</html>
`;

// --- CONFIGURAÇÃO DE UPLOADS (MULTER) ---
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Servir arquivos estáticos da pasta uploads (Corrigido para /api/uploads)
app.use('/api/uploads', express.static(uploadDir));
app.use('/uploads', express.static(uploadDir)); // Fallback compatibilidade

// --- PROXY DE MÍDIA (Para evitar CORS e problemas de decriptação) ---
app.get('/api/media/proxy', authenticateToken, async (req, res) => {
    const { url, msgId, instance, remoteJid: qRemoteJid, fromMe: qFromMe } = req.query;
    if (!url && (!msgId || !instance)) return res.status(400).send('URL or msgId/instance is required');

    const fs = require('fs');
    const logProxy = (msg) => {
        try {
            fs.appendFileSync('../webhook_debug.log', `[PROXY][${new Date().toISOString()}] ${msg}\n`);
        } catch (e) { console.error(e); }
    };

    logProxy(`Solicitado por ${req.user.id}: msgId=${msgId}, instance=${instance}, remoteJid=${qRemoteJid}, fromMe=${qFromMe}`);

    try {
        const evo = await getEvolutionService();

        // --- SEGURANÇA: Validar se a mensagem pertence ao usuário logado ---
        if (msgId && instance && evo) {
            logProxy(`Buscando via Evolution API: ${msgId} na instância: ${instance}`);
            try {
                let remoteJid = qRemoteJid;
                let fromMe = qFromMe === 'true';

                // SEMPRE validar pelo user_id do token se possível (Dono validado no banco)
                const [msgRows] = await pool.query(
                    "SELECT c.remote_jid, m.key_from_me FROM messages m JOIN contacts c ON m.contact_id = c.id WHERE m.uid = ? AND m.user_id = ?",
                    [msgId, req.user.id]
                );

                if (msgRows.length > 0) {
                    remoteJid = msgRows[0].remote_jid;
                    fromMe = msgRows[0].key_from_me === 1;
                    logProxy(`Dono validado: RemoteJID=${remoteJid}, fromMe=${fromMe}`);
                } else if (!url) {
                    // Se não encontrou no banco e não tem URL fallback, bloqueia
                    logProxy(`❌ [PROXY ERROR] Mensagem ${msgId} não pertence ao usuário ${req.user.id} ou não encontrada.`);
                    return res.status(403).send('Acesso negado à mídia');
                }

                if (remoteJid) {
                    const data = await evo.getMediaBase64(instance, {
                        id: msgId,
                        fromMe: fromMe,
                        remoteJid: remoteJid
                    });

                    if (data && data.base64) {
                        logProxy(`Mídia recuperada via Evolution (${msgId})`);
                        const buffer = Buffer.from(data.base64, 'base64');
                        res.set('Content-Type', data.mimetype || 'application/octet-stream');
                        res.set('Cache-Control', 'public, max-age=86400');
                        return res.send(buffer);
                    } else {
                        logProxy(`Evolution sem base64 para ${msgId}. Tente fallback se URL disponível.`);
                    }
                } else {
                    logProxy(`Sem RemoteJID para ${msgId}. Fallback para URL direta.`);
                }
            } catch (evoErr) {
                logProxy(`Falha no getBase64 para ${msgId}: ${evoErr.message}`);
            }
        }

        if (!url) return res.status(404).send('Media not found');

        // Se chegamos aqui e a URL é de MMS do WhatsApp, ela provavelmente é criptografada.
        // O download direto não vai funcionar para renderização sem as chaves.
        if (url.includes('mmg.whatsapp.net') || url.includes('.enc')) {
            console.warn(`[PROXY WARNING] Fallback direto para URL criptografada detectado. É provável que a imagem não renderize.`);
        }

        console.log(`[PROXY] Buscando via download direto: ${url.substring(0, 80)}...`);
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
            timeout: 20000,
            validateStatus: false,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': '*/*'
            }
        });

        if (response.status !== 200) {
            console.error(`[PROXY ERROR] Servidor remoto retornou ${response.status} para ${url}`);
            return res.status(response.status).send(`Remote server error: ${response.status}`);
        }

        res.set('Content-Type', response.headers['content-type'] || 'application/octet-stream');
        res.set('Cache-Control', 'public, max-age=86400');
        response.data.pipe(res);
    } catch (err) {
        console.error(`[PROXY CRITICAL] Falha ao buscar mídia:`, err.message);
        res.status(500).send('Error fetching media: ' + err.message);
    }
});

// --- HELPER PARA OBTER URL PÚBLICA ---
async function getAppUrl(req) {
    try {
        const [rows] = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key = 'app_url'");
        if (rows.length > 0 && rows[0].setting_value) {
            return rows[0].setting_value.trim().replace(/%$/, '').replace(/\/$/, '');
        }
    } catch (e) { }

    // Use request host if available (more reliable for public access)
    if (req && req.get('host')) {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        return `${protocol}://${req.get('host')}`;
    }

    // Fallback to Env or a more likely domain for this project
    return (process.env.API_URL || 'https://ublochat.com.br').replace(/\/$/, '');
}

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

                // 📧 Enviar email de confirmação de pagamento
                try {
                    const [settingsRows] = await pool.execute('SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ("smtp_user", "smtp_pass", "smtp_from_email", "smtp_from_name")');
                    const smtp = {};
                    settingsRows.forEach(row => smtp[row.setting_key] = row.setting_value);

                    if (smtp.smtp_pass) {
                        const token = (smtp.smtp_pass || '').replace(/zoho-enczapikey\s+/i, '').trim();
                        const emailHtml = MASTER_TEMPLATE(
                            'Pagamento Confirmado',
                            `
                            <div class="badge" style="color: #10b981; background: #ecfdf5;">Sucesso</div>
                            <h2 class="title">Seu pagamento foi confirmado! 🎉</h2>
                            <p class="text">Temos o prazer de informar que seu pagamento para o plano <strong>${planName}</strong> foi processado com sucesso.</p>
                            <div style="background: #f8fafc; padding: 20px; border-radius: 16px; margin: 24px 0;">
                                <p style="margin: 5px 0; font-size: 14px;"><strong>Plano:</strong> ${planName}</p>
                                <p style="margin: 5px 0; font-size: 14px;"><strong>Status:</strong> Ativo ✅</p>
                            </div>
                            <p class="text">Seus limites já foram atualizados e sua conta está totalmente ativa.</p>
                            `,
                            'Entrar no Painel',
                            'https://ublochat.com.br'
                        );

                        await axios.post('https://api.zeptomail.com/v1.1/email', {
                            from: { address: smtp.smtp_from_email || 'no-reply@ublochat.com.br', name: smtp.smtp_from_name || 'MyZap' },
                            to: [{ email_address: { address: userEmail, name: userEmail.split('@')[0] } }],
                            subject: '🎉 Pagamento Confirmado - MyZap',
                            htmlbody: emailHtml
                        }, {
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json',
                                'Authorization': `Zoho-enczapikey ${token}`
                            }
                        });
                        console.log(`📧 [STRIPE WEBHOOK] Email de confirmação enviado para ${userEmail}`);
                    }
                } catch (emailErr) {
                    console.error(`⚠️ [STRIPE WEBHOOK] Falha ao enviar email de confirmação:`, emailErr.message);
                }
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
                "UPDATE users SET status = 'expired' WHERE stripe_subscription_id = ?",
                [subscription.id]
            );
        } catch (err) {
            console.error('❌ [STRIPE WEBHOOK] Erro ao desativar:', err);
        }
    }
    res.json({ received: true });
});

// Parsers globais (Movidos para depois do Stripe Webhook por causa do raw body)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
        await pool.execute("UPDATE users SET status = 'active' WHERE status IS NULL OR status NOT IN ('active', 'suspended', 'expired', 'inactive', 'pending_activation')");
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
                flows INT DEFAULT 5,
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

        // Campos para API Oficial (Meta Cloud API)
        await pool.query("ALTER TABLE whatsapp_accounts ADD COLUMN provider ENUM('evolution', 'official') DEFAULT 'evolution' AFTER phone_number_id").catch(() => { });
        await pool.query("ALTER TABLE whatsapp_accounts ADD COLUMN access_token TEXT AFTER provider").catch(() => { }); // Token Permanente
        await pool.query("ALTER TABLE whatsapp_accounts ADD COLUMN waba_id VARCHAR(100) AFTER access_token").catch(() => { }); // WhatsApp Business Account ID

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
        await pool.query("ALTER TABLE contacts ADD COLUMN is_blocked BOOLEAN DEFAULT FALSE").catch(() => { });
        await pool.query("ALTER TABLE contacts ADD COLUMN ai_paused BOOLEAN DEFAULT FALSE").catch(() => { });
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

        // ========== OTIMIZAÇÃO: ÍNDICES ==========
        console.log('🚀 [DB] Aplicando otimizações de performance...');
        await pool.query("CREATE INDEX idx_messages_user_contact ON messages(user_id, contact_id)").catch(() => { });
        await pool.query("CREATE INDEX idx_messages_timestamp ON messages(timestamp)").catch(() => { });
        await pool.query("CREATE INDEX idx_contacts_user ON contacts(user_id)").catch(() => { });
        await pool.query("CREATE INDEX idx_wa_accounts_user ON whatsapp_accounts(user_id)").catch(() => { });

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

        // Adicionar colunas se não existirem (Safe check)
        await pool.query("ALTER TABLE flow_state ADD COLUMN flow_id VARCHAR(255)").catch(() => { });
        await pool.query("ALTER TABLE flow_state ADD COLUMN current_node_id VARCHAR(255)").catch(() => { });
        await pool.query("ALTER TABLE flow_state ADD COLUMN variables JSON").catch(() => { });
        await pool.query("ALTER TABLE contacts ADD COLUMN variables JSON").catch(() => { });

        // Garantir coluna flows na tabela plans
        await pool.query("ALTER TABLE plans ADD COLUMN flows INT DEFAULT 5 AFTER messages").catch(() => { });

        // Atualizar limites específicos dos planos existentes
        await pool.query("UPDATE plans SET flows = 1 WHERE name = 'Teste Grátis'");
        await pool.query("UPDATE plans SET flows = 10 WHERE name = 'Professional'");
        await pool.query("UPDATE plans SET flows = 50 WHERE name = 'Master IA'");
        await pool.query("UPDATE plans SET flows = 999 WHERE name = 'Enterprise'");

        // ========== FIM NOVAS TABELAS ==========

        // Inserir planos padrão se a tabela estiver vazia
        const [planRows] = await pool.query("SELECT COUNT(*) as count FROM plans");
        if (planRows[0].count === 0) {
            console.log('💎 [DB] Inserindo planos padrão...');
            const defaultPlans = [
                ['Teste Grátis', 0, 3, 1000, 1, 5, 10000, JSON.stringify(['Filtros Básicos'])],
                ['Professional', 99, 10, 100000, 10, 50, 500000, JSON.stringify(['Suporte Especializado', 'Webhooks'])],
                ['Master IA', 299, 50, 1000000, 50, 200, 5000000, JSON.stringify(['Filtros Avançados', 'AI Agent Pro'])],
                ['Enterprise', 499, 999, 9999999, 999, 999, 99999999, JSON.stringify(['SLA 99.9%', 'White-label'])]
            ];
            for (const p of defaultPlans) {
                await pool.query("INSERT INTO plans (name, price, instances, messages, flows, ai_nodes, ai_tokens, features) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", p);
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

        // TABELA: email_templates
        await pool.query(`
            CREATE TABLE IF NOT EXISTS email_templates (
                id INT AUTO_INCREMENT PRIMARY KEY,
                template_key VARCHAR(50) UNIQUE NOT NULL,
                subject VARCHAR(255) NOT NULL,
                body_html TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        // Popular templates iniciais se estiverem vazios
        const [templates] = await pool.query("SELECT id FROM email_templates LIMIT 1");
        if (templates.length === 0) {
            await pool.query(`
                INSERT INTO email_templates (template_key, subject, body_html) VALUES 
                ('welcome', '🚀 Bem-vindo ao MyZap!', '<div class="badge">Sucesso</div><h2 class="title">Olá, {{name}}! 👋</h2><p class="text">Sua conta foi criada com sucesso. Estamos felizes em ter você conosco!</p><p class="text">Explore todas as nossas funcionalidades de automação agora mesmo.</p>'),
                ('activation', '🔑 Ative sua Experiência MyZap', '<div class="badge">Segurança</div><h2 class="title">Sua Chave de Acesso está pronta!</h2><p class="text">Olá {{name}}, use o código abaixo para ativar sua conta:</p><div style="background: #f8fafc; padding: 40px; border-radius: 20px; border: 2px dashed #6366f1; text-align: center; margin: 30px 0;"><span style="font-size: 42px; font-weight: 800; color: #4338ca; letter-spacing: 12px; font-family: monospace;">{{code}}</span></div>'),
                ('password_recovery', '🔐 Recuperação de Acesso', '<div class="badge">Privacidade</div><h2 class="title">Esqueceu sua senha?</h2><p class="text">Não se preocupe, acontece com os melhores. Clique no botão abaixo para criar uma senha nova e segura.</p>')
            `);
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
            keepAliveInitialDelay: 0,
            timezone: '-03:00' // Horário de Brasília (mysql2)
        });
        console.log('✅ MyZap MySQL Pool Criado (Timezone: -03:00).');

        // TESTE DE CONEXÃO IMEDIATO
        const connection = await pool.getConnection();
        console.log('✅ Conexão com o Banco de Dados estabelecida com sucesso.');
        connection.release();

        setTimeout(setupTables, 1000);
    } catch (err) {
        console.error('❌ ERRO CRÍTICO NA CONEXÃO COM O BANCO DE DADOS:', err.message);
        console.error('Verifique as credenciais no arquivo .env e se o banco está rodando.');
        throw err; // Propaga para o startServer
    }
}

// A inicialização será chamada ao final do arquivo

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




// --- HELPER DE LIMITES ---
async function checkUserLimit(userId, limitType) {
    try {
        const [userRows] = await pool.execute("SELECT plan, role, status FROM users WHERE id = ?", [userId]);
        if (userRows.length === 0) return { allowed: false, error: 'Usuário não encontrado' };

        const user = userRows[0];
        if (user.role === 'admin') return { allowed: true };

        // --- BLOQUEIO POR STATUS ---
        if (user.status !== 'active') {
            const statusMsg = user.status === 'suspended'
                ? 'Sua conta está suspensa. Entre em contato com o suporte.'
                : 'Sua assinatura expirou. Renove seu plano para continuar.';
            return { allowed: false, error: statusMsg, code: 'STATUS_BLOCKED' };
        }

        const [planRows] = await pool.execute("SELECT * FROM plans WHERE name = ?", [user.plan]);
        if (planRows.length === 0) return { allowed: false, error: 'Plano não encontrado' };

        const plan = planRows[0];
        let currentUsage = 0;

        if (limitType === 'instances') {
            const [rows] = await pool.query("SELECT COUNT(*) as total FROM whatsapp_accounts WHERE user_id = ?", [userId]);
            currentUsage = rows[0].total;
            if (currentUsage >= plan.instances && plan.instances < 999) {
                return { allowed: false, error: `Limite de instâncias atingido (${plan.instances}). Faça upgrade do seu plano.`, code: 'LIMIT_INSTANCES' };
            }
        } else if (limitType === 'messages') {
            // Check Monthly Limit (1st of current month)
            const [rows] = await pool.query("SELECT COUNT(*) as total FROM messages WHERE user_id = ? AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01 00:00:00')", [userId]);
            currentUsage = rows[0].total;
            // Removed < 1000000 bug. Assuming 9999999 is "unlimited".
            if (currentUsage >= plan.messages && plan.messages < 9999999) {
                return { allowed: false, error: `Limite mensal de mensagens atingido (${plan.messages}). Renove em breve ou faça upgrade.`, code: 'LIMIT_MESSAGES' };
            }
        } else if (limitType === 'flows') {
            const [rows] = await pool.query("SELECT COUNT(*) as total FROM flows WHERE user_id = ?", [userId]);
            currentUsage = rows[0].total;
            const flowLimit = plan.flows || 5;
            if (currentUsage >= flowLimit && flowLimit < 999) {
                return { allowed: false, error: `Limite de fluxos atingido (${flowLimit}). Faça upgrade do seu plano.`, code: 'LIMIT_FLOWS' };
            }
        }

        return { allowed: true };
    } catch (err) {
        console.error('❌ [LIMIT CHECK] Erro:', err);
        return { allowed: false, error: 'Erro interno ao verificar limites' };
    }
}




// Aplicar rate limiting especial para rotas sensíveis
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/recover', authLimiter);
app.use('/api/auth/activate', authLimiter);
app.use('/api/admin/', apiLimiter); // Proteção extra para admin

// --- AUTH ---

// --- WEBHOOK META CLOUD API (OFICIAL) ---
app.get('/api/webhook/meta', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // Token de verificação fixo (pode mover para .env depois)
    const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'myzap_meta_secret_123';

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('✅ [META WEBHOOK] Verificado com sucesso!');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(400);
    }
});

app.post('/api/webhook/meta', async (req, res) => {
    try {
        const body = req.body;
        // console.log('📩 [META WEBHOOK] Payload:', JSON.stringify(body, null, 2));

        if (body.object) {
            if (
                body.entry &&
                body.entry[0].changes &&
                body.entry[0].changes[0] &&
                body.entry[0].changes[0].value.messages &&
                body.entry[0].changes[0].value.messages[0]
            ) {
                const change = body.entry[0].changes[0].value;
                const message = change.messages[0];
                const from = message.from;
                const msgId = message.id;
                const timestamp = message.timestamp; // Unix seconds
                const businessId = body.entry[0].id; // WABA ID (precisamos mapear para instância)

                // Encontrar instância pelo WABA ID ou Phone ID
                // Nota: O payload vem com metadata.phone_number_id
                const phoneId = change.metadata.phone_number_id;

                const [rows] = await pool.execute(
                    "SELECT user_id, business_name FROM whatsapp_accounts WHERE phone_number_id = ?",
                    [phoneId]
                );

                if (rows.length === 0) {
                    console.warn(`⚠️ [META WEBHOOK] Instância não encontrada para Phone ID: ${phoneId}`);
                    return res.sendStatus(200);
                }

                const instance = rows[0];
                const userId = instance.user_id;
                const instanceName = instance.business_name;

                let content = '';
                let type = message.type;
                let mediaUrl = null;

                if (type === 'text') {
                    content = message.text.body;
                } else if (['image', 'video', 'audio', 'document', 'sticker'].includes(type)) {
                    // Mídia requer download ou uso do ID. 
                    // Para simplificar, vamos salvar apenas o ID ou tentar recuperar URL se possível
                    // A URL da Meta é temporária, então idealmente baixaríamos.
                    // Por enquanto: Content = "Mídia de [Tipo]"
                    content = `[Mídia: ${type}]`;
                    if (message[type].id) {
                        // TODO: Implementar download de mídia via WhatsAppCloudService
                        content += ` ID: ${message[type].id}`;
                    }
                }

                // Processar mensagem (Salvar no banco e disparar fluxos)
                // Reaproveitando lógica do processIncomingMessage se possível, ou duplicando simplificado
                const contactName = change.contacts ? change.contacts[0].profile.name : from;

                // Salvar Contato
                await pool.query(
                    "INSERT INTO contacts (user_id, remote_jid, name, instance_name) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), updated_at = NOW()",
                    [userId, from, contactName, instanceName]
                );

                // Obter ID do contato
                const [contactDesc] = await pool.query("SELECT id FROM contacts WHERE user_id = ? AND remote_jid = ?", [userId, from]);
                const contactId = contactDesc[0].id;

                // Salvar Mensagem
                await pool.query(
                    "INSERT INTO messages (user_id, contact_id, instance_name, uid, key_from_me, content, type, timestamp, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [userId, contactId, instanceName, msgId, 0, content, type, timestamp, 'official']
                );

                console.log(`📥 [META WEBHOOK] Mensagem salva de ${from} em ${instanceName}`);

                // Disparar Trigger de Fluxo (Simplificado)
                // TODO: Chamar engine de fluxo

            }
            res.sendStatus(200);
        } else {
            res.sendStatus(404);
        }
    } catch (err) {
        console.error('❌ [META WEBHOOK] Erro:', err.message);
        res.sendStatus(500);
    }
});

app.post('/api/auth/register', authLimiter, async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const [rows] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (rows.length > 0) return res.status(400).json({ error: 'Email ja cadastrado' });

        // Verificar se ativação de conta está habilitada
        const [settingsRows] = await pool.execute('SELECT setting_value FROM system_settings WHERE setting_key = ?', ['require_email_activation']);
        const requireActivation = settingsRows[0]?.setting_value === 'true';

        // Gerar código de ativação se necessário
        const activationCode = requireActivation ? Math.random().toString(36).substring(2, 8).toUpperCase() : null;
        const userStatus = requireActivation ? 'pending_activation' : 'active';

        const hashedPassword = await bcrypt.hash(password, 10);
        const [insertResult] = await pool.execute(
            "INSERT INTO users (name, email, password, status, plan, created_at, trial_ends_at, activation_code) VALUES (?, ?, ?, ?, 'Teste Grátis', NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY), ?)",
            [name, email, hashedPassword, userStatus, activationCode]
        );

        // Enviar email de boas-vindas ou ativação
        if (requireActivation) {
            await sendEmailWithTemplate(email, 'activation', { name, code: activationCode }, { text: 'Ativar Conta Agora', url: 'https://ublochat.com.br/activation' });
        } else {
            await sendEmailWithTemplate(email, 'welcome', { name }, { text: 'Entrar no Painel', url: 'https://ublochat.com.br' });
        }

        res.status(201).json({
            message: 'OK',
            requireActivation,
            email: requireActivation ? email : undefined
        });
    } catch (err) {
        console.error('❌ [REGISTER] Erro:', err);
        res.status(500).json({ error: 'Erro ao criar conta' });
    }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) return res.status(401).json({ error: 'Nao encontrado' });
        const user = rows[0];
        if (!await bcrypt.compare(password, user.password)) return res.status(401).json({ error: 'Senha incorreta' });

        if (user.status === 'pending_activation') {
            return res.status(403).json({ error: 'Sua conta ainda não foi ativada. Verifique seu e-mail.', status: 'pending_activation' });
        }

        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('JWT_SECRET missing');

        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name, role: user.role || 'user' },
            secret,
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

// Endpoint de ativação de conta
app.post('/api/auth/activate', async (req, res) => {
    const { email, code } = req.body;
    try {
        const [users] = await pool.execute(
            'SELECT id, activation_code, status FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });

        const user = users[0];
        if (user.status !== 'pending_activation') {
            return res.status(400).json({ error: 'Conta já está ativada' });
        }

        if (user.activation_code !== code.toUpperCase()) {
            return res.status(400).json({ error: 'Código de ativação inválido' });
        }

        await pool.execute(
            "UPDATE users SET status = 'active', activation_code = NULL WHERE id = ?",
            [user.id]
        );

        // Enviar email de BOAS-VINDAS
        try {
            const [smtpSettings] = await pool.execute('SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ("smtp_pass", "smtp_from_email", "smtp_from_name")');
            const smtp = {};
            smtpSettings.forEach(row => smtp[row.setting_key] = row.setting_value);

            if (smtp.smtp_pass) {
                const subject = '🚀 Bem-vindo ao MyZap - Conta Ativada!';
                const emailHtml = MASTER_TEMPLATE(
                    'Conta Ativada',
                    `
                    <div class="badge">Sucesso</div>
                    <h2 class="title">Tudo pronto! 🚀</h2>
                    <p class="text">Sua conta no MyZap foi ativada com sucesso. Você agora tem acesso total a todas as ferramentas.</p>
                    <div style="background: #f0fdf4; border-left: 4px solid #10B981; padding: 20px; border-radius: 8px; margin: 24px 0;">
                        <p style="color: #065f46; margin: 0; font-size: 15px;"><strong>Dica:</strong> Comece conectando seu primeiro número em "Instâncias".</p>
                    </div>
                    `,
                    'Entrar no Painel',
                    'https://ublochat.com.br'
                );
                await sendZeptoEmail(email, subject, emailHtml);
            }
        } catch (e) {
            console.error('Erro ao enviar boas-vindas na ativação:', e);
        }

        // 🔐 Gerar Token para login automático
        const [fullUser] = await pool.execute('SELECT id, name, email, plan, role, trial_ends_at FROM users WHERE id = ?', [user.id]);
        const userData = fullUser[0];
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('JWT_SECRET missing');

        const token = jwt.sign(
            { id: userData.id, email: userData.email, name: userData.name, role: userData.role || 'user' },
            secret,
            { expiresIn: '7d' }
        );

        console.log(`✅ [ACTIVATION] Conta ativada e logada: ${email}`);
        res.json({
            message: 'Conta ativada com sucesso!',
            token,
            user: { ...userData, plan: userData.plan || 'Teste Grátis' }
        });
    } catch (err) {
        console.error('❌ [ACTIVATION] Erro:', err);
        res.status(500).json({ error: 'Erro ao ativar conta' });
    }
});

// Endpoint de recuperação de senha
app.post('/api/auth/recover', async (req, res) => {
    const { email } = req.body;
    try {
        const [users] = await pool.execute('SELECT id, name FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            // Por segurança, retornamos OK mesmo que não encontre, ou erro simples
            return res.json({ message: 'Se o email existir, um link de recuperação será enviado.' });
        }

        const user = users[0];
        // Gerar token de reset (JWT) válido por 1 hora
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('JWT_SECRET missing');

        const resetToken = jwt.sign(
            { id: user.id, email: user.email, purpose: 'reset-password' },
            secret,
            { expiresIn: '1h' }
        );

        const [appUrlRow] = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key = 'app_url'");
        const baseUrl = appUrlRow[0]?.setting_value || 'https://ublochat.com.br';
        const resetLink = `${baseUrl.replace(/\/$/, '')}/reset-password?token=${resetToken}`;

        await sendEmailWithTemplate(email, 'password_recovery', { name: user.name }, { text: 'Redefinir Senha agora', url: resetLink });

        res.json({ message: 'E-mail de recuperação enviado' });

    } catch (err) {
        console.error('❌ [RECOVER] Erro:', err);
        res.status(500).json({ error: 'Erro ao processar recuperação de senha' });
    }
});

// Endpoint para resetar a senha com o token
app.post('/api/auth/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('JWT_SECRET missing');

        const decoded = jwt.verify(token, secret);
        if (decoded.purpose !== 'reset-password') {
            return res.status(400).json({ error: 'Token inválido para esta operação' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, decoded.id]);

        res.json({ message: 'Senha redefinida com sucesso!' });
    } catch (err) {
        console.error('❌ [RESET-PASSWORD] Erro:', err);
        res.status(400).json({ error: 'Link de redefinição expirado ou inválido.' });
    }
});

const cleanupTrials = async () => {
    try {
        console.log('🧹 [CRON] Verificando trials expirados...');
        // Usuarios 'Teste Grátis' com data passada -> Muda para 'Inativo' ou 'Expirado'
        // Por simplicidade, vamos apenas mudar o status ou plano se necessário
        const [result] = await pool.execute(
            "UPDATE users SET status = 'expired' WHERE plan = 'Teste Grátis' AND trial_ends_at < NOW() AND status = 'active'"
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
    const { status, plan, role, name, email } = req.body;
    try {
        await pool.execute(
            'UPDATE users SET status = ?, plan = ?, role = ?, name = ?, email = ?, updated_at = NOW() WHERE id = ?',
            [status, plan, role, name, email, req.params.id]
        );
        res.json({ message: 'OK' });
    } catch (err) {
        console.error('❌ Erro PUT /api/admin/users/:id:', err);
        res.status(500).json({ error: 'Erro ao atualizar usuário' });
    }
});

app.delete('/api/admin/users/:id', authenticateAdmin, async (req, res) => {
    try {
        await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ message: 'Usuário excluído com sucesso' });
    } catch (err) {
        console.error('❌ Erro DELETE /api/admin/users:', err);
        res.status(500).json({ error: 'Erro ao excluir usuário' });
    }
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

// Endpoint público para branding e SEO
app.get('/api/settings/public', async (req, res) => {
    try {
        const publicKeys = [
            'system_name', 'primary_color', 'logo_url', 'favicon_url',
            'seo_title', 'seo_description', 'seo_keywords'
        ];
        const placeholders = publicKeys.map(() => '?').join(',');
        const [rows] = await pool.query(
            `SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (${placeholders})`,
            publicKeys
        );

        const settings = {
            system_name: 'MyZap',
            primary_color: '#166534',
            seo_title: 'MyZap - Gestão Multi-Agente para WhatsApp',
            seo_description: 'Plataforma completa de atendimento e automação para WhatsApp'
        };

        rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });

        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar configurações públicas' });
    }
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
// --- ZEPTOMAIL INTEGRATION ---

async function sendZeptoEmail(to, subject, html) {
    try {
        const [rows] = await pool.execute('SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ("smtp_user", "smtp_pass", "smtp_from_email", "smtp_from_name")');
        const settings = {};
        rows.forEach(row => settings[row.setting_key] = row.setting_value);

        let token = settings.smtp_pass || '';
        if (!token) throw new Error('API Key/Token ZeptoMail não configurado');

        // Limpeza do token (caso o usuário tenha colado o prefixo junto)
        token = token.replace(/zoho-enczapikey\s+/i, '').trim();

        const data = {
            "from": {
                "address": settings.smtp_from_email || "no-reply@ublochat.com.br",
                "name": settings.smtp_from_name || "MyZap"
            },
            "to": [
                {
                    "email_address": {
                        "address": to,
                        "name": to.split('@')[0]
                    }
                }
            ],
            "subject": subject,
            "htmlbody": html
        };

        const config = {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Zoho-enczapikey ${token}`
            }
        };

        const url = 'https://api.zeptomail.com/v1.1/email';
        console.log(`📤 [ZEPTOMAIL REST] Enviando para: ${to}`);

        const response = await axios.post(url, data, config);
        console.log('✅ [ZEPTOMAIL REST] Sucesso:', response.data);
        return response.data;
    } catch (err) {
        // Sanitizar log para não expor tokens ou dados sensíveis do request
        const errorMsg = err.response?.data?.message || err.message || 'Erro desconhecido';
        console.error('❌ [ZEPTOMAIL ERROR]:', errorMsg);
        throw new Error(errorMsg);
    }
}

app.post('/api/admin/test-email', authenticateAdmin, async (req, res) => {
    try {
        const { email, smtp_test_email } = req.body;
        const targetEmail = email || smtp_test_email;
        if (!targetEmail) return res.status(400).json({ error: 'E-mail obrigatório' });

        await sendZeptoEmail(targetEmail, 'Teste de Configuração MyZap', '<h1>Sucesso!</h1><p>Sua integração nativa com o ZeptoMail está funcionando corretamente.</p>');
        res.json({ success: true, message: 'E-mail de teste enviado com sucesso!' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao enviar e-mail', details: err.message });
    }
});



app.post('/api/stripe/create-checkout-session', authenticateToken, async (req, res) => {
    const { planName, price, successUrl, cancelUrl } = req.body;

    try {
        console.log(`💳 [STRIPE] Iniciando checkout para plano: ${planName}, Preço: ${price}`);
        const stripeInst = await getStripe();
        if (!stripeInst) {
            console.error('❌ [STRIPE] Instância não obtida. Verifique stripe_secret_key no banco.');
            return res.status(500).json({ error: 'Stripe não configurado pelo administrador.' });
        }

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

        console.log(`✅ [STRIPE] Sessão criada: ${session.id}`);
        res.json({ url: session.url });
    } catch (err) {
        console.error('❌ [STRIPE CHECKOUT ERROR]:', err.message);
        res.status(500).json({ error: 'Erro ao criar sessão de checkout', details: err.message });
    }
});




// --- REVENUE INSIGHTS / FINANCIAL STATS ---
app.get('/api/admin/revenue-stats', authenticateAdmin, async (req, res) => {
    try {
        // 1. MRR (Monthly Recurring Revenue) - Soma dos valores dos planos de usuários ativos
        const [mrrResult] = await pool.query(`
            SELECT COALESCE(SUM(p.price), 0) as mrr
            FROM users u
            LEFT JOIN plans p ON u.plan COLLATE utf8mb4_unicode_ci = p.name COLLATE utf8mb4_unicode_ci
            WHERE u.status = 'active' AND u.plan != 'Teste Grátis'
        `);
        const mrr = parseFloat(mrrResult[0]?.mrr || 0);

        // 2. Novas assinaturas do mês atual
        const [newSubsResult] = await pool.query(`
            SELECT COUNT(*) as count
            FROM users 
            WHERE status = 'active' 
            AND plan != 'Teste Grátis'
            AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
        `);
        const newSubscriptions = parseInt(newSubsResult[0]?.count || 0);

        // 3. Total de usuários ativos pagantes
        const [activeUsersResult] = await pool.query(`
            SELECT COUNT(*) as count
            FROM users 
            WHERE status = 'active' AND plan != 'Teste Grátis'
        `);
        const activePayingUsers = parseInt(activeUsersResult[0]?.count || 0);

        // 4. Usuários que cancelaram este mês (Churn)
        const [churnsResult] = await pool.query(`
            SELECT COUNT(*) as count
            FROM users 
            WHERE status = 'inactive' 
            AND updated_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
            AND plan != 'Teste Grátis'
        `);
        const churns = parseInt(churnsResult[0]?.count || 0);

        // 5. LTV Estimado (MRR / Churn Rate) ou média simples
        const churnRate = activePayingUsers > 0 ? (churns / activePayingUsers) * 100 : 0;
        const avgMonthsRetention = churnRate > 0 ? 100 / churnRate : 12; // Default 12 meses se não houver cancelamentos
        const avgTicket = activePayingUsers > 0 ? mrr / activePayingUsers : 0;
        const ltv = avgTicket * avgMonthsRetention;

        // 6. Dados mensais para gráfico (últimos 12 meses)
        const [monthlyData] = await pool.query(`
            SELECT 
                DATE_FORMAT(u.created_at, '%Y-%m') as month,
                COALESCE(SUM(p.price), 0) as revenue,
                COUNT(*) as users
            FROM users u
            LEFT JOIN plans p ON u.plan COLLATE utf8mb4_unicode_ci = p.name COLLATE utf8mb4_unicode_ci
            WHERE u.status = 'active' 
            AND u.plan != 'Teste Grátis'
            AND u.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
            GROUP BY DATE_FORMAT(u.created_at, '%Y-%m')
            ORDER BY month ASC
        `);

        // 7. Top planos por receita
        const [topPlans] = await pool.query(`
            SELECT 
                u.plan as name,
                COUNT(*) as subscribers,
                COALESCE(SUM(p.price), 0) as revenue
            FROM users u
            LEFT JOIN plans p ON u.plan COLLATE utf8mb4_unicode_ci = p.name COLLATE utf8mb4_unicode_ci
            WHERE u.status = 'active' AND u.plan != 'Teste Grátis'
            GROUP BY u.plan
            ORDER BY revenue DESC
            LIMIT 5
        `);

        // 8. Logs recentes de pagamento (baseado em atualizações de plano)
        const [recentPayments] = await pool.query(`
            SELECT 
                u.name,
                u.plan,
                p.price,
                u.updated_at as date
            FROM users u
            LEFT JOIN plans p ON u.plan = p.name
            WHERE u.status = 'active' 
            AND u.plan != 'Teste Grátis'
            AND u.stripe_subscription_id IS NOT NULL
            ORDER BY u.updated_at DESC
            LIMIT 10
        `);

        res.json({
            mrr,
            newSubscriptions,
            activePayingUsers,
            churnRate: churnRate.toFixed(2),
            ltv: ltv.toFixed(2),
            monthlyData,
            topPlans: topPlans.map(p => ({
                name: p.name,
                subscribers: p.subscribers,
                revenue: p.revenue,
                percentage: mrr > 0 ? ((p.revenue / mrr) * 100).toFixed(1) : '0'
            })),
            recentPayments: recentPayments.map(p => ({
                name: p.name,
                plan: p.plan,
                amount: p.price || 0,
                date: p.date,
                status: 'Aprovado'
            }))
        });
    } catch (err) {
        console.error('❌ [REVENUE] Erro ao buscar estatísticas:', err);
        res.status(500).json({ error: 'Erro ao buscar estatísticas financeiras', details: err.message });
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

        // Restringir SEMPRE ao usuário logado, mesmo sendo Admin (Privacidade)
        query += ' WHERE c.user_id = ? ';
        params.push(req.user.id);

        query += ' ORDER BY lastTime DESC';

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Erro ao listar contatos' }); }
});

app.get('/api/contacts/blocked', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT c.*, 
            (SELECT content FROM messages m WHERE m.contact_id = c.id ORDER BY m.timestamp DESC LIMIT 1) as lastMessage,
            (SELECT timestamp FROM messages m WHERE m.contact_id = c.id ORDER BY m.timestamp DESC LIMIT 1) as lastTime
            FROM contacts c 
            WHERE c.user_id = ? AND c.is_blocked = 1
            ORDER BY lastTime DESC
        `, [req.user.id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao listar contatos bloqueados' });
    }
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

// Delete contact/conversation
app.delete('/api/contacts/:contactId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const contactId = req.params.contactId;

        // Delete messages first
        await pool.query("DELETE FROM messages WHERE contact_id = ? AND user_id = ?", [contactId, userId]);

        // Delete contact
        await pool.query("DELETE FROM contacts WHERE id = ? AND user_id = ?", [contactId, userId]);

        res.json({ success: true, message: 'Conversa excluída com sucesso' });
    } catch (err) {
        console.error('Erro ao excluir contato:', err);
        res.status(500).json({ error: 'Erro ao excluir contato' });
    }
});

// Block/Unblock contact
app.post('/api/contacts/:contactId/block', authenticateToken, async (req, res) => {
    try {
        const { block } = req.body;
        const userId = req.user.id;
        const contactId = req.params.contactId;

        // 1. Buscar dados do contato
        const [contacts] = await pool.query("SELECT remote_jid, instance_name FROM contacts WHERE id = ? AND user_id = ?", [contactId, userId]);
        if (contacts.length === 0) return res.status(404).json({ error: 'Contato não encontrado' });

        const { remote_jid, instance_name } = contacts[0];

        // 2. Realizar bloqueio real via Evolution se houver instância
        if (instance_name) {
            try {
                const evo = await getEvolutionService();
                if (evo) {
                    await evo.blockUnblockContact(instance_name, remote_jid, block);
                    console.log(`🚫 [BLOCK] Contato ${remote_jid} ${block ? 'bloqueado' : 'desbloqueado'} via Evolution.`);
                }
            } catch (evoErr) {
                console.warn('⚠️ Falha ao bloquear via Evolution:', evoErr.message);
            }
        }

        // 3. Atualizar status no banco
        await pool.query(
            "UPDATE contacts SET is_blocked = ? WHERE id = ? AND user_id = ?",
            [block ? 1 : 0, contactId, userId]
        );

        res.json({ success: true, is_blocked: block });
    } catch (err) { res.status(500).json({ error: 'Erro ao bloquear contato' }); }
});

app.patch('/api/contacts/:contactId/status', authenticateToken, async (req, res) => {
    try {
        const { status } = req.body;
        const contactId = req.params.contactId;
        const userId = req.user.id;

        // 1. Atualizar status
        let query = "UPDATE contacts SET status = ? WHERE id = ? AND user_id = ?";
        const params = [status, contactId, userId];

        // 2. Se fechar, remove o pause da IA (volta a responder)
        if (status === 'closed') {
            query = "UPDATE contacts SET status = ?, ai_paused = 0 WHERE id = ? AND user_id = ?";
        }

        await pool.query(query, params);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao atualizar status' });
    }
});

// Toggle AI Pause for Contact
app.post('/api/contacts/:contactId/toggle-ai', authenticateToken, async (req, res) => {
    try {
        const { paused } = req.body; // true or false
        await pool.query(
            "UPDATE contacts SET ai_paused = ? WHERE id = ? AND user_id = ?",
            [paused ? 1 : 0, req.params.contactId, req.user.id]
        );
        res.json({ success: true, ai_paused: paused });
    } catch (err) {
        console.error('Erro ao alternar IA:', err);
        res.status(500).json({ error: 'Erro ao alternar status da IA' });
    }
});


// Send audio message (Base64 from panel)
// Endpoint de áudio consolidado foi movido para baixo (linha 1454 aprox) para evitar duplicatas.


app.get('/api/messages/:contactId', authenticateToken, async (req, res) => {
    try {
        const query = "SELECT id, user_id, contact_id, instance_name, uid, key_from_me, content, type, timestamp, source, media_url, msg_status as status FROM messages WHERE contact_id = ? AND user_id = ? ORDER BY timestamp ASC";
        const params = [req.params.contactId, req.user.id];

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: 'Erro ao buscar mensagens' }); }
});







// --- ANALYTICS DASHBOARD ---
app.get('/api/analytics/dashboard', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { startDate, endDate } = req.query;

        // Default to last 30 days if not provided
        let start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
        let end = endDate ? new Date(endDate) : new Date();

        // Ensure end date includes the whole day
        end.setHours(23, 59, 59, 999);

        // Convert to Unix Timestamp (Seconds) matching INSERT logic
        const startTs = Math.floor(start.getTime() / 1000);
        const endTs = Math.floor(end.getTime() / 1000);

        if (isNaN(startTs) || isNaN(endTs)) {
            throw new Error('Invalid date range');
        }

        console.log(`📊 [ANALYTICS] Stats for ${userId}: ${start.toISOString()} to ${end.toISOString()}`);
        console.log(`📊 [ANALYTICS] TS Range (Seconds): ${startTs} to ${endTs}`);

        let totalMsgCount = 0;
        let sentMsgCount = 0;
        let contactsCount = 0;
        let daily = [];
        let hourly = [];
        let growth = 0;

        // 1. Totais Gerais
        try {
            const [totalMsg] = await pool.query("SELECT COUNT(*) as count FROM messages WHERE user_id = ? AND timestamp >= ? AND timestamp <= ?", [userId, startTs, endTs]);
            totalMsgCount = totalMsg[0]?.count || 0;
            const [sentMsg] = await pool.query("SELECT COUNT(*) as count FROM messages WHERE user_id = ? AND key_from_me = 1 AND timestamp >= ? AND timestamp <= ?", [userId, startTs, endTs]);
            sentMsgCount = sentMsg[0]?.count || 0;
        } catch (e) {
            console.error('❌ Error fetching totals:', e.message);
        }

        // Contatos
        try {
            const [contacts] = await pool.query("SELECT COUNT(*) as count FROM contacts WHERE user_id = ?", [userId]);
            contactsCount = contacts[0]?.count || 0;
        } catch (e) {
            console.error('❌ Error fetching contacts:', e.message);
        }

        // 2. Volume Diário
        try {
            // Use strict SQL safe approach, wrap timestamp
            const [dailyRes] = await pool.query(`
                SELECT 
                    DATE_FORMAT(FROM_UNIXTIME(timestamp), '%d/%m') as name, 
                    DATE(FROM_UNIXTIME(timestamp)) as day_date,
                    COUNT(*) as value 
                FROM messages 
                WHERE user_id = ? AND timestamp >= ? AND timestamp <= ?
                GROUP BY day_date, name
                ORDER BY day_date ASC
            `, [userId, startTs, endTs]);
            daily = dailyRes;
        } catch (e) {
            console.error('❌ Error fetching daily stats:', e.message);
        }

        // 3. Mapa de Calor
        try {
            const [hourlyRes] = await pool.query(`
            SELECT
            HOUR(FROM_UNIXTIME(\`timestamp\`)) as hour,
                    COUNT(*) as count
                FROM messages
                WHERE user_id = ? AND \`timestamp\` >= ? AND \`timestamp\` <= ?
                GROUP BY HOUR(FROM_UNIXTIME(\`timestamp\`))
                ORDER BY hour ASC
            `, [userId, startTs, endTs]);
            hourly = hourlyRes;
        } catch (e) {
            console.error('❌ Error fetching hourly stats:', e.message);
        }

        // 4. Distribuição e Crescimento
        const receivedCount = Math.max(0, totalMsgCount - sentMsgCount);
        const pieData = [
            { name: 'Recebidas', value: receivedCount, color: '#6366f1' }, // Indigo
            { name: 'Enviadas', value: sentMsgCount, color: '#22c55e' } // Green
        ];

        // Comparativo com período anterior
        try {
            const diffSeconds = endTs - startTs;
            const prevEndTs = startTs;
            const prevStartTs = prevEndTs - diffSeconds;

            const [prevTotal] = await pool.query("SELECT COUNT(*) as count FROM messages WHERE user_id = ? AND timestamp >= ? AND timestamp < ?", [userId, prevStartTs, prevEndTs]);
            const prevCount = prevTotal[0]?.count || 0;

            growth = prevCount > 0
                ? Math.round(((totalMsgCount - prevCount) / prevCount) * 100)
                : (totalMsgCount > 0 ? 100 : 0);
        } catch (e) {
            console.error('❌ Error fetching growth:', e.message);
        }

        res.json({
            totalMessages: totalMsgCount,
            sentMessages: sentMsgCount,
            totalContacts: contactsCount,
            weeklyVolume: daily,
            hourlyVolume: hourly,
            pieChart: pieData, // Ensure these names match Frontend exactly
            growth: growth,
            avgResponseTime: "N/A",
            debug: { startTs, endTs, userId }
        });

    } catch (err) {
        console.error('❌ [CRITICAL] Analytics Error:', err);
        res.status(500).json({ error: 'Erro crítico no analytics', details: err.message });
    }
});

// Debug endpoint for analytics troubleshooting (Restrito a Admin)
app.get('/api/analytics/debug', authenticateAdmin, async (req, res) => {
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

// --- NOVO ENDPOINT DE API (Developer Friendly) ---
app.post('/api/messages/send-text', authenticateToken, async (req, res) => {
    const { instanceName, number, text } = req.body;

    if (!instanceName || !number || !text) {
        return res.status(400).json({ error: 'Missing required fields: instanceName, number, text' });
    }

    try {
        // --- VERIFICAR LIMITE DE MENSAGENS ---
        const limit = await checkUserLimit(req.user.id, 'messages');
        if (!limit.allowed) return res.status(403).json({ error: limit.error, code: limit.code });

        // 1. Verificar se a instância pertence ao usuário
        const [instance] = await pool.execute(
            'SELECT id FROM whatsapp_accounts WHERE business_name = ? AND user_id = ?',
            [instanceName, req.user.id]
        );

        if (instance.length === 0) {
            return res.status(404).json({ error: 'Instance not found or access denied' });
        }

        // 2. Normalizar número e encontrar/criar contato
        const remoteJid = number.includes('@s.whatsapp.net') ? number : `${number}@s.whatsapp.net`;

        // Upsert Contact to ensure we have an ID for the message
        await pool.query(`
            INSERT INTO contacts (user_id, name, remote_jid, instance_name, profile_pic_url)
            VALUES (?, ?, ?, ?, '')
            ON DUPLICATE KEY UPDATE instance_name = VALUES(instance_name)
        `, [req.user.id, number, remoteJid, instanceName]);

        const [contact] = await pool.query(
            'SELECT id FROM contacts WHERE user_id = ? AND remote_jid = ?',
            [req.user.id, remoteJid]
        );
        const contactId = contact[0]?.id;

        // 3. Enviar mensagem
        const result = await sendWhatsAppMessage(instanceName, remoteJid, text, { userId: req.user.id });

        // 4. Salvar msg no banco
        const msgId = result?.key?.id || result?.id || `API-${Date.now()}`;
        const timestamp = Math.floor(Date.now() / 1000);

        await pool.query(`
            INSERT INTO messages (user_id, contact_id, instance_name, uid, key_from_me, content, type, timestamp)
            VALUES (?, ?, ?, ?, 1, ?, 'text', ?)
            ON DUPLICATE KEY UPDATE content = VALUES(content)
        `, [req.user.id, contactId, instanceName, msgId, text, timestamp]);

        console.log(`✅ [API] Mensagem enviada via API Dev: ${msgId}`);
        res.json({ success: true, messageId: msgId, status: 'SENT' });

    } catch (err) {
        console.error('❌ [API] Erro ao enviar mensagem:', err.message);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});



app.post('/api/messages/send', authenticateToken, async (req, res) => {
    const { contactId, content } = req.body;
    try {
        // --- VERIFICAR LIMITE DE MENSAGENS ---
        const limit = await checkUserLimit(req.user.id, 'messages');
        if (!limit.allowed) return res.status(403).json({ error: limit.error, code: limit.code });

        // 1. Achar contato e pegar instance_name

        // 1. Achar contato e pegar instance_name
        const [contacts] = await pool.query("SELECT remote_jid, instance_name FROM contacts WHERE id = ? AND user_id = ?", [contactId, req.user.id]);
        if (contacts.length === 0) return res.status(404).json({ error: 'Contato não encontrado' });

        const remoteJid = contacts[0].remote_jid;
        let instanceName = contacts[0].instance_name;

        // Se contato não tem instance_name, pegar da whitelist do usuário
        if (!instanceName) {
            const [user] = await pool.query("SELECT instance_whitelist FROM users WHERE id = ?", [req.user.id]);
            if (user.length > 0 && user[0].instance_whitelist) {
                const whitelist = JSON.parse(user[0].instance_whitelist || '[]');
                if (whitelist.length > 0) {
                    instanceName = whitelist[0];
                }
            }
        }

        if (!instanceName) {
            return res.status(400).json({ error: 'Nenhuma instância configurada para este contato' });
        }

        // 2. Enviar via Evolution
        const result = await sendWhatsAppMessage(instanceName, remoteJid, content);

        // 3. Salvar no banco MANUALMENTE (Para garantir que apareça no chat)
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

// --- ENVIO DE MÍDIA (Imagem, Vídeo, Documento) ---
app.post('/api/messages/send-media', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        // --- VERIFICAR LIMITE DE MENSAGENS ---
        const limit = await checkUserLimit(req.user.id, 'messages');
        if (!limit.allowed) return res.status(403).json({ error: limit.error, code: limit.code });

        const { contactId } = req.body;

        const file = req.file;

        if (!contactId || !file) {
            return res.status(400).json({ error: 'contactId e arquivo são obrigatórios' });
        }

        console.log(`📸 [MEDIA] Enviando arquivo: ${file.originalname} (${file.mimetype})`);

        // Buscar contato e instância
        const [contacts] = await pool.query('SELECT remote_jid, instance_name FROM contacts WHERE id = ? AND user_id = ?', [contactId, req.user.id]);
        if (contacts.length === 0) return res.status(404).json({ error: 'Contato não encontrado' });

        const { remote_jid: remoteJid, instance_name: instanceName } = contacts[0];
        if (!instanceName) return res.status(400).json({ error: 'Nenhuma instância configurada para este contato' });

        // Detectar tipo de mídia
        const mimeType = file.mimetype;
        let mediaType = 'document';
        if (mimeType.startsWith('image/')) mediaType = 'image';
        else if (mimeType.startsWith('video/')) mediaType = 'video';
        else if (mimeType.startsWith('audio/')) mediaType = 'audio';

        // URL pública do arquivo (para o banco e para o envio)
        const publicUrl = await getAppUrl(req);
        // Use /api/uploads para garantir que passe pelo roteamento correto (mesmo do Flow Builder)
        const fileUrl = `${publicUrl}/api/uploads/${file.filename}`;

        console.log(`📸 [MEDIA] Enviando para Evolution: ${remoteJid} via URL: ${fileUrl}`);

        // Enviar via Evolution API usando URL (mais estável que Base64)
        const result = await sendWhatsAppMessage(instanceName, remoteJid, '', {
            mediaUrl: fileUrl,
            mediaType: mediaType,
            fileName: file.originalname
        });
        console.log(`[MEDIA] Resposta da Evolution:`, JSON.stringify(result));

        // Salvar mensagem no banco
        const msgId = result?.key?.id || result?.id || `MEDIA-${Date.now()}`;
        const timestamp = Math.floor(Date.now() / 1000);

        await pool.query(`
            INSERT INTO messages (user_id, contact_id, instance_name, uid, key_from_me, content, type, timestamp, media_url)
            VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE content = VALUES(content)
        `, [req.user.id, contactId, instanceName, msgId, file.originalname, mediaType, timestamp, fileUrl]);

        console.log(`✅ [MEDIA] Enviado com sucesso: ${msgId}`);
        res.json({ success: true, messageId: msgId, mediaUrl: fileUrl });
    } catch (err) {
        console.error('❌ [MEDIA CRITICAL ERROR] Full Stack:', err.stack);
        console.error('❌ [MEDIA] Details:', {
            message: err.message,
            file: req.file ? req.file.filename : 'no-file',
            contactId: req.body.contactId
        });
        res.status(500).json({ error: 'Erro ao enviar mídia', details: err.message, stack: err.stack });
    }
});

// --- ENVIO DE ÁUDIO (Gravação do microfone) ---
app.post('/api/messages/send-audio', authenticateToken, async (req, res) => {
    try {
        // --- VERIFICAR LIMITE DE MENSAGENS ---
        const limit = await checkUserLimit(req.user.id, 'messages');
        if (!limit.allowed) return res.status(403).json({ error: limit.error, code: limit.code });

        const { contactId, audioBase64 } = req.body;


        if (!contactId || !audioBase64) {
            return res.status(400).json({ error: 'contactId e audioBase64 são obrigatórios' });
        }

        console.log(`🎤 [AUDIO] Processando gravação de áudio para contato ${contactId}`);

        // Buscar contato e instância
        const [contacts] = await pool.query('SELECT remote_jid, instance_name FROM contacts WHERE id = ? AND user_id = ?', [contactId, req.user.id]);
        if (contacts.length === 0) return res.status(404).json({ error: 'Contato não encontrado' });

        const { remote_jid: remoteJid, instance_name: instanceName } = contacts[0];
        if (!instanceName) return res.status(400).json({ error: 'Nenhuma instância configurada para este contato' });

        // Salvar áudio como arquivo temporário
        const isOgg = audioBase64.includes('audio/ogg');
        const audioBuffer = Buffer.from(audioBase64.split(',')[1] || audioBase64, 'base64');
        const audioFilename = `audio-${Date.now()}.${isOgg ? 'ogg' : 'webm'}`;
        const audioPath = path.join(uploadDir, audioFilename);
        fs.writeFileSync(audioPath, audioBuffer);

        // URL pública do áudio
        const publicUrl = await getAppUrl(req);
        const audioUrl = `${publicUrl}/api/uploads/${audioFilename}`;

        console.log(`🎤 [AUDIO] Enviando áudio via URL: ${audioUrl}`);

        // Enviar como mensagem de áudio PTT (Push-to-Talk) usando URL
        let result;
        const [instanceRows] = await pool.query("SELECT provider FROM whatsapp_accounts WHERE business_name = ?", [instanceName]);
        const provider = instanceRows[0]?.provider || 'evolution';

        if (provider === 'evolution') {
            const evo = await getEvolutionService();
            result = await evo.sendAudio(instanceName, remoteJid, audioUrl);
        } else {
            result = await sendWhatsAppMessage(instanceName, remoteJid, 'Áudio', {
                mediaUrl: audioUrl,
                mediaType: 'audio'
            });
        }
        console.log(`[AUDIO] Resposta de envio:`, JSON.stringify(result));

        // Salvar mensagem no banco
        const msgId = result?.key?.id || result?.id || `AUDIO-${Date.now()}`;
        const timestamp = Math.floor(Date.now() / 1000);

        await pool.query(`
            INSERT INTO messages (user_id, contact_id, instance_name, uid, key_from_me, content, type, timestamp, media_url)
            VALUES (?, ?, ?, ?, 1, 'Áudio', 'audio', ?, ?)
            ON DUPLICATE KEY UPDATE content = VALUES(content)
        `, [req.user.id, contactId, instanceName, msgId, timestamp, audioUrl]);

        console.log(`✅ [AUDIO] Enviado com sucesso: ${msgId}`);
        res.json({ success: true, messageId: msgId, audioUrl });
    } catch (err) {
        console.error('❌ [AUDIO CRITICAL ERROR] Full Stack:', err.stack);
        res.status(500).json({ error: 'Erro ao enviar áudio', details: err.message, stack: err.stack });
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
        const limit = await checkUserLimit(req.user.id, 'flows');
        if (!limit.allowed) {
            return res.status(403).json(limit);
        }

        // Criar conteúdo inicial com um nó de Gatilho (Trigger)
        const initialNodes = [{
            id: `trigger_${Date.now()}`,
            type: 'trigger',
            position: { x: 250, y: 250 },
            data: { label: 'Início do Fluxo', type: 'keyword', keyword: '' }
        }];
        const initialContent = JSON.stringify({ nodes: initialNodes, edges: [], viewport: { x: 0, y: 0, zoom: 1 } });

        // Usando .query em vez de .execute para maior compatibilidade em alguns ambientes
        await pool.query(
            'INSERT INTO flows (id, user_id, name, content, status) VALUES (?, ?, ?, ?, ?)',
            [id, req.user.id, name, initialContent, 'paused']
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

// Endpoint para upload de arquivos no Flow Builder
app.post('/api/flows/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo enviado' });
        }

        // Buscar URL base da aplicação
        const [rows] = await pool.query("SELECT setting_value FROM system_settings WHERE setting_key = 'app_url'");
        const appUrl = rows[0]?.setting_value || 'https://ublochat.com.br';

        const fileUrl = `${appUrl}/api/uploads/${req.file.filename}`;

        res.json({
            url: fileUrl,
            filename: req.file.filename,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype
        });
    } catch (err) {
        console.error('❌ Erro no upload do Flow:', err);
        res.status(500).json({ error: 'Erro interno no servidor' });
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
        await pool.query('UPDATE flows SET status = ? WHERE id = ? AND user_id = ?', [newStatus, req.params.id, req.user.id]);
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



// --- INTEGRAÇÃO HÍBRIDA: ENVIO DE MENSAGENS ---
// --- INTEGRAÇÃO HÍBRIDA: ENVIO DE MENSAGENS ---
const sendWhatsAppMessage = async (instanceName, to, content, options = {}) => {
    try {
        // Checking limits if userId is provided
        if (options.userId) {
            const limit = await checkUserLimit(options.userId, 'messages');
            if (!limit.allowed) {
                console.error(`🚫 [LIMIT] Message limit reached for user ${options.userId}`);
                throw new Error('Message limit reached');
            }
        }

        // Buscar instância e provedor no banco
        const [rows] = await pool.execute(
            "SELECT id, phone_number_id, access_token, provider FROM whatsapp_accounts WHERE business_name = ?",
            [instanceName]
        );

        const instance = rows[0];
        const provider = instance ? (instance.provider || 'evolution') : 'evolution';

        if (provider === 'official') {
            // --- CAMINHO API OFICIAL (META) ---
            console.log(`📤 [META API] Enviando para ${to} via ${instanceName}`);

            if (options.mediaUrl) {
                const type = options.mediaType || 'image'; // Default to image if not specified
                return await WhatsAppCloudService.sendMedia(instance, to, type, options.mediaUrl, content);
            } else {
                return await WhatsAppCloudService.sendText(instance, to, content);
            }

        } else {
            // --- CAMINHO LEGADO (EVOLUTION API) ---
            const evo = await getEvolutionService();
            if (!evo) throw new Error('Evolution Service unavailable');

            if (options.mediaUrl) {
                return await evo.sendMedia(instanceName, to, options.mediaType, options.mediaUrl, content, options.fileName);
            } else {
                return await evo.sendText(instanceName, to, content);
            }
        }
    } catch (err) {
        console.error(`❌ [SEND ERROR] Falha ao enviar via ${instanceName}:`, err.message);
        throw err;
    }
};

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
    // Load contact variables for context
    const [contactRows] = await pool.query("SELECT variables FROM contacts WHERE id = ?", [contactId]);
    let contactVars = contactRows[0]?.variables || {};
    if (typeof contactVars === 'string') {
        try { contactVars = JSON.parse(contactVars); } catch (e) { contactVars = {}; }
    }

    const context = {
        userId,
        remoteJid,
        instanceName,
        contactId,
        variables: {
            ...contactVars,
            contact: { ...contactVars, phone: remoteJid.replace('@s.whatsapp.net', '') },
            message: messageContent,
            last_input: messageContent
        },
        visitedNodes: new Set(),
        flowId: flowData.flow.id
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

            case 'question':
                await processQuestionNode(node, context);
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
            } else {
                console.log(`⚠️ [FLOW] Next node ${nextEdge.target} not found for edge from ${node.id}. Flow might be corrupted or edited.`);
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
    const result = await sendWhatsAppMessage(context.instanceName, context.remoteJid, message, { userId: context.userId });

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
    console.log(`⏰ [FLOW] Waiting ${delaySeconds} seconds for ${context.remoteJid}...`);
    await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
}

async function processConditionNode(node, flowContent, context) {
    const rule = node.data.rule || '';
    const result = evaluateCondition(rule, context);

    // Find edges for this node
    const edges = flowContent.edges.filter(e => e.source === node.id);

    // We prefer using sourceHandle if available for precision
    let nextEdge;
    if (result) {
        nextEdge = edges.find(e => e.sourceHandle === 'true') || edges[0];
    } else {
        nextEdge = edges.find(e => e.sourceHandle === 'false') || edges[1];
    }

    return nextEdge ? nextEdge.target : null;
}

async function processQuestionNode(node, context) {
    const question = replaceVariables(node.data.question || '', context);
    await sendWhatsAppMessage(context.instanceName, context.remoteJid, question, { userId: context.userId });

    // Sanatizar nome da variável (remover {{ }} caso o usuário tenha colocado)
    const varName = sanitizeVariableName(node.data.variable || 'user_input');

    // Store pending input state
    await pool.query(`
        INSERT INTO flow_state (user_id, remote_jid, variable_name, flow_id, current_node_id, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE 
            variable_name = VALUES(variable_name), 
            flow_id = VALUES(flow_id),
            current_node_id = VALUES(current_node_id),
            created_at = NOW()
    `, [context.userId, context.remoteJid, varName, context.flowId, node.id]);
}

async function processSetVariableNode(node, context) {
    const rawName = node.data.variableName || 'var';
    const name = sanitizeVariableName(rawName);
    const value = replaceVariables(node.data.value || '', context);
    context.variables[name] = value;

    console.log(`📝 [FLOW] Set ${name} = ${value}`);

    // Persistir no banco de dados (contacts)
    try {
        const jid = context.remoteJid;
        const isObj = typeof value === 'object' && value !== null;
        const query = isObj
            ? "UPDATE contacts SET variables = JSON_SET(COALESCE(variables, '{}'), ?, CAST(? AS JSON)) WHERE remote_jid = ? AND user_id = ?"
            : "UPDATE contacts SET variables = JSON_SET(COALESCE(variables, '{}'), ?, ?) WHERE remote_jid = ? AND user_id = ?";

        await pool.query(query, [`$.${name}`, isObj ? JSON.stringify(value) : value, jid, context.userId]);
    } catch (err) {
        console.error('❌ [FLOW] Error saving variable to DB:', err.message);
    }
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
    await sendWhatsAppMessage(context.instanceName, context.remoteJid, message, { userId: context.userId });
    console.log(`🤝 [FLOW] Handoff to department: ${node.data.department}`);
}

async function processAiAgentNode(node, context) {
    const [configRows] = await pool.query(
        "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('openai_key', 'openai_model', 'google_key', 'google_model')"
    );
    const config = {};
    configRows.forEach(r => config[r.setting_key] = r.setting_value);

    const prompt = replaceVariables(node.data.prompt || '', context);
    const userMessage = context.variables.last_input || '';
    const selectedModel = node.data.model || config.openai_model || config.google_model || 'gpt-3.5-turbo';

    let aiResponse = '';

    try {
        if (config.openai_key && (selectedModel.startsWith('gpt-') || !config.google_key)) {
            console.log(`🤖 [FLOW] AI Agent: Usando OpenAI (${selectedModel})...`);
            const { default: OpenAI } = await import('openai');
            const openai = new OpenAI({ apiKey: config.openai_key });
            const completion = await openai.chat.completions.create({
                messages: [
                    { role: "system", content: prompt || "Você é um assistente útil." },
                    { role: "user", content: userMessage }
                ],
                model: selectedModel,
            });
            aiResponse = completion.choices[0].message.content;
        } else if (config.google_key) {
            console.log(`🤖 [FLOW] AI Agent: Usando Google Gemini (${selectedModel})...`);
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(config.google_key);
            const model = genAI.getGenerativeModel({ model: selectedModel });
            const result = await model.generateContent(`${prompt}\n\nUsuário: ${userMessage}`);
            aiResponse = result.response.text();
        } else {
            console.log(`⚠️ [FLOW] AI Agent: Nenhuma chave de API configurada`);
            return;
        }

        if (aiResponse) {
            await sendWhatsAppMessage(context.instanceName, context.remoteJid, aiResponse, { userId: context.userId });
            context.variables.ai_response = aiResponse;
            console.log(`🤖 [FLOW] AI Agent: Resposta enviada (${aiResponse.slice(0, 30)}...)`);
        }
    } catch (err) {
        console.error('❌ [FLOW] AI Agent Node Error:', err.message);
        await sendWhatsAppMessage(context.instanceName, context.remoteJid, "Desculpe, ocorreu um erro ao processar sua solicitação com IA.", { userId: context.userId });
    }
}

async function processApiNode(node, context) {
    const url = replaceVariables(node.data.url || '', context);
    const method = node.data.method || 'GET';
    const bodyRaw = node.data.body || '{}';
    const body = replaceVariables(bodyRaw, context);

    // Processar Headers Customizados
    const customHeaders = {};
    if (Array.isArray(node.data.headers)) {
        node.data.headers.forEach(h => {
            if (h.key && h.value) {
                customHeaders[replaceVariables(h.key, context)] = replaceVariables(h.value, context);
            }
        });
    }

    console.log(`🌐 [FLOW] API Call: ${method} ${url}`);

    try {
        const response = await axios({
            url,
            method,
            data: ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) ? (typeof body === 'string' && body.trim().startsWith('{') ? JSON.parse(body) : body) : undefined,
            headers: {
                'Content-Type': 'application/json',
                ...customHeaders
            },
            timeout: 10000 // 10s timeout
        });

        const data = response.data;
        context.variables.api_response = data; // Objeto bruto

        console.log(`✅ [FLOW] API Success (${response.status})`);

        // Persistir a resposta inteira no banco para permitir uso direto ({{api_response.campo}})
        try {
            const jid = context.remoteJid;
            await pool.query(
                "UPDATE contacts SET variables = JSON_SET(COALESCE(variables, '{}'), '$.api_response', CAST(? AS JSON)) WHERE remote_jid = ? AND user_id = ?",
                [JSON.stringify(data), jid, context.userId]
            );
            console.log(`💾 [FLOW] Full api_response persisted for ${jid}`);
        } catch (dbErr) {
            console.error('❌ [FLOW] Error persisting full api_response:', dbErr.message);
        }

        // Processar Mapeamento de Resposta Manual
        if (Array.isArray(node.data.responseMapping)) {
            for (const mapping of node.data.responseMapping) {
                if (mapping.jsonPath && mapping.variableName) {
                    // Limpar o prefixo 'api_response.' se o usuário digitou por engano
                    let cleanPath = mapping.jsonPath.trim();
                    if (cleanPath.startsWith('api_response.')) {
                        cleanPath = cleanPath.replace('api_response.', '');
                    }

                    const parts = cleanPath.split('.');
                    let val = data;
                    for (const part of parts) {
                        if (val === null || val === undefined) break;
                        val = val[part];
                    }

                    if (val !== undefined) {
                        const varName = sanitizeVariableName(mapping.variableName);
                        context.variables[varName] = val;
                        console.log(`📌 [FLOW] Mapped ${cleanPath} -> ${varName} = ${val}`);

                        // Persistir no banco de dados para o contato
                        try {
                            const jid = context.remoteJid;
                            const isObj = typeof val === 'object' && val !== null;
                            const query = isObj
                                ? "UPDATE contacts SET variables = JSON_SET(COALESCE(variables, '{}'), ?, CAST(? AS JSON)) WHERE remote_jid = ? AND user_id = ?"
                                : "UPDATE contacts SET variables = JSON_SET(COALESCE(variables, '{}'), ?, ?) WHERE remote_jid = ? AND user_id = ?";

                            await pool.query(query, [`$.${varName}`, isObj ? JSON.stringify(val) : val, jid, context.userId]);
                            console.log(`💾 [FLOW] Variable ${varName} persisted for ${jid}`);
                        } catch (dbErr) {
                            console.error('❌ [FLOW] Error persisting variable:', dbErr.message);
                        }
                    }
                }
            }
        }
    } catch (err) {
        const errorMsg = err.response?.data ? JSON.stringify(err.response.data) : err.message;
        console.error(`❌ [FLOW] API Error: ${err.message}`, errorMsg);
        context.variables.api_response = { error: err.message, details: err.response?.data };
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
        await sendWhatsAppMessage(context.instanceName, context.remoteJid, errorMsg, { userId: context.userId });
        return false;
    }
    return true;
}

async function processAbSplitNode(node, flowContent, context) {
    const variantA = parseInt(node.data.variantA) || 50;
    const random = Math.random() * 100;

    const edges = flowContent.edges.filter(e => e.source === node.id);
    const result = random < variantA;

    let nextEdge;
    if (result) {
        nextEdge = edges.find(e => e.sourceHandle === 'a') || edges[0];
    } else {
        nextEdge = edges.find(e => e.sourceHandle === 'b') || edges.find(e => e.sourceHandle === 'false') || edges[1];
    }

    return nextEdge ? nextEdge.target : null;
}

async function processSwitchNode(node, flowContent, context) {
    const variable = context.variables[node.data.variable] || context.variables.last_input || '';
    const cases = node.data.cases || [];

    const edges = flowContent.edges.filter(e => e.source === node.id);
    const varLower = variable.toLowerCase();

    // Check cases
    for (let i = 0; i < cases.length; i++) {
        if (varLower.includes(cases[i].toLowerCase())) {
            const nextEdge = edges.find(e => e.sourceHandle === `case-${i}`);
            if (nextEdge) return nextEdge.target;
            // Fallback to index if sourceHandle not present
            if (edges[i]) return edges[i].target;
        }
    }

    // Default case
    const defaultEdge = edges.find(e => e.sourceHandle === 'default');
    if (defaultEdge) return defaultEdge.target;

    // Fallback to last edge if more edges than cases
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
        const result = await sendWhatsAppMessage(context.instanceName, context.remoteJid, caption, {
            mediaUrl: mediaUrl,
            mediaType: mediaType,
            userId: context.userId
        });

        // Save message to database with source='flow'
        try {
            const msgId = result?.key?.id || result?.id || `FLOW-MEDIA-${Date.now()}`;
            await pool.query(`
                INSERT INTO messages (user_id, contact_id, instance_name, uid, key_from_me, content, type, timestamp, media_url, source)
                VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, 'flow')
            `, [context.userId, context.contactId, context.instanceName, msgId, caption || `[Mídia: ${mediaType}]`, mediaType, Math.floor(Date.now() / 1000), mediaUrl]);
        } catch (dbErr) {
            console.error('❌ [FLOW] Error saving flow media message:', dbErr.message);
        }

        console.log(`📷 [FLOW] Media sent: ${mediaType}`);
    } catch (err) {
        console.error('❌ [FLOW] Media Node Error:', err.message);
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
            // Check Limits
            const limit = await checkUserLimit(context.userId, 'messages');
            if (!limit.allowed) {
                console.log(`🚫 [FLOW] Message limit reached for user ${context.userId}`);
                return;
            }
            await evo._request(`/message/sendButtons/${context.instanceName}`, 'POST', {
                number,
                title: 'Escolha uma opção',
                description: body,
                buttons: options.slice(0, 3).map((opt, i) => ({ buttonId: `btn_${i}`, buttonText: { displayText: opt } }))
            });
        } else {
            // Fallback to text with numbered options
            const optionsText = options.map((opt, i) => `${i + 1}. ${opt}`).join('\n');
            await sendWhatsAppMessage(context.instanceName, context.remoteJid, `${body}\n\n${optionsText}`, context.userId);
        }

        console.log(`🎛️ [FLOW] Interactive message sent`);
    } catch (err) {
        console.error('Interactive Node Error:', err);
    }
}

// ===== HELPER FUNCTIONS =====

// Auxiliar para sanitizar nomes de variáveis digitados pelo usuário
function sanitizeVariableName(name) {
    if (!name || typeof name !== 'string') return 'var';
    // Remove {{, }}, espaços e garante que não comece com ponto
    return name.replace(/\{\{|\}\}/g, '').trim().replace(/^\./, '');
}

function replaceVariables(text, context) {
    if (!text || typeof text !== 'string') return text;

    // Regex melhorada: suporte a espaços internos e caminhos com pontos/hífens
    return text.replace(/\{\{\s*([\w\-\.]+)\s*\}\}/g, (match, path) => {
        const parts = path.split('.');
        let value = context.variables;

        for (const part of parts) {
            if (value === null || value === undefined) break;

            // Tenta match exato primeiro
            if (value[part] !== undefined) {
                value = value[part];
            } else {
                // Tenta busca case-insensitive para maior flexibilidade
                const keys = Object.keys(value);
                const foundKey = keys.find(k => k.toLowerCase() === part.toLowerCase());
                if (foundKey) {
                    value = value[foundKey];
                } else {
                    value = undefined;
                    break;
                }
            }
        }

        // Log de depuração para rastrear substituições
        if (value !== undefined) {
            console.log(`🔍 [VAR] Replaced {{${path}}} with value of type ${typeof value}`);
        } else {
            console.log(`⚠️ [VAR] Variable {{${path}}} NOT FOUND in context`);
        }

        if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value);
        }

        // Retornar vazio se não encontrado, para evitar que o usuário veja as chaves brutas
        return value !== undefined ? String(value) : "";
    });
}

function evaluateCondition(rule, context) {
    try {
        // Suporte para caminhos aninhados (ex: api_response.city == 'SP')
        const match = rule.match(/([\w\-\.]+)\s*(==|!=|>=|<=|>|<|contains)\s*['"]?(.+?)['"]?\s*$/);
        if (!match) return false;

        const [, path, operator, expectedValue] = match;

        const parts = path.split('.');
        let val = context.variables;
        for (const part of parts) {
            if (val === null || val === undefined) break;
            val = val[part];
        }

        const actual = String(val || '').toLowerCase().trim();
        const expected = String(expectedValue || '').toLowerCase().trim();

        switch (operator) {
            case '==': return actual === expected;
            case '!=': return actual !== expected;
            case 'contains': return actual.includes(expected);
            case '>': return parseFloat(actual) > parseFloat(expected);
            case '<': return parseFloat(actual) < parseFloat(expected);
            case '>=': return parseFloat(actual) >= parseFloat(expected);
            case '<=': return parseFloat(actual) <= parseFloat(expected);
            default: return false;
        }
    } catch (err) {
        console.error('❌ [FLOW] Condition evaluation error:', err.message);
        return false;
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

            const [userStatusRow] = await pool.query("SELECT status, role FROM users WHERE id = ?", [userId]);
            if (userStatusRow.length > 0) {
                const user = userStatusRow[0];
                const isBlocked = ['inactive', 'suspended', 'expired'].includes(user.status);
                if (isBlocked && user.role !== 'admin') {
                    logDebug(`🚫 [SUBSCRIPTION] BLOQUEIO: Usuário ${userId} está com status ${user.status}. Resposta ignorada.`);
                    return res.status(200).send('OK');
                }
            }


            const remoteJid = msg.key.remoteJid;
            const fromMe = msg.key.fromMe ? 1 : 0;
            const pushName = msg.pushName || 'Desconhecido';

            // Conteúdo e Tipo de Mensagem
            let content = '';
            let type = 'text';
            let mediaUrl = null;

            // Helper para extrair mídia de estruturas aninhadas (Evolution v2)
            const getMediaData = (m) => {
                if (!m) return null;
                if (m.imageMessage) return { type: 'image', media: m.imageMessage, content: m.imageMessage.caption || '' };
                if (m.videoMessage) return { type: 'video', media: m.videoMessage, content: m.videoMessage.caption || '' };
                if (m.audioMessage) return { type: 'audio', media: m.audioMessage, content: '' };
                if (m.documentMessage) return { type: 'document', media: m.documentMessage, content: m.documentMessage.title || m.documentMessage.caption || '' };
                if (m.stickerMessage) return { type: 'sticker', media: m.stickerMessage, content: '' };

                // Recursão para wrappers (View Once, Ephemeral, etc)
                const wrapper = m.viewOnceMessage || m.viewOnceMessageV2 || m.ephemeralMessage || m.documentWithCaptionMessage;
                if (wrapper?.message) return getMediaData(wrapper.message);

                return null;
            };

            const mediaData = getMediaData(msg.message);

            if (mediaData) {
                type = mediaData.type;
                content = mediaData.content;
                mediaUrl = mediaData.media.url || mediaData.media.directPath;
                logDebug(`🎞️ Mídia detectada (${type}): ${mediaUrl ? mediaUrl.substring(0, 50) : 'Sem URL'}`);
            } else if (msg.message?.conversation) {
                content = msg.message.conversation;
                type = 'text';
            } else if (msg.message?.extendedTextMessage?.text) {
                content = msg.message.extendedTextMessage.text;
                type = 'text';
            } else if (msg.message?.buttonsResponseMessage) {
                content = msg.message.buttonsResponseMessage.selectedButtonId || msg.message.buttonsResponseMessage.stubType;
                type = 'text';
            } else if (msg.message?.listResponseMessage) {
                content = msg.message.listResponseMessage.title || msg.message.listResponseMessage.singleSelectReply?.selectedRowId;
                type = 'text';
            } else if (msg.message?.templateButtonReplyMessage) {
                content = msg.message.templateButtonReplyMessage.selectedId;
                type = 'text';
            } else {
                content = '[Mensagem não suportada ou vazia]';
                type = 'text';
            }

            if (remoteJid !== 'status@broadcast') {
                // 2. Verificação Instantânea de Bloqueio (ANIMAL)
                const [blockCheck] = await pool.query("SELECT is_blocked FROM contacts WHERE user_id = ? AND remote_jid = ?", [userId, remoteJid]);
                if (blockCheck.length > 0 && blockCheck[0].is_blocked) {
                    logDebug(`🚫 [BLOCK] BLOQUEIO REAL: Contato ${remoteJid} ignorado completamente.`);
                    return res.status(200).send('OK');
                }

                // 3. Contato (Sempre força 'open' se for mensagem recebida)
                logDebug(`📇 Gravando contato: ${remoteJid}`);
                const contactName = fromMe ? null : pushName;
                await pool.query(`
                        INSERT INTO contacts (user_id, remote_jid, name, instance_name, status, unread_count) 
                        VALUES (?, ?, ?, ?, 'open', IF(? = 0, 1, 0)) 
                        ON DUPLICATE KEY UPDATE 
                            name = COALESCE(?, name),
                            instance_name = COALESCE(instance_name, VALUES(instance_name)),
                            status = IF(? = 0, 'open', status),
                            unread_count = IF(? = 0, unread_count + 1, unread_count)
                    `, [userId, remoteJid, contactName || (remoteJid ? remoteJid.split('@')[0] : 'Desconhecido'), instance, fromMe, contactName, fromMe, fromMe]);

                // Obter ID do contato (indiferente se é novo ou antigo)
                const [cRows] = await pool.query("SELECT id FROM contacts WHERE user_id = ? AND remote_jid = ?", [userId, remoteJid]);
                const contactId = cRows[0]?.id;

                if (!contactId) {
                    console.error(`❌ [WEBHOOK] CRÍTICO: Contact ID não encontrado para ${remoteJid} (User: ${userId})`);
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

                // ======= AI AUTO-RESPONSE =======
                if (!fromMe) {
                    try {
                        // Check if AI is active
                        const [aiSettingsRows] = await pool.query(
                            "SELECT setting_value FROM system_settings WHERE setting_key = 'ai_active'"
                        );

                        const aiActive = aiSettingsRows.length > 0 && (aiSettingsRows[0].setting_value === 'true' || aiSettingsRows[0].setting_value === '1');

                        if (aiActive) {
                            // Verify if AI is paused for this contact
                            const [cSettings] = await pool.query("SELECT ai_paused FROM contacts WHERE id = ?", [contactId]);
                            if (cSettings.length > 0 && cSettings[0].ai_paused) {
                                console.log(`🤖 [AI] Pausada para contato ${contactId}. Ignorando.`);
                            } else {
                                console.log(`🤖 [WEBHOOK] IA Ativa para User ${userId}. Processando resposta...`);

                                // Send typing indicator
                                const evo = await getEvolutionService();
                                if (evo) {
                                    // await evo.sendTyping(instance, remoteJid); // Optional

                                    // Fetch AI config
                                    const [configRows] = await pool.query(
                                        "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('openai_key', 'openai_model', 'google_key', 'google_model', 'system_prompt', 'temperature', 'max_tokens')"
                                    );
                                    const config = {};
                                    configRows.forEach(r => config[r.setting_key] = r.setting_value);

                                    let responseText = '';

                                    // Call OpenAI or Google logic here (Simplified for now - placeholders)
                                    // Ideally we should have a helper function `generateAIResponse(content, config)`

                                    // Placeholder response logic:
                                    // responseText = await generateAIResponse(content, config);

                                    // For now, let's just log and skip other bots to prove exclusivity logic
                                    // To actually generate response, we need to import OpenAI/Google libraries or use fetch.
                                    // Assuming we'll implement `generateAIResponse` or similar helper.

                                    // Implement actual AI call later or inline if libraries available.
                                    // Let's try to do a basic fetch implementation if possible, or just skip for now and confirm logic.
                                    // But user asked for "responder automaticamente". So I should implement the call.

                                    if (config.openai_key && config.openai_key.startsWith('sk-')) {
                                        console.log(`🤖 [AI] Usando OpenAI...`);
                                        const { default: OpenAI } = await import('openai');
                                        const openai = new OpenAI({ apiKey: config.openai_key });
                                        const completion = await openai.chat.completions.create({
                                            messages: [
                                                { role: "system", content: config.system_prompt || "You are a helpful assistant." },
                                                { role: "user", content: content }
                                            ],
                                            model: config.openai_model || "gpt-3.5-turbo",
                                            temperature: parseFloat(config.temperature) || 0.7,
                                            max_tokens: parseInt(config.max_tokens) || 500,
                                        });
                                        responseText = completion.choices[0].message.content;
                                        console.log(`🤖 [AI] Resposta da OpenAI gerada: ${responseText.slice(0, 30)}...`);
                                    } else if (config.google_key) {
                                        console.log(`🤖 [AI] Usando Google Gemini...`);
                                        const { GoogleGenerativeAI } = await import('@google/generative-ai');
                                        const genAI = new GoogleGenerativeAI(config.google_key);
                                        const model = genAI.getGenerativeModel({
                                            model: config.google_model || "gemini-pro",
                                            systemInstruction: config.system_prompt
                                        });
                                        const result = await model.generateContent(content);
                                        responseText = result.response.text();
                                        console.log(`🤖 [AI] Resposta do Gemini gerada: ${responseText.slice(0, 30)}...`);
                                    }

                                    if (responseText) {
                                        await sendWhatsAppMessage(instance, remoteJid, responseText);

                                        // Log AI response
                                        const aiMsgId = `AI-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                                        await pool.query(`
                                        INSERT INTO messages (user_id, contact_id, instance_name, uid, key_from_me, content, type, timestamp, source)
                                        VALUES (?, ?, ?, ?, 1, ?, 'text', ?, 'ai')
                                    `, [userId, contactId, instance, aiMsgId, responseText, Math.floor(Date.now() / 1000)]);

                                        // STOP HERE (Exclusive)
                                        return res.status(200).send('OK');
                                    }
                                }
                            } // End of AI Response generation
                        } // End of AI Active Check
                    } catch (aiErr) {
                        console.error(`❌ [AI WEBHOOK] Erro: ${aiErr.message}`);
                    }
                }

                // ======= CHATBOT POR PALAVRAS-CHAVE =======
                if (!fromMe) {
                    try {
                        // Buscar todos os chatbots ativos do usuário para esta instância
                        const [chatbotRows] = await pool.query(
                            "SELECT id FROM keyword_chatbot WHERE user_id = ? AND (instance_name IS NULL OR instance_name = ?) AND is_active = 1",
                            [userId, instance]
                        );

                        if (chatbotRows.length > 0) {
                            let matchedGlobal = false;
                            const msgLower = content.toLowerCase();

                            for (const bot of chatbotRows) {
                                if (matchedGlobal) break;

                                const [rules] = await pool.query(
                                    "SELECT * FROM keyword_chatbot_rules WHERE chatbot_id = ? ORDER BY response_order ASC",
                                    [bot.id]
                                );

                                for (const rule of rules) {
                                    if (matchedGlobal) break;
                                    const keyword = (rule.keyword || '').toLowerCase();
                                    let matched = false;

                                    switch (rule.match_type) {
                                        case 'starts': matched = msgLower.startsWith(keyword); break;
                                        case 'ends': matched = msgLower.endsWith(keyword); break;
                                        case 'contains': matched = msgLower.includes(keyword); break;
                                        case 'any': matched = true; break;
                                    }

                                    if (matched && rule.message_content) {
                                        matchedGlobal = true;
                                        logDebug(`🤖 [CHATBOT] Regra encontrada no bot ${bot.id}: ${rule.match_type} "${keyword}"`);

                                        if (rule.delay_seconds > 0) {
                                            await new Promise(r => setTimeout(r, rule.delay_seconds * 1000));
                                        }

                                        await sendWhatsAppMessage(instance, remoteJid, rule.message_content);

                                        const chatbotMsgId = `CHATBOT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                                        await pool.query(`
                                            INSERT INTO messages (user_id, contact_id, instance_name, uid, key_from_me, content, type, timestamp, source)
                                            VALUES (?, ?, ?, ?, 1, ?, 'text', ?, 'chatbot')
                                        `, [userId, contactId, instance, chatbotMsgId, rule.message_content, Math.floor(Date.now() / 1000)]);
                                    }
                                }
                            }

                            if (matchedGlobal) {
                                logDebug(`🤖 [CHATBOT] FlowBuild ignorado (chatbot respondeu)`);
                                return res.status(200).send('OK');
                            }
                        }
                    } catch (chatbotErr) {
                        logDebug(`❌ [CHATBOT] Erro: ${chatbotErr.message}`);
                    }
                }

                // ======= FLOW EXECUTION =======
                try {
                    // Only process if it's an incoming message (not from me)
                    if (!fromMe) {
                        // 1. Check for RESUME (Pending Input/Question)
                        const [stateRows] = await pool.query(
                            "SELECT * FROM flow_state WHERE remote_jid = ? AND user_id = ?",
                            [remoteJid, userId]
                        );

                        if (stateRows.length > 0) {
                            const state = stateRows[0];
                            logDebug(`🔄 [FLOW] Resuming flow ${state.flow_id} for node ${state.current_node_id}`);
                            // Sanitizar nome da variável (pode ter sido salvo com {{ }} se o nó não foi atualizado antes)
                            const varName = sanitizeVariableName(state.variable_name || 'user_input');
                            logDebug(`📥 [FLOW] Variable Name to save: ${varName} | Value: ${content}`);

                            // Save variable to contact
                            const [contactVarsRows] = await pool.query("SELECT variables FROM contacts WHERE id = ?", [contactId]);
                            let contactVars = contactVarsRows[0]?.variables || {};
                            if (typeof contactVars === 'string') {
                                try { contactVars = JSON.parse(contactVars); } catch (e) { contactVars = {}; }
                            }

                            logDebug(`📂 [FLOW] Existing variables for contact: ${JSON.stringify(contactVars)}`);

                            contactVars[varName] = content;
                            await pool.query("UPDATE contacts SET variables = ? WHERE id = ?", [JSON.stringify(contactVars), contactId]);
                            logDebug(`✅ [FLOW] Variables updated and saved.`);

                            // Get flow content
                            const [flowRows] = await pool.query("SELECT content FROM flows WHERE id = ?", [state.flow_id]);
                            if (flowRows.length > 0) {
                                const flowContent = typeof flowRows[0].content === 'string' ? JSON.parse(flowRows[0].content) : flowRows[0].content;

                                // Delete state BEFORE continuing to prevent loops or double execution
                                await pool.query("DELETE FROM flow_state WHERE id = ?", [state.id]);

                                // Setup context with variables
                                const context = {
                                    userId,
                                    remoteJid,
                                    instanceName: instance,
                                    contactId,
                                    variables: {
                                        ...contactVars,
                                        contact: { ...contactVars, phone: remoteJid.replace('@s.whatsapp.net', '') },
                                        message: content,
                                        last_input: content
                                    },
                                    visitedNodes: new Set(),
                                    flowId: state.flow_id
                                };

                                // Find next node
                                const edges = flowContent.edges || [];
                                const nextEdge = edges.find(e => e.source === state.current_node_id);
                                if (nextEdge) {
                                    const nextNode = flowContent.nodes.find(n => n.id === nextEdge.target);
                                    if (nextNode) {
                                        processNode(nextNode, flowContent, context)
                                            .then(() => logDebug(`🏁 [FLOW] Resumed flow execution completed`))
                                            .catch(err => logDebug(`❌ [FLOW] Resumed flow error: ${err.message}`));
                                    }
                                }

                                return res.status(200).send('OK'); // Stop here, we resumed a flow
                            }
                        }

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

// Create Instance
app.post('/api/instances', authenticateToken, async (req, res) => {
    const { instanceName, provider = 'evolution', phoneNumberId, accessToken, wabaId } = req.body;

    if (!instanceName) return res.status(400).json({ error: 'Nome da instância obrigatório' });

    try {
        // Verificar limite de instâncias do plano
        const limitCheck = await checkUserLimit(req.user.id, 'instances');
        if (!limitCheck.allowed) {
            return res.status(403).json(limitCheck);
        }

        if (provider === 'official') {
            // --- CRIAÇÃO VIA API OFICIAL (META) ---
            if (!phoneNumberId || !accessToken) {
                return res.status(400).json({ error: 'Phone ID e Token são obrigatórios para API Oficial.' });
            }

            // Salvar no banco diretamente
            await pool.execute(
                "INSERT INTO whatsapp_accounts (user_id, business_name, provider, phone_number_id, access_token, waba_id, status) VALUES (?, ?, ?, ?, ?, ?, 'connected')",
                [req.user.id, instanceName, 'official', phoneNumberId, accessToken, wabaId || null]
            );

            console.log(`✅ [INSTANCE] Instância Oficial criada: ${instanceName} (${phoneNumberId})`);
            return res.json({
                success: true,
                instance: { name: instanceName, status: 'connected', provider: 'official' }
            });

        } else {
            // --- CRIAÇÃO VIA EVOLUTION API (LEGADO) ---
            const evo = await getEvolutionService();
            if (!evo) return res.status(500).json({ error: 'Evolution Service unavailable' });

            // Check if instance already exists for this user
            const [existing] = await pool.query("SELECT user_id, business_name FROM whatsapp_accounts WHERE business_name = ? AND user_id = ?", [instanceName, req.user.id]);
            if (existing.length > 0) {
                console.log(`ℹ️ [INFO] Usuário ${req.user.id} está recriando/atualizando sua própria instância '${instanceName}'`);
                // If it's the user's own instance, remove the old reference to insert the new clean one
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

// --- GERENCIAMENTO DE CONTATOS ---
app.get('/api/contacts', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT id, remote_jid as phone, name, profile_pic as avatar, unread_count, status, last_seen, instance_name, created_at, groups_json FROM contacts WHERE user_id = ? ORDER BY created_at DESC",
            [req.user.id]
        );

        // Formatar resposta para o frontend
        const contacts = rows.map(c => ({
            ...c,
            lastSeen: c.last_seen || 'Offline', // Placeholder se não houver coluna
            groups: c.groups_json ? JSON.parse(c.groups_json) : []
        }));

        res.json(contacts);
    } catch (err) {
        console.error('Erro ao listar contatos:', err);
        res.status(500).json({ error: 'Erro ao buscar contatos' });
    }
});

app.put('/api/contacts/:id', authenticateToken, async (req, res) => {
    try {
        const { name, notes } = req.body; // Aceita notas se adicionarmos a coluna depois
        const { id } = req.params;

        await pool.query(
            "UPDATE contacts SET name = ? WHERE id = ? AND user_id = ?",
            [name, id, req.user.id]
        );

        res.json({ success: true, message: 'Contato atualizado' });
    } catch (err) {
        console.error('Erro ao atualizar contato:', err);
        res.status(500).json({ error: 'Erro ao atualizar contato' });
    }
});

// --- AI SETTINGS ---
app.get('/api/settings/ai', authenticateToken, async (req, res) => {
    try {
        const keys = [
            'openai_key', 'openai_model',
            'google_key', 'google_model',
            'system_prompt', 'temperature', 'max_tokens', 'ai_active'
        ];

        // Dynamically build placeholder string like (?,?,?,?,...)
        const placeholders = keys.map(() => '?').join(',');

        const [rows] = await pool.query(
            `SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (${placeholders})`,
            keys
        );

        const settings = {};
        rows.forEach(r => settings[r.setting_key] = r.setting_value);

        res.json(settings);
    } catch (err) {
        console.error('Erro ao buscar configs de IA:', err);
        res.status(500).json({ error: 'Erro ao buscar configurações' });
    }
});

app.post('/api/settings/ai', authenticateToken, async (req, res) => {
    try {
        const settings = req.body;
        const keys = [
            'openai_key', 'openai_model',
            'google_key', 'google_model',
            'system_prompt', 'temperature', 'max_tokens', 'ai_active'
        ];

        // Upsert each setting
        for (const key of keys) {
            if (settings[key] !== undefined) {
                await pool.query(
                    `INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)
                     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
                    [key, String(settings[key])]
                );
            }
        }

        // Se AI estiver ativa, desativar outros bots (Fluxos e Chatbots de Palavra-Chave)
        if (settings.ai_active === 'true' || settings.ai_active === true) {
            await pool.query("UPDATE keyword_chatbot SET is_active = 0 WHERE user_id = ?", [req.user.id]);
            await pool.query("UPDATE flows SET status = 'paused' WHERE user_id = ?", [req.user.id]);
            console.log(`🤖 [AI] IA ativada para User ${req.user.id}. Chatbots e Fluxos foram pausados.`);
        }

        res.json({ success: true, message: 'Configurações salvas' });
    } catch (err) {
        console.error('Erro ao salvar configs de IA:', err);
        res.status(500).json({ error: 'Erro ao salvar configurações' });
    }
});

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



// --- ASSISTENTE DE IA PARA TEXTO ---
app.post('/api/ai/improve-text', authenticateToken, async (req, res) => {
    try {
        const { text, tone } = req.body;
        if (!text) return res.status(400).json({ error: 'Texto obrigatório' });

        // Buscar chaves de sistema
        const [configRows] = await pool.query(
            "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('openai_key', 'openai_model', 'google_key', 'google_model')"
        );
        const config = {};
        configRows.forEach(r => config[r.setting_key] = r.setting_value);

        const tonePrompts = {
            serio: 'Reescreva o texto abaixo com um tom sério e formal:',
            educado: 'Reescreva o texto abaixo de forma educada e cortês:',
            bravo: 'Reescreva o texto abaixo com um tom mais firme e assertivo:',
            engracado: 'Reescreva o texto abaixo de forma divertida e bem-humorada:',
            profissional: 'Reescreva o texto abaixo de forma profissional e corporativa:',
            ortografia: 'Corrija a ortografia e gramática do texto abaixo, mantendo o sentido original:'
        };

        const prompt = tonePrompts[tone] || tonePrompts.profissional;
        let improvedText = '';

        // PRIORIDADE 1: OpenAI
        if (config.openai_key && config.openai_key.startsWith('sk-')) {
            console.log(`🤖 [IMPROVE TEXT] Usando OpenAI (Model: ${config.openai_model || 'gpt-4o'})`);
            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: config.openai_model || 'gpt-4o',
                messages: [
                    { role: 'system', content: 'Você é um assistente de escrita. Retorne APENAS o texto reescrito, sem aspas, explicações ou comentários.' },
                    { role: 'user', content: `${prompt}\n\n"${text}"` }
                ],
                temperature: 0.7
            }, {
                headers: {
                    'Authorization': `Bearer ${config.openai_key}`,
                    'Content-Type': 'application/json'
                }
            });
            improvedText = response.data?.choices?.[0]?.message?.content || text;
        }
        // PRIORIDADE 2: Google Gemini
        else if (config.google_key) {
            console.log(`🤖 [IMPROVE TEXT] Usando Google Gemini (Model: ${config.google_model || 'gemini-1.5-flash'})`);
            const response = await axios.post(`https://generativelanguage.googleapis.com/v1/models/${config.google_model || 'gemini-1.5-flash'}:generateContent?key=${config.google_key}`, {
                contents: [{ role: 'user', parts: [{ text: `${prompt}\n\n"${text}"\n\nRetorne APENAS o texto reescrito, sem explicações.` }] }]
            });
            improvedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || text;
        }
        else {
            return res.status(400).json({
                error: 'IA não configurada',
                message: 'Configure sua API Key (OpenAI ou Gemini) nas Integrações de IA.',
                code: 'AI_NOT_CONFIGURED'
            });
        }

        res.json({ original: text, improved: improvedText.trim() });
    } catch (err) {
        console.error('Erro AI:', err.response?.data || err.message);
        res.status(500).json({ error: 'Erro ao processar IA', details: err.response?.data || err.message });
    }
});

// --- CHATBOT POR PALAVRAS-CHAVE ---
app.get('/api/chatbot/keywords', authenticateToken, async (req, res) => {
    try {
        // Buscar todos os chatbots do usuário
        const [chatbots] = await pool.query("SELECT * FROM keyword_chatbot WHERE user_id = ?", [req.user.id]);

        // Para cada chatbot, buscar suas regras
        const result = [];
        for (const chatbot of chatbots) {
            const [rules] = await pool.query("SELECT * FROM keyword_chatbot_rules WHERE chatbot_id = ? ORDER BY response_order ASC", [chatbot.id]);
            result.push({ ...chatbot, rules });
        }

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar chatbots' });
    }
});

app.post('/api/chatbot/keywords', authenticateToken, async (req, res) => {
    try {
        const { id, instance_name, rules } = req.body;
        let chatbotId = id;

        if (chatbotId) {
            // Atualizar existente
            await pool.query("UPDATE keyword_chatbot SET instance_name = ?, updated_at = NOW() WHERE id = ? AND user_id = ?", [instance_name, chatbotId, req.user.id]);
            await pool.query("DELETE FROM keyword_chatbot_rules WHERE chatbot_id = ?", [chatbotId]);
        } else {
            // Criar novo
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

app.patch('/api/chatbot/keywords/:id/toggle', authenticateToken, async (req, res) => {
    try {
        const { is_active } = req.body;
        const { id } = req.params;

        await pool.query("UPDATE keyword_chatbot SET is_active = ? WHERE id = ? AND user_id = ?", [is_active ? 1 : 0, id, req.user.id]);

        if (is_active) {
            await pool.query("UPDATE flows SET status = 'paused' WHERE user_id = ? AND status = 'active'", [req.user.id]);
        }

        res.json({ success: true, is_active, flowsDisabled: is_active });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao alternar chatbot' });
    }
});

app.delete('/api/chatbot/keywords/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM keyword_chatbot_rules WHERE chatbot_id = ?", [id]);
        await pool.query("DELETE FROM keyword_chatbot WHERE id = ? AND user_id = ?", [id, req.user.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao excluir chatbot' });
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

        // Espaço em Disco (Linux/Unix)
        let diskInfo = { total: '0GB', used: '0GB', free: '0GB', usage: 0 };
        try {
            const { execSync } = require('child_process');
            const output = execSync("df -h / | tail -1").toString().split(/\s+/);
            // Saída df -h: Filesystem Size Used Avail Use% Mounted
            diskInfo = {
                total: output[1],
                used: output[2],
                free: output[3],
                usage: parseInt(output[4].replace('%', ''))
            };
        } catch (e) {
            console.error('Erro ao ler disco:', e);
        }

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
                classification,
                disk_info: diskInfo
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
        await sendZeptoEmail(to, subject, html);
        console.log(`📧 Email enviado via ZeptoMail para ${to}`);
        return true;
    } catch (err) {
        console.error(`❌ Erro ao enviar email via ZeptoMail:`, err.message);
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
// (Movido para dentro do startServer para garantir pool inicializado)

// ========== FIM NOVAS FUNCIONALIDADES ==========

// --- EMAIL TEMPLATES ROUTES ---
app.get('/api/admin/email-templates', authenticateAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM email_templates');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar templates' });
    }
});

app.post('/api/admin/email-templates', authenticateAdmin, async (req, res) => {
    const { id, subject, body_html } = req.body;
    try {
        await pool.execute('UPDATE email_templates SET subject = ?, body_html = ? WHERE id = ?', [subject, body_html, id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao atualizar template' });
    }
});

// Enviar e-mail usando template do banco
async function sendEmailWithTemplate(to, templateKey, vars = {}, cta = { text: null, url: null }) {
    try {
        const [rows] = await pool.execute('SELECT subject, body_html FROM email_templates WHERE template_key = ?', [templateKey]);
        if (rows.length === 0) throw new Error('Template não encontrado');

        let { subject, body_html } = rows[0];

        // Substituir variáveis {{name}}, {{code}}, etc
        Object.keys(vars).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            body_html = body_html.replace(regex, vars[key]);
            subject = subject.replace(regex, vars[key]);
        });

        const html = MASTER_TEMPLATE(subject, body_html, cta.text, cta.url);
        await sendZeptoEmail(to, subject, html);
    } catch (err) {
        console.error(`[EMAIL] Erro ao enviar template ${templateKey}:`, err.message);
    }
}

const PORT = process.env.PORT || 5000;


async function startServer() {
    try {
        await connectToDB();

        // Inicializar CRONs e Limpeza após conexão bem-sucedida
        setTimeout(scheduleCrons, 5000);
        setTimeout(cleanupTrials, 10000);

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Servidor rodando na porta ${PORT}`);
            console.log(`🌍 Domínio: ublochat.com.br`);
        });
    } catch (err) {
        console.error('❌ FALHA AO INICIAR SERVIDOR:', err.message);
        process.exit(1);
    }
}

startServer();
