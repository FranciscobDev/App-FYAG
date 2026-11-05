const jwt = require('jsonwebtoken');

const verificarToken = (req, res, next) => {
    const encabezado = req.headers.authorization || '';
    const token = encabezado.startsWith('Bearer ') ? encabezado.slice(7) : null;

    if (!token) {
        return res.status(401).json({ mensaje: 'Debes iniciar sesión' });
    }

    try {
        req.usuario = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ mensaje: 'La sesión expiró o no es válida' });
    }
};

module.exports = verificarToken;