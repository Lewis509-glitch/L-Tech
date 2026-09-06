import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import multer from 'multer';
import { GridFSBucket, MongoClient, ObjectId } from 'mongodb';

const app = express();
const port = Number(process.env.PORT || 3000);
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5500';
const mongoUri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB_NAME || 'ltech';

if (!mongoUri) {
    throw new Error('MONGODB_URI is required. Copy server/.env.example to server/.env and set it.');
}

const mongoClient = new MongoClient(mongoUri, {
    maxPoolSize: 20,
    minPoolSize: 0,
    maxIdleTimeMS: 300000,
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 30000
});

let database;
let imageBucket;
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_request, file, callback) => {
        callback(null, ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.mimetype));
    }
});

const isValidId = (value) => ObjectId.isValid(value);
const getPostCollection = () => database.collection('posts');

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' });
});

app.get('/api/blogs', async (_request, response, next) => {
    try {
        const posts = await getPostCollection().find({}).sort({ createdAt: -1 }).limit(100).toArray();
        response.json(posts);
    } catch (error) {
        next(error);
    }
});

app.post('/api/blogs', upload.single('image'), async (request, response, next) => {
    try {
        const { author, title, body } = request.body;
        if (!author?.trim() || !title?.trim() || !body?.trim()) {
            return response.status(400).json({ error: 'Author, title, and body are required.' });
        }

        let imageId = null;
        if (request.file) {
            const uploadStream = imageBucket.openUploadStream(request.file.originalname, {
                contentType: request.file.mimetype,
                metadata: { uploadedBy: author.trim() }
            });
            await new Promise((resolve, reject) => {
                uploadStream.once('finish', resolve);
                uploadStream.once('error', reject);
                uploadStream.end(request.file.buffer);
            });
            imageId = uploadStream.id;
        }

        const post = {
            author: author.trim().slice(0, 60),
            title: title.trim().slice(0, 120),
            body: body.trim().slice(0, 3000),
            imageId,
            likes: 0,
            comments: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const result = await getPostCollection().insertOne(post);
        response.status(201).json({ ...post, _id: result.insertedId });
    } catch (error) {
        next(error);
    }
});

app.get('/api/images/:id', async (request, response, next) => {
    try {
        if (!isValidId(request.params.id)) return response.status(400).json({ error: 'Invalid image id.' });
        const image = await database.collection('fs.files').findOne({ _id: new ObjectId(request.params.id) });
        if (!image) return response.status(404).json({ error: 'Image not found.' });
        response.type(image.contentType || 'application/octet-stream');
        imageBucket.openDownloadStream(image._id).on('error', next).pipe(response);
    } catch (error) {
        next(error);
    }
});

app.post('/api/blogs/:id/like', async (request, response, next) => {
    try {
        if (!isValidId(request.params.id)) return response.status(400).json({ error: 'Invalid post id.' });
        const postId = new ObjectId(request.params.id);
        const result = await getPostCollection().findOneAndUpdate(
            { _id: postId },
            { $inc: { likes: 1 }, $set: { updatedAt: new Date() } },
            { returnDocument: 'after' }
        );
        if (!result) return response.status(404).json({ error: 'Post not found.' });
        response.json(result);
    } catch (error) {
        next(error);
    }
});

app.post('/api/blogs/:id/comments', async (request, response, next) => {
    try {
        if (!isValidId(request.params.id)) return response.status(400).json({ error: 'Invalid post id.' });
        const { author, text } = request.body;
        if (!author?.trim() || !text?.trim()) return response.status(400).json({ error: 'Author and comment text are required.' });
        const comment = { _id: new ObjectId(), author: author.trim().slice(0, 60), text: text.trim().slice(0, 240), createdAt: new Date() };
        const result = await getPostCollection().findOneAndUpdate(
            { _id: new ObjectId(request.params.id) },
            { $push: { comments: comment }, $set: { updatedAt: new Date() } },
            { returnDocument: 'after' }
        );
        if (!result) return response.status(404).json({ error: 'Post not found.' });
        response.json(result);
    } catch (error) {
        next(error);
    }
});

app.post('/api/blogs/:id/share', async (request, response, next) => {
    try {
        if (!isValidId(request.params.id)) return response.status(400).json({ error: 'Invalid post id.' });
        const result = await getPostCollection().findOneAndUpdate(
            { _id: new ObjectId(request.params.id) },
            { $inc: { shares: 1 }, $set: { updatedAt: new Date() } },
            { returnDocument: 'after' }
        );
        if (!result) return response.status(404).json({ error: 'Post not found.' });
        response.json(result);
    } catch (error) {
        next(error);
    }
});

app.use((error, _request, response, _next) => {
    if (error instanceof multer.MulterError || error.message === 'Unexpected field') {
        return response.status(400).json({ error: 'Use a supported image smaller than 5 MB.' });
    }
    console.error(error);
    response.status(500).json({ error: 'Something went wrong on the server.' });
});

try {
    await mongoClient.connect();
    database = mongoClient.db(databaseName);
    imageBucket = new GridFSBucket(database, { bucketName: 'blogImages' });
    await getPostCollection().createIndex({ createdAt: -1 });
    app.listen(port, () => console.log(`L-Tech blog API listening on http://localhost:${port}`));
} catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exitCode = 1;
}

const close = async () => {
    await mongoClient.close();
    process.exit(0);
};
process.on('SIGINT', close);
process.on('SIGTERM', close);
