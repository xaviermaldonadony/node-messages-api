const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const dotenv = require('dotenv');

const User = require('../models/user');
dotenv.config({ path: './config.env' });

const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;

const createErr = (err) => {
	if (!err.statusCode) {
		err.statusCode = 500;
	}
};

exports.signup = (req, res, next) => {
	const errors = validationResult(req);

	if (!errors.isEmpty()) {
		const error = new Error('Validation failed.');
		error.statusCode = 422;
		error.data = errors.array();
		throw error;
	}

	const { email, name, password } = req.body;

	bcrypt
		.hash(password, 12)
		.then((hashedPwd) => {
			const user = new User({
				email,
				name,
				password: hashedPwd,
			});
			return user.save();
		})
		.then((result) => {
			res.status(201).json({ message: 'User created!', userId: result._id });
		})
		.catch((err) => {
			createErr(err);
			next(err);
		});
};

exports.login = (req, res, next) => {
	const { email, password } = req.body;
	let loadedUser;

	User.findOne({ email })
		.then((user) => {
			if (!user) {
				const error = new Error('A user with this email could not be found');
				error.statusCode = 401;
				throw error;
			}
			loadedUser = user;
			return bcrypt.compare(password, user.password);
		})
		.then((isEqual) => {
			if (!isEqual) {
				const error = new Error('Wrong password!');
				error.statusCode = 401;
				throw error;
			}
			// create token with signature
			const token = jwt.sign(
				{ email: loadedUser.email, userId: loadedUser._id.toString() },
				JWT_SECRET_KEY,
				{ expiresIn: '1h' }
			);
			res.status(200).json({ token, userId: loadedUser._id.toString() });
		})
		.catch((err) => {
			createErr(err);
			next(err);
		});
};
