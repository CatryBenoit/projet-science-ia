const userModel = require('../../Models/user.model');
const bcrypt = require('bcrypt');


exports.createUser = async (username, password) => {
    const hash = await bcrypt.hash(password, 10);

    return userModel.create(username, hash);
};

exports.resetPassword = async (username, password) => {
    const hash = await bcrypt.hash(password, 10);

    return userModel.updatePassword(username, hash);
};


module.exports = resetPassword;