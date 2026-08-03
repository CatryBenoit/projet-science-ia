const SettingsModel = require('../../Models/settings.model');

class SettingsService {
    
    static async getSettings() {
        const settings = await SettingsModel.getSettings();
        
        // Valeurs par défaut sécurisées si la BDD est vierge
        return settings || { 
            api_key: '', 
            ai_model: 'meta/llama-3.1-70b-instruct', // Correction de la syntaxe NVIDIA
            api_base_url: 'https://integrate.api.nvidia.com/v1',
            max_iterations: 2
        };
    }

    static async saveSettings(data) {
        // Nettoyage et vérification des valeurs avant l'envoi en BDD
        const api_key = data.api_key || '';
        const ai_model = data.ai_model || 'meta/llama-3.1-70b-instruct';
        const api_base_url = data.api_base_url || 'https://integrate.api.nvidia.com/v1';
        const max_iterations = parseInt(data.max_iterations) || 2;

        await SettingsModel.saveSettings(api_key, ai_model, api_base_url, max_iterations);
    }
}

module.exports = SettingsService;