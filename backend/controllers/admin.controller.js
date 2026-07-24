const amdinService = require('../services/app_Service/admin.sevice')



exports.createUser = async (req, res) => {
    const { username, tempPassword } = req.body;
    await adminService.createUser(username, tempPassword);
    res.json({ message: "Utilisateur créé." });
    
};


exports.resetPassword = async (req, res) => {
    const { username, newTempPassword } = req.body;

    await adminService.resetPassword(username, newTempPassword);

    res.json({ message: "Mot de passe modifié." });
};