#!/bin/bash

# ==========================================================================
# MyZap - Script de Migração de Dados
# ==========================================================================
# Origem: ublochat.com.br (Banco: myzap)
# Destino: ublochat.com.br (Banco: ublochat_db)
# ==========================================================================

# Configurações da Origem (O BANCO DE ONDE VEM OS DADOS)
OLD_DB="myzap"
OLD_USER="myzap_user"
OLD_PASS="SUA_SENHA_ANTIGA_AQUI" # <--- INSIRA A SENHA DO BANCO ANTIGO AQUI

# Configurações do Destino
NEW_DB="ublochat_db"
NEW_USER="ublochat_user"
NEW_PASS="uBoX4+5pacw2WJBn"

echo ">>> Iniciando Migração de Dados <<<"

# 1. Exportar da Origem
echo "Exportando dados do banco antigo ($OLD_DB)..."
mysqldump -u $OLD_USER -p$OLD_PASS $OLD_DB > backup_migracao.sql

if [ $? -eq 0 ]; then
    echo "✅ Exportação concluída com sucesso (backup_migracao.sql)."
else
    echo "❌ Erro ao exportar dados. Verifique o usuário e senha da origem."
    exit 1
fi

# 2. Importar no Destino
echo "Importando dados no novo banco ($NEW_DB)..."
mysql -u $NEW_USER -p$NEW_PASS $NEW_DB < backup_migracao.sql

if [ $? -eq 0 ]; then
    echo "✅ Importação concluída com sucesso no banco $NEW_DB!"
else
    echo "❌ Erro ao importar dados no novo banco."
    exit 1
fi

echo ">>> MIGRAÇÃO CONCLUÍDA! <<<"
echo "Lembre-se de deletar o arquivo backup_migracao.sql por segurança."
