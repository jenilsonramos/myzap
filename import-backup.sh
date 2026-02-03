#!/bin/bash

# ==========================================================================
# MyZap - Script de Restauração de Backup
# ==========================================================================
# Descompacta setup_sql.zip e importa para o banco ublochat_db
# ==========================================================================

# Configurações do Destino
NEW_DB="ublochat_db"
NEW_USER="ublochat_user"
NEW_PASS="uBoX4+5pacw2WJBn"
ZIP_FILE="setup_sql.zip"
SQL_FILE="setup.sql"

echo ">>> Iniciando Restauração de Backup <<<"

# 1. Verificar se o arquivo zip existe
if [ ! -f "$ZIP_FILE" ]; then
    echo "❌ Erro: Arquivo $ZIP_FILE não encontrado."
    exit 1
fi

# 2. Descompactar
echo "Descompactando $ZIP_FILE..."
unzip -o $ZIP_FILE

# 3. Verificar se o SQL foi extraído
if [ ! -f "$SQL_FILE" ]; then
    echo "❌ Erro: O arquivo $SQL_FILE não foi encontrado após descompactar."
    exit 1
fi

# 4. Limpar e Importar para o banco
echo "Limpando o banco $NEW_DB para uma instalação limpa..."
# Dropar e recriar o banco para evitar erro de 'Table already exists'
mysql -u $NEW_USER -p$NEW_PASS -e "DROP DATABASE IF EXISTS $NEW_DB; CREATE DATABASE $NEW_DB;"

echo "Importando novos dados para $NEW_DB..."
mysql -u $NEW_USER -p$NEW_PASS $NEW_DB < $SQL_FILE

if [ $? -eq 0 ]; then
    echo "✅ Importação concluída com sucesso!"
    
    echo "🔧 Aplicando correções profundas de esquema..."
    # Adicionar colunas (Removido IF NOT EXISTS para compatibilidade com versões antigas de MySQL)
    # O || true garante que o script continue se a coluna já existir por algum motivo
    mysql -u $NEW_USER -p$NEW_PASS $NEW_DB -e "ALTER TABLE users ADD COLUMN name VARCHAR(255) FIRST;" 2>/dev/null || echo "Aviso: Coluna 'name' já existe ou erro ao criar."
    mysql -u $NEW_USER -p$NEW_PASS $NEW_DB -e "ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user';" 2>/dev/null || echo "Aviso: Coluna 'role' já existe."
    mysql -u $NEW_USER -p$NEW_PASS $NEW_DB -e "ALTER TABLE users ADD COLUMN plan VARCHAR(100) DEFAULT 'Teste Grátis';" 2>/dev/null || echo "Aviso: Coluna 'plan' já existe."
    mysql -u $NEW_USER -p$NEW_PASS $NEW_DB -e "ALTER TABLE users ADD COLUMN trial_ends_at DATETIME;" 2>/dev/null || echo "Aviso: Coluna 'trial_ends_at' já existe."
    
    # Migrar dados de firstname/lastname para name se name estiver vazio
    echo "Migrando nomes antigos..."
    mysql -u $NEW_USER -p$NEW_PASS $NEW_DB -e "UPDATE users SET name = CONCAT(IFNULL(firstname,''), ' ', IFNULL(lastname,'')) WHERE name IS NULL OR name = '';"
    
    echo "✅ Esquema reparado e nomes migrados."
    echo "Agora seus dados devem estar acessíveis em https://ublochat.com.br"
else
    echo "❌ Erro ao importar dados no MySQL."
    exit 1
fi

# Limpeza (opcional)
# rm $SQL_FILE

echo ">>> PROCESSO CONCLUÍDO! <<<"
