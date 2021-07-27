const path = require('path');

const express = require('express');
const cors = require('cors');
// const bodyParser  = require('body-parser')
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const multer = require('multer');

const feedRoutes = require('./routes/feed');
const authRoutes = require('./routes/auth');

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
	next();
});
app.use(cors());
app.options('*', cors);

app.use('/feed', feedRoutes);
app.use('/auth', authRoutes);

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
		const server = app.listen(8080);
		const io = require('./socket').init(server);

		io.on('connection', (socket) => {
			console.log('Client Connected');
		});
	})
	.catch((err) => {
		console.log(err);
	});

// 27, 4
