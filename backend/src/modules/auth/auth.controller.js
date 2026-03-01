const authService = require('./auth.service');

const register = async (req, res) => {
    try {
        const user = await authService.register(req.body);
        res.status(201).json({ message: 'Registration successful', user });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

const login = async (req, res) => {
    try {
        const result = await authService.login(req.body);
        res.json({ message: 'Login successful', ...result });
    } catch (err) {
        res.status(401).json({ error: err.message });
    }
};

const createUser = async (req, res) => {
    try {
        const user = await authService.createUser(req.body);
        res.status(201).json({ message: 'User created', user });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

const getMe = async (req, res) => {
    try {
        const user = await authService.getMe(req.user.id);
        res.json({ user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { register, login, createUser, getMe };
