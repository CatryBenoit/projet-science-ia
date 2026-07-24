const axios = require('axios');
const Logger = require('../app_Service/logger.service');

class ClinicalTrialsService {
    static async search(query, limit = 5) {
        try {
            Logger.log(`[ClinicalTrials] Recherche d'essais cliniques pour "${query}"...`);
            const url = `https://clinicaltrials.gov/api/v2/studies?query.term=${encodeURIComponent(query)}&pageSize=${limit}`;
            const response = await axios.get(url, { timeout: 15000 });
            
            const studies = response.data?.studies || [];
            return studies.map(study => {
                const protocol = study.protocolSection;
                const nctId = protocol?.identificationModule?.nctId;
                return {
                    id: `ctgov_${nctId}`,
                    title: protocol?.descriptionModule?.briefSummary || protocol?.identificationModule?.briefTitle || 'Essai Clinique',
                    abstract: protocol?.descriptionModule?.detailedDescription || protocol?.descriptionModule?.briefSummary || "Aucun détail disponible.",
                    published_date: protocol?.statusModule?.startDateStruct?.date || 'En cours',
                    source: 'ClinicalTrials.gov',
                    oa_url: `https://clinicaltrials.gov/study/${nctId}`,
                    doi: null
                };
            });
        } catch (error) {
            Logger.log(`⚠️ [ClinicalTrials] Erreur : ${error.message}`);
            return [];
        }
    }
}
module.exports = ClinicalTrialsService;