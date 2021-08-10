const path = require('path');

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const multer = require('multer');
const { graphqlHTTP } = require('express-graphql');

const graphqlSchema = require('./graphql/schema.js');
const graphqlResolver = require('./graphql/resolvers');
const auth = require('./middleware/auth');
const { clearImage } = require('./util/file');

const app = express();

const fileStorage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, 'images');
	},
	filename: (req, file, cb) => {
		// cb(null, `${new Date().toISOString()}-${file.originalname}`);
		cb(null, new Date().toISOString() + '-' + file.originalname);
	},
});

const fileFilter = (req, file, cb) => {
	if (
		file.mimetype === 'image/png' ||
		file.mimetype === 'image/jpeg' ||
		file.mimetype === 'image/jpg' ||
		file.mimetype === 'image/jfif'
	) {
		cb(null, true);
	} else {
		cb(null, false);
	}
};

// app.use(express.urlencoded()); // www-form-urlencoded
app.use(express.json()); // application/json
app.use(
	multer({ storage: fileStorage, fileFilter: fileFilter }).single('image')
);
app.use('/images', express.static(path.join(__dirname, 'images')));

app.use((req, res, next) => {
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader(
		'Access-Control-Allow-Methods',
		'OPTIONS, GET, POST, PUT, PATCH, DELETE'
	);
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
	if (req.method === 'OPTIONS') {
		return res.sendStatus(200);
	}
	next();
});
app.use(cors());
app.options('*', cors);

app.use(auth);

app.put('/post-image', (req, res, next) => {
	if (!req.isAuth) {
		throw new Error('Not authenticated!');
	}
	if (!req.file) {
		return res.status(200).json({ message: 'No file provided' });
	}
	if (req.body.oldPath) {
		clearImage(req.body.oldPath);
	}

	return res
		.status(201)
		.json({ messge: 'File stored.', filePath: req.file.path });
});

app.use(
	'/graphql',
	graphqlHTTP({
		schema: graphqlSchema,
		rootValue: graphqlResolver,
		graphiql: true,
		customFormatErrorFn(err) {
			if (!err.originalError) {
				return err;
			}
			const { data, code = 500 } = err.originalError;
			const { message = 'An error occurred' } = err;
			return {
				message,
				status: code,
				data,
			};
		},
	})
);

// error
app.use((error, req, res, next) => {
	console.log(error);
	// default value for status
	const { statusCode: status = 500, message, data } = error;
	res.status(status).json({ message, data });
});

dotenv.config({ path: './config.env' });
const DB = process.env.DATABASE.replace(
	'<PASSWORD>',
	process.env.DATABASE_PASSWORD
);

mongoose
	.connect(DB, {
		useNewUrlParser: true,
		useUnifiedTopology: true,
		useFindAndModify: false,
	})
	.then((result) => {
		app.listen(8080);
	})
	.catch((err) => {
		console.log(err);
	});
