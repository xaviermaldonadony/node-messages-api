const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const postSchema = new Schema(
	{
		title: {
			type: String,
			required: true,
		},
		imageUrl: {
			type: String,
			required: true,
		},
		content: {
			type: String,
			required: true,
		},
		creator: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
	},
	// when a new object is added
	// we get a createdAt and updatedAt
	{ timestamps: true }
);

module.exports = mongoose.model('Post', postSchema);
