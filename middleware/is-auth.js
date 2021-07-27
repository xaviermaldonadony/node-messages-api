const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config({ path: './config.env' });
const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;

module.exports = (req, res, next) => {
	const authHeader = req.get('Authorization');
	if (!authHeader) {
		const error = new Error('Not authenticated');
		error.statusCode = 401;
		throw error;
	}
	const token = authHeader.split(' ')[1];
	let decodedToken;

	try {
		decodedToken = jwt.verify(token, JWT_SECRET_KEY);
	} catch (err) {
		err.statusCode = 500;
		throw err;
	}

	if (!decodedToken) {
		const error = new Error('Not authenticatd');

		error.statusCode = 401;
		throw error;
	}

	req.userId = decodedToken.userId;
	next();
};
