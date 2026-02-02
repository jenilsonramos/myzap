#!/bin/bash

# Script de Correção v10 - DIAGNÓSTICO E REPARO TOTAL
# Resolve 503 Service Unavailable e JSON Error

DOMAIN="app.ublochat.com.br"
ROOT="/var/www/myzap/dist"
DB_PASS="myzap_password_2026"
DB_USER="myzap_user"

echo ">>> Iniciando REPARO v10 (Foco em Conectividade)..."

# 1. Configurar Banco de Dados (Sincronização Forçada)
echo "Sincronizando senha do MySQL para $DB_USER..."
sudo mysql -e "ALTER USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';" || \
sudo mysql -e "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS'; GRANT ALL PRIVILEGES ON myzap.* TO '$DB_USER'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"

# 2. Atualizar .env da API
echo "Atualizando .env da API..."
cat > /var/www/myzap/api/.env <<EOF
DB_HOST=127.0.0.1
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASS
DB_NAME=myzap
JWT_SECRET=myzap_secret_shhh_2026
PORT=5000
EOF

# 3. Garantir que a API tenha um endpoint de status para o Apache
echo "Atualizando server.js com Health Check..."
cat > /var/www/myzap/api/server.js <<EOF
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
};

let pool;
async function connect() {
    try {
        pool = mysql.createPool(dbConfig);
        console.log('✅ MySQL Conectado');
    } catch (e) { console.error('❌ Erro MySQL:', e.message); }
}
connect();

// Endpoint de Saúde para testar o Apache
app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'Backend is Live' }));

app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const [rows] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (rows.length > 0) return res.status(400).json({ error: 'Email já cadastrado.' });
        const hash = await bcrypt.hash(password, 10);
        await pool.execute('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, hash]);
        res.status(201).json({ message: 'OK' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) return res.status(401).json({ error: 'Não encontrado' });
        const valid = await bcrypt.compare(password, rows[0].password);
        if (!valid) return res.status(401).json({ error: 'Incorreta' });
        const token = jwt.sign({ id: rows[0].id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: rows[0].id, name: rows[0].name } });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(5000, '0.0.0.0', () => console.log('🚀 API Rodando na porta 5000'));
EOF

# 4. Reiniciar Backend
echo "Reiniciando API com PM2..."
cd /var/www/myzap/api
npm install > /dev/null 2>&1
pm2 delete myzap-api > /dev/null 2>&1
pm2 start server.js --name "myzap-api"
pm2 save > /dev/null 2>&1

# 5. Reconfigurar Apache (Usando 127.0.0.1 para evitar erro 503)
echo "Reconfigurando Apache..."
sudo a2enmod proxy proxy_http rewrite ssl headers > /dev/null 2>&1

create_vhost() {
    local FILE=$1
    local PORT=$2
    sudo bash -c "cat > $FILE <<EOF
<VirtualHost *:$PORT>
    ServerName $DOMAIN
    DocumentRoot $ROOT

    # Proxy Pass Direto (Mais estável que Rewrite [P])
    ProxyPreserveHost On
    ProxyPass /api http://127.0.0.1:5000/api
    ProxyPassReverse /api http://127.0.0.1:5000/api

    <Directory $ROOT>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteCond %{REQUEST_URI} !^/api [NC]
        RewriteRule . /index.html [L]
    </Directory>

    ErrorLog \${APACHE_LOG_DIR}/myzap_error.log
    CustomLog \${APACHE_LOG_DIR}/myzap_access.log combined

$( [ "$PORT" == "443" ] && echo "    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/$DOMAIN/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/$DOMAIN/privkey.pem" )
</VirtualHost>
EOF"
}

create_vhost "/etc/apache2/sites-available/myzap.conf" 80
create_vhost "/etc/apache2/sites-available/myzap-le-ssl.conf" 443
sudo systemctl restart apache2

# 6. Diagnóstico Final
echo ">>> TESTE DE CONECTIVIDADE <<<"
sleep 2
if curl -s http://127.0.0.1:5000/api/health | grep -q "Backend is Live"; then
    echo "✅ API está respondendo internamente!"
else
    echo "❌ API NÃO RESPONDEU. Verifique 'pm2 logs myzap-api'"
fi

echo ">>> REPARO v10 CONCLUÍDO! <<<"
