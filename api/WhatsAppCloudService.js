const axios = require('axios');

class WhatsAppCloudService {
    constructor() {
        this.baseUrl = 'https://graph.facebook.com/v22.0';
    }

    /**
     * Envia uma mensagem de texto simples
     */
    async sendText(instance, to, text) {
        if (!instance.phone_number_id || !instance.access_token) {
            throw new Error('Credenciais da API Oficial incompletas (Phone ID ou Token ausente)');
        }

        const url = `${this.baseUrl}/${instance.phone_number_id}/messages`;

        try {
            const response = await axios.post(url, {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: to,
                type: 'text',
                text: { preview_url: true, body: text }
            }, {
                headers: {
                    'Authorization': `Bearer ${instance.access_token}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.data;
        } catch (error) {
            console.error('❌ [META API] Erro ao enviar texto:', error.response?.data || error.message);
            throw new Error(error.response?.data?.error?.message || error.message);
        }
    }

    /**
     * Envia mídia (imagem, vídeo, áudio, documento)
     * Para API Oficial, idealmente usamos ID de mídia ou Link público.
     * Aqui implementaremos via LINK público (mais fácil para integração híbrida)
     */
    async sendMedia(instance, to, type, url, caption = '') {
        if (!instance.phone_number_id || !instance.access_token) {
            throw new Error('Credenciais da API Oficial incompletas');
        }

        const endpoint = `${this.baseUrl}/${instance.phone_number_id}/messages`;

        // Mapeamento de tipos do MyZap para Meta API
        // MyZap: image, video, audio, document
        // Meta: image, video, audio, document (bateram, sorte!)

        const body = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: to,
            type: type,
            [type]: {
                link: url
            }
        };

        if (caption && type !== 'audio') {
            body[type].caption = caption;
        }

        try {
            const response = await axios.post(endpoint, body, {
                headers: {
                    'Authorization': `Bearer ${instance.access_token}`,
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        } catch (error) {
            console.error(`❌ [META API] Erro ao enviar ${type}:`, error.response?.data || error.message);
            throw new Error(error.response?.data?.error?.message || error.message);
        }
    }

    /**
     * Marca uma mensagem como lida
     */
    async markAsRead(instance, messageId) {
        try {
            await axios.post(`${this.baseUrl}/${instance.phone_number_id}/messages`, {
                messaging_product: 'whatsapp',
                status: 'read',
                message_id: messageId
            }, {
                headers: { 'Authorization': `Bearer ${instance.access_token}` }
            });
        } catch (e) {
            console.warn('⚠️ [META API] Falha ao marcar como lida:', e.message);
        }
    }
}

module.exports = new WhatsAppCloudService();
