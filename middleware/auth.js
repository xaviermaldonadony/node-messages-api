const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config({ path: './config.env' });
const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;

module.exports = (req, res, next) => {
	const authHeader = req.get('Authorization');

	if (!authHeader) {
		req.isAuth = false;
		return next();
	}

	const token = authHeader.split(' ')[1];
	let decodedToken;

	try {
		decodedToken = jwt.verify(token, JWT_SECRET_KEY);
	} catch (err) {
		req.isAuth = false;
		return next();
	}

	if (!decodedToken) {
		req.isAuth = false;
		return next();
	}

	req.userId = decodedToken.userId;
	req.isAuth = true;
	next();
};
