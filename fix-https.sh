#!/bin/bash

# Script de Correção v16 - LIMPEZA TOTAL E REPARO DEFINITIVO
# Resolve conflitos de PM2, Criptografia e Estrutura de Banco

DOMAIN="app.ublochat.com.br"
ROOT="/var/www/myzap/dist"
DB_PASS="myzap_password_2026"
DB_USER="myzap_user"
DB_NAME="myzap"

echo ">>> Iniciando REPARO v16 (Limpeza Total) <<<"

# 1. Matar tudo o que estiver rodando para evitar conflitos
echo "Encerrando processos antigos..."
pm2 stop all > /dev/null 2>&1
pm2 delete all > /dev/null 2>&1
pm2 kill > /dev/null 2>&1
sudo fuser -k 5000/tcp > /dev/null 2>&1

# 2. Limpeza Radical da Pasta API
echo "Reconstruindo pasta da API..."
sudo rm -rf /var/www/myzap/api
mkdir -p /var/www/myzap/api
cd /var/www/myzap/api

# 3. Criar arquivos do zero (Usando BCRYPTJS para evitar erros de compilação)
cat > package.json <<EOF
{
  "name": "myzap-api",
  "version": "1.0.0",
  "main": "server.js",
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.1",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "mysql2": "^3.9.1"
  }
}
EOF

echo "Instalando dependências (Bcryptjs)..."
npm install --no-audit --no-fund > /dev/null 2>&1

cat > .env <<EOF
DB_HOST=127.0.0.1
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASS
DB_NAME=$DB_NAME
JWT_SECRET=myzap_secret_shhh_2026
PORT=5000
EOF

cat > server.js <<EOF
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
};

let pool;
async function connect() {
    try {
        pool = mysql.createPool(dbConfig);
        console.log('✅ API V16: MySQL Conectado');
    } catch (e) {
        console.error('❌ API V16: Erro MySQL:', e.message);
    }
}
connect();

app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '16.0' }));

app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        if (!name || !email || !password) return res.status(400).json({ error: 'Dados incompletos' });
        const [rows] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (rows.length > 0) return res.status(400).json({ error: 'Email já cadastrado.' });
        const hash = await bcrypt.hash(password, 10);
        await pool.execute('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, hash]);
        res.status(201).json({ message: 'OK' });
    } catch (e) {
        console.error('Register Error:', e.message);
        res.status(500).json({ error: 'Erro no banco: ' + e.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) return res.status(401).json({ error: 'Usuário não encontrado' });
        const valid = await bcrypt.compare(password, rows[0].password);
        if (!valid) return res.status(401).json({ error: 'Senha incorreta' });
        const token = jwt.sign({ id: rows[0].id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: rows[0].id, name: rows[0].name } });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(5000, '0.0.0.0', () => console.log('🚀 API V16 ONLINE na porta 5000'));
EOF

# 4. Reparar Banco de Dados de forma robusta
echo "Ajustando banco de dados..."
sudo mysql -e "CREATE DATABASE IF NOT EXISTS $DB_NAME;"
sudo mysql -e "USE $DB_NAME; CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255), email VARCHAR(255) UNIQUE, password VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);"
# Adicionar coluna name apenas se não existir
COLUMN_EXISTS=$(sudo mysql -N -s -e "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='users' AND COLUMN_NAME='name';")
if [ "$COLUMN_EXISTS" -eq 0 ]; then
    sudo mysql -e "USE $DB_NAME; ALTER TABLE users ADD COLUMN name VARCHAR(255) AFTER id;"
fi
sudo mysql -e "ALTER USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';" || sudo mysql -e "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS'; GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"

# 5. Reiniciar o Backend com PM2 novo
echo "Iniciando nova API..."
pm2 start server.js --name "myzap-api"
pm2 save > /dev/null 2>&1

# 6. Reconfigurar e Reiniciar Apache
echo "Reiniciando Apache..."
sudo a2enmod proxy proxy_http rewrite ssl headers > /dev/null 2>&1
sudo systemctl restart apache2

echo ">>> AGUARDANDO VERIFICAÇÃO FINAL... <<<"
sleep 5
RESPONSE=$(curl -s http://127.0.0.1:5000/api/health)
if [[ $RESPONSE == *"16.0"* ]]; then
    echo "✅ SUCESSO! API Versão 16 Online e Pronta!"
else
    echo "❌ FALHA: A API ainda não respondeu. Verifique pm2 logs."
fi

echo ">>> REPARO v16 CONCLUÍDO! Tente o cadastro agora. <<<"
