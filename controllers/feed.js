const fs = require('fs');
const path = require('path');

const { validationResult } = require('express-validator');

const io = require('../socket');
const Post = require('../models/post');
const User = require('../models/user');

const createErr = (err) => {
	if (!err.statusCode) {
		err.statusCode = 500;
	}
};

exports.getPosts = async (req, res, next) => {
	const { page: currentPage = 1 } = req.query;
	const perPage = 2;

	try {
		const totalItems = await Post.find().countDocuments();
		const posts = await Post.find()
			.populate('creator')
			.sort({ createdAt: -1 })
			.skip((currentPage - 1) * perPage)
			.limit(perPage);

		res.status(200).json({
			message: 'Fetched posts successfully.',
			posts,
			totalItems,
		});
	} catch (err) {
		createErr(err);
		next(err);
	}

	// how many docs there is
	// Post.find()
	// 	.countDocuments()
	// 	.then((count) => {
	// 		totalItems = count;
	// 		return Post.find()
	// 			.skip((currentPage - 1) * perPage)
	// 			.limit(perPage);
	// 	})
	// 	.then((posts) => {
	// 		res.status(200).json({
	// 			message: 'Fetched posts successfully.',
	// 			posts,
	// 			totalItems,
	// 		});
	// 	})
	// 	.catch((err) => {
	// 		createErr(err);
	// 		next(err);
	// 	});
};

exports.createPost = async (req, res, next) => {
	const errors = validationResult(req);
	const { title, content } = req.body;

	if (!errors.isEmpty()) {
		const error = new Error('Validation failed, entered data is incorrect');
		error.statusCode = 422;
		throw error;
	}

	if (!req.file) {
		const error = new Error('No Image provided');
		error.statusCode = 422;
		throw error;
	}

	const imageUrl = req.file.path;
	const post = new Post({
		title,
		content,
		imageUrl,
		creator: req.userId,
	});

	try {
		// Create post in db
		await post.save();
		const user = await User.findById(req.userId);
		// save post under user/owner
		user.posts.push(post);
		// inform all users of post
		io.getIO().emit('posts', {
			action: 'create',
			post: { ...post._doc, creator: { _id: req.userId, name: user.name } },
		});
		await user.save();
		res.status(201).json({
			message: 'Post created successfully',
			post,
			creator: { _id: user._id, name: user.name },
		});
	} catch (err) {
		createErr(err);
		next(err);
	}
	// let creator;
	// post
	// 	.save()
	// 	.then((result) => {
	// 		// console.log(result);
	// 		return User.findById(req.userId);
	// 	})
	// 	.then((user) => {
	// 		creator = user;
	// 		user.posts.push(post);
	// 		return user.save();
	// 	})
	// 	.then((result) => {
	// 		res.status(201).json({
	// 			message: 'Post created successfully',
	// 			post,
	// 			creator: { _id: creator._id, name: creator.name },
	// 		});
	// 	})
	// 	.catch((err) => {
	// 		createErr(err);
	// 		next(err);
	// 	});
};

exports.getPost = (req, res, next) => {
	const { postId } = req.params;

	Post.findById(postId)
		.then((post) => {
			if (!post) {
				const error = new Error('Could not find post.');
				error.statusCode = 404;
				// if throw an error the catch will handle it
				throw error;
			}
			res.status(200).json({ message: 'Post fetched', post });
		})
		.catch((err) => {
			createErr(err);
			next(err);
		});
};

exports.updatePost = async (req, res, next) => {
	const { postId } = req.params;
	const { title, content } = req.body;
	let imageUrl = req.body.image;
	const errors = validationResult(req);

	if (!errors.isEmpty()) {
		const error = new Error('Validation failed, entered data is incorrect');
		error.statusCode = 422;
		throw error;
	}

	if (req.file) {
		imageUrl = req.file.path;
	}
	// imageUrl not set from above assignments
	if (!imageUrl) {
		const error = new Error('No file picked.');
		error.statusCode = 422;
		throw error;
	}

	try {
		// gets the creator id and get the user by that id
		const post = await Post.findById(postId).populate('creator');
		if (!post) {
			const error = new Error('Could not find post.');
			error.statusCode = 404;
			// if throw an error the catch will handle it
			throw error;
		}

		if (post.creator._id.toString() !== req.userId) {
			const error = new Error('Not authorized');
			error.statusCode = 403;
			throw error;
		}

		if (imageUrl !== post.imageUrl) {
			clearImage(post.imageUrl);
		}
		post.title = title;
		post.imageUrl = imageUrl;
		post.content = content;

		const result = await post.save();
		io.getIO().emit('posts', { action: 'update', post: result });
		res.status(200).json({ message: 'Post updated!', post: result });
	} catch (err) {
		createErr(err);
		next(err);
	}

	// Post.findById(postId)
	// 	.then((post) => {
	// 		if (!post) {
	// 			const error = new Error('Could not find post.');
	// 			error.statusCode = 404;
	// 			// if throw an error the catch will handle it
	// 			throw error;
	// 		}

	// 		if (post.creator.toString() !== req.userId) {
	// 			const error = new Error('Not authorized');
	// 			error.statusCode = 403;
	// 			throw error;
	// 		}

	// 		if (imageUrl !== post.imageUrl) {
	// 			clearImage(post.imageUrl);
	// 		}
	// 		post.title = title;
	// 		post.imageUrl = imageUrl;
	// 		post.content = content;
	// 		return post.save();
	// 	})
	// 	.then((result) => {
	// 		res.status(200).json({ message: 'Post updated!', post: result });
	// 	})
	// 	.catch((err) => {
	// 		createErr(err);
	// 		next(err);
	// 	});
};

exports.deletePost = async (req, res, next) => {
	const { postId } = req.params;

	try {
		const post = await Post.findById(postId);

		if (!post) {
			const error = new Error('Could not find post.');
			error.statusCode = 404;
			// if throw an error the catch will handle it
			throw error;
		}
		// checked logged in user owns the post
		if (post.creator.toString() !== req.userId) {
			const error = new Error('Not authorized');
			error.statusCode = 403;
			throw error;
		}

		clearImage(post.imageUrl);
		await Post.findByIdAndRemove(postId);

		const user = await User.findById(req.userId);
		user.posts.pull(postId);
		await user.save();

		io.getIO().emit('posts', { action: 'delete', post: postId });

		res.status(200).json({ message: 'Deleted Post.' });
	} catch (err) {
		createErr(err);
		next(err);
	}
	// Post.findById(postId
	// 	.then((post) => {
	// 		if (!post) {
	// 			console.log('if !post');
	// 			const error = new Error('Could not find post.');
	// 			error.statusCode = 404;
	// 			// if throw an error the catch will handle it
	// 			throw error;
	// 		}
	// 		// checked logged in user owns the post
	// 		if (post.creator.toString() !== req.userId) {
	// 			const error = new Error('Not authorized');
	// 			error.statusCode = 403;
	// 			throw error;
	// 		}

	// 		clearImage(post.imageUrl);
	// 		return Post.findByIdAndRemove(postId);
	// 	})
	// 	.then((result) => {
	// 		return User.findById(req.userId);
	// 	})
	// 	.then((user) => {
	// 		user.posts.pull(postId);
	// 		return user.save();
	// 	})
	// 	.then((result) => {
	// 		res.status(200).json({ message: 'Deleted Post.' });
	// 	})
	// 	.catch((err) => {
	// 		createErr(err);
	// 		next(err);
	// 	});
};

const clearImage = (filePath) => {
	filePath = path.join(__dirname, '..', filePath);
	fs.unlink(filePath, (err) => console.log(err));
};
