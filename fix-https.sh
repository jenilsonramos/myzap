#!/bin/bash

# Script de Correção v11 - REPARO FULL-FORCE
# Resolve o erro 503 e a falta de dependências na API

DOMAIN="app.ublochat.com.br"
ROOT="/var/www/myzap/dist"
DB_PASS="myzap_password_2026"
DB_USER="myzap_user"

echo ">>> Iniciando REPARO v11 (Forçando Dependências)..."

# 1. Configurar Banco de Dados
sudo mysql -e "ALTER USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';" || \
sudo mysql -e "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS'; GRANT ALL PRIVILEGES ON myzap.* TO '$DB_USER'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"

# 2. Garantir Pasta e Arquivos da API
mkdir -p /var/www/myzap/api
cd /var/www/myzap/api

echo "Criando package.json..."
cat > package.json <<EOF
{
  "name": "myzap-api",
  "version": "1.0.0",
  "main": "server.js",
  "dependencies": {
    "bcrypt": "^5.1.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.1",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "mysql2": "^3.9.1"
  }
}
EOF

echo "Instalando dependências (isso pode demorar um pouco)..."
npm install

echo "Atualizando .env..."
cat > .env <<EOF
DB_HOST=127.0.0.1
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASS
DB_NAME=myzap
JWT_SECRET=myzap_secret_shhh_2026
PORT=5000
EOF

echo "Atualizando server.js..."
cat > server.js <<EOF
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

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

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

app.listen(5000, '0.0.0.0', () => console.log('🚀 API Online na porta 5000'));
EOF

# 4. Reiniciar PM2
echo "Reiniciando PM2..."
pm2 delete myzap-api > /dev/null 2>&1
pm2 start server.js --name "myzap-api"
pm2 save > /dev/null 2>&1

# 5. Reconfigurar Apache
echo "Ajustando Apache..."
sudo a2enmod proxy proxy_http rewrite ssl headers > /dev/null 2>&1

create_vhost() {
    local FILE=$1
    local PORT=$2
    sudo bash -c "cat > $FILE <<EOF
<VirtualHost *:$PORT>
    ServerName $DOMAIN
    DocumentRoot $ROOT
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

echo ">>> AGUARDANDO API... <<<"
sleep 5
curl -s http://127.0.0.1:5000/api/health
echo -e "\n>>> REPARO v11 CONCLUÍDO! Tente se cadastrar agora. <<<"
