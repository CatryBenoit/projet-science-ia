const amdinService = require('../services/admin.sevice')







exports.resetPassword = async (req, res) => {
    const { username, newTempPassword } = req.body;

    await userService.resetPassword(username, newTempPassword);

    res.json({ message: "Mot de passe modifié." });
};