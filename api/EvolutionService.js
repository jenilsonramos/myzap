const axios = require('axios');

class EvolutionService {
    constructor(baseUrl, apiKey) {
        this.baseUrl = baseUrl?.replace(/\/$/, ''); // Remove trailing slash
        this.apiKey = apiKey;
    }

    async _request(endpoint, method = 'GET', body = null) {
        if (!this.baseUrl || !this.apiKey) {
            throw new Error('Evolution API URL or Key not configured');
        }

        const url = `${this.baseUrl}${endpoint}`;
        const options = {
            method,
            url,
            headers: {
                'Content-Type': 'application/json',
                'apikey': this.apiKey
            },
            validateStatus: () => true // Resolve promise even for 4xx/5xx to handle errors manually
        };

        if (body) {
            options.data = body;
        }

        console.log(`📡 [Evolution] ${method} ${url}`);

        try {
            const response = await axios(options);

            if (response.status === 204) return null;

            console.log(`📥 [Evolution] Response (${response.status}):`, typeof response.data === 'object' ? JSON.stringify(response.data).slice(0, 100) : response.data);

            if (response.status >= 200 && response.status < 300) {
                return response.data;
            } else {
                const errorMsg = response.data?.message || response.data?.error || JSON.stringify(response.data);
                console.error(`❌ Erro da API Evolution [${response.status}]:`, errorMsg);
                throw new Error(errorMsg);
            }
        } catch (error) {
            console.error(`❌ Falha na requisição Evolution:`, error.message);
            throw error;
        }
    }

    // 1. Criar Instância
    async createInstance(instanceName, token) {
        // Evolution v2 payload format might vary, check docs if available. 
        // Standard v1/v2 usually accepts: { instanceName, token, qrcode: true }
        return this._request('/instance/create', 'POST', {
            instanceName: instanceName,
            token: token ? String(token) : undefined,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS'
        });
    }

    // 2. Listar Instâncias
    async fetchInstances() {
        // Evolution retorna array de objetos ou objeto com array
        // Endpoint v2: /instance/fetchInstances
        return this._request('/instance/fetchInstances', 'GET');
    }

    // 3. Deletar Instância
    async deleteInstance(instanceName) {
        return this._request(`/instance/delete/${instanceName}`, 'DELETE');
    }

    // 4. Conectar / Obter QR Code
    // Na v2, geralmente é /instance/connect/:instanceName
    async connectInstance(instanceName) {
        return this._request(`/instance/connect/${instanceName}`, 'GET');
    }

    // 5. Obter Status da Conexão
    async getConnectionState(instanceName) {
        return this._request(`/instance/connectionState/${instanceName}`, 'GET');
    }

    // 6. Configurar Webhook
    async setWebhook(instanceName, webhookUrl, enabled = true) {
        return this._request(`/webhook/set/${instanceName}`, 'POST', {
            webhook: {
                url: webhookUrl,
                webhookByEvents: false,
                events: [
                    'MESSAGES_UPSERT',
                    'MESSAGES_UPDATE',
                    'MESSAGES_DELETE',
                    'SEND_MESSAGE',
                    'CONNECTION_UPDATE'
                ],
                enabled: enabled
            }
        });
    }

    // 7. Enviar Texto
    async sendText(instanceName, number, text) {
        return this._request(`/message/sendText/${instanceName}`, 'POST', {
            number: number.replace(/\D/g, ''),
            text,
            delay: 1200
        });
    }

    // 8. Enviar Mídia
    async sendImage(instanceName, number, url, caption = '') {
        return this._request(`/message/sendMedia/${instanceName}`, 'POST', {
            number: number.replace(/\D/g, ''),
            mediatype: 'image',
            media: url,
            caption
        });
    }

    async sendVideo(instanceName, number, url, caption = '') {
        return this._request(`/message/sendMedia/${instanceName}`, 'POST', {
            number: number.replace(/\D/g, ''),
            mediatype: 'video',
            media: url,
            caption
        });
    }

    async sendAudio(instanceName, number, url) {
        // Na v2, o endpoint sendMedia com mediatype: 'audio' e ptt: true é o padrão para notas de voz
        return this._request(`/message/sendMedia/${instanceName}`, 'POST', {
            number: number.replace(/\D/g, ''),
            mediatype: 'audio',
            media: url,
            delay: 1200,
            ptt: true
        });
    }

    // Método v2 genérico para mídia - Argumentos Corrigidos para (..., mediaType, mediaUrl, ...)
    async sendMedia(instanceName, number, mediaType, mediaUrl, caption = '', fileName = '') {
        return this._request(`/message/sendMedia/${instanceName}`, 'POST', {
            number: number.replace(/\D/g, ''),
            mediatype: mediaType,
            media: mediaUrl,
            caption: caption,
            fileName: fileName || undefined
        });
    }

    async sendDocument(instanceName, number, url, fileName = 'documento', caption = '') {
        return this._request(`/message/sendMedia/${instanceName}`, 'POST', {
            number: number.replace(/\D/g, ''),
            mediatype: 'document',
            media: url,
            fileName,
            caption
        });
    }

    // 9. Bloquear/Desbloquear Contato
    async blockUnblockContact(instanceName, remoteJid, block = true) {
        // Remove @s.whatsapp.net para garantir compatibilidade caso a API prefira apenas o número
        const cleanNumber = remoteJid.split('@')[0].replace(/\D/g, '');

        console.log(`🚫 [Evolution] Bloqueando/Desbloqueando: ${cleanNumber} (${block ? 'block' : 'unblock'})`);

        return this._request(`/chat/blockUnblock/${instanceName}`, 'POST', {
            number: cleanNumber,
            action: block ? 'block' : 'unblock'
        });
    }

    // 10. Obter Base64 de uma mídia (Para descriptografia)
    async getMediaBase64(instanceName, messageKey) {
        // Endpoint v2: /message/getBase64/:instance
        return this._request(`/message/getBase64/${instanceName}`, 'POST', {
            key: messageKey
        });
    }
}

module.exports = EvolutionService;
