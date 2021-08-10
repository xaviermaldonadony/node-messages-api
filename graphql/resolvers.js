const bcrypt = require('bcryptjs');
const validator = require('validator');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

dotenv.config({ path: './config.env' });

const User = require('../models/user');
const Post = require('../models/post');
const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY;
const { clearImage } = require('../util/file');

const isAuth = (auth) => {
	if (!auth) {
		const error = new Error('Not authenticated.');
		error.code = 401;
		throw error;
	}
};

module.exports = {
	createUser: async function ({ userInput }, req) {
		// const { email } = userInput
		const errors = [];

		if (!validator.isEmail(userInput.email)) {
			errors.push({ message: 'Email is invalid' });
		}
		if (
			validator.isEmpty(userInput.password) ||
			!validator.isLength(userInput.password, { min: 5 })
		) {
			errors.push({ message: 'Password too short!' });
		}
		if (errors.length > 0) {
			const error = new Error('Invalid input.');
			error.data = errors;
			error.code = 422;
			throw error;
		}

		const existingUser = await User.findOne({ email: userInput.email });
		if (existingUser) {
			const error = new Error('User exists already');
			throw error;
		}

		const hashedPwd = await bcrypt.hash(userInput.password, 12);
		const user = new User({
			email: userInput.email,
			name: userInput.name,
			password: hashedPwd,
		});
		const createdUser = await user.save();
		return { ...createdUser._doc, _id: createdUser._id.toString() };
	},

	login: async function ({ email, password }) {
		const user = await User.findOne({ email });
		// user not found
		if (!user) {
			const error = new Error('User not found.');
			error.code = 401;
			throw error;
		}
		// user exists
		const isEqual = await bcrypt.compare(password, user.password);
		// user pwd not equal
		if (!isEqual) {
			const error = new Error('Password is incorrect.');
			error.code = 401;
			throw error;
		}

		console.log('before token');
		const token = jwt.sign(
			{
				userId: user._id.toString(),
				email: user.email,
			},
			JWT_SECRET_KEY,
			{ expiresIn: '1h' }
		);
		return { token, userId: user._id.toString() };
	},

	createPost: async function ({ postInput }, req) {
		isAuth(req.isAuth);
		const errors = [];

		if (
			validator.isEmpty(postInput.title) ||
			!validator.isLength(postInput.title, { min: 5 })
		) {
			errors.push({ message: 'Title is invalid.' });
		}
		if (
			validator.isEmpty(postInput.content) ||
			!validator.isLength(postInput.content, { min: 5 })
		) {
			errors.push({ message: 'Content is Invalid.' });
		}
		if (errors.length > 0) {
			const error = new Error('Invalid input.');
			error.data = errors;
			error.code = 422;
			throw error;
		}

		const user = await User.findById(req.userId);
		if (!user) {
			const error = new Error('Invalid user.');
			error.data = errors;
			error.code = 401;
			throw error;
		}

		// input is valid, create post
		const post = new Post({
			title: postInput.title,
			content: postInput.content,
			imageUrl: postInput.imageUrl,
			creator: user,
		});
		const createdPost = await post.save();
		// Add post to user's posts
		user.posts.push(createdPost);
		await user.save();

		return {
			...createdPost._doc,
			_id: createdPost._id.toString(),
			createdAt: createdPost.createdAt.toISOString(),
			updatedAt: createdPost.updatedAt.toISOString(),
		};
	},

	posts: async ({ page }, req) => {
		isAuth(req.isAuth);

		if (!page) {
			page = 1;
		}

		const perPage = 2;
		const totalPosts = await Post.find().countDocuments();
		let posts = await Post.find()
			.sort({ createdAt: -1 })
			.skip((page - 1) * perPage)
			.limit(perPage)
			.populate('creator');

		posts = posts.map((p) => ({
			...p._doc,
			_id: p._id.toString(),
			createdAt: p.createdAt.toISOString(),
			updatedAt: p.updatedAt.toISOString(),
		}));

		return { posts, totalPosts };
	},

	post: async ({ id }, req) => {
		isAuth(req.isAuth);

		const post = await Post.findById(id).populate('creator');
		if (!post) {
			const error = new Error('No post found.');
			error.code = 404;
			throw error;
		}

		return {
			...post._doc,
			_id: post._id.toString(),
			createdAt: post.createdAt.toISOString(),
			updatedAt: post.updatedAt.toISOString(),
		};
	},

	updatePost: async function ({ id, postInput }, req) {
		isAuth(req.isAuth);

		const post = await Post.findById(id).populate('creator');
		const errors = [];

		if (!post) {
			const error = new Error('No post found.');
			error.code = 404;
			throw error;
		}

		if (post.creator._id.toString() !== req.userId.toString()) {
			const error = new Error('Not authorized!');
			error.code = 403;
			throw error;
		}

		// validation
		if (
			validator.isEmpty(postInput.title) ||
			!validator.isLength(postInput.title, { min: 5 })
		) {
			errors.push({ message: 'Title is invalid.' });
		}
		if (
			validator.isEmpty(postInput.content) ||
			!validator.isLength(postInput.content, { min: 5 })
		) {
			errors.push({ message: 'Content is Invalid.' });
		}
		if (errors.length > 0) {
			const error = new Error('Invalid input.');
			error.data = errors;
			error.code = 422;
			throw error;
		}

		post.title = postInput.title;
		post.content = postInput.content;

		if (postInput.imageUrl !== 'undefined') {
			post.imageUrl = postInput.imageUrl;
		}

		const updatedPost = await post.save();
		return {
			...updatedPost._doc,
			_id: updatedPost._id.toString(),
			createdAt: updatedPost.createdAt.toISOString(),
			updatedAt: updatedPost.updatedAt.toISOString(),
		};
	},

	deletePost: async function ({ id }, req) {
		isAuth(req.isAuth);
		const post = await Post.findById(id);

		if (!post) {
			const error = new Error('No post found.');
			error.code = 404;
			throw error;
		}

		if (post.creator.toString() !== req.userId.toString()) {
			const error = new Error('Not authorized!');
			error.code = 403;
			console.log('second if');
			throw error;
		}

		clearImage(post.imageUrl);
		await Post.findByIdAndRemove(id);
		const user = await User.findById(req.userId);
		user.posts.pull(id);
		await user.save();

		return true;
	},

	user: async (args, req) => {
		isAuth(req.isAuth);

		const user = await User.findById(req.userId);
		if (!user) {
			const error = new Error('No user found.');
			error.code = 404;
			throw error;
		}
		return { ...user._doc, _id: user._id.toString() };
	},
	updateStatus: async ({ status }, req) => {
		isAuth(req.isAuth);
		const user = await User.findById(req.userId);
		if (!user) {
			const error = new Error('No user found.');
			error.code = 404;
			throw error;
		}
		user.status = status;
		await user.save();
		return {
			...user._doc,
			_id: user._id.toString(),
		};
	},
};
