import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import Task from '../models/task.js';
import auth from '../middleware/auth.js';
const router = new express.Router();

router.post('/tasks', auth, async (req, res) => {
    const task = new Task({
        ...req.body,
        owner: req.user._id
    });

    try {
        await task.save();
        res.status(201).send(task);
    } catch (e) {
        res.status(400).send(e);
    }
});

// GET /tasks?completed=<insert_boolean>
// GET /tasks?limit=<insert_number>&skip=<insert_previousNo.+limit>
// GET /tasks?sortBy=<insert_criteria>:<insert_order>
router.get('/tasks', auth, async (req, res) => {
    const match = {};
    const sort = {};

    if (req.query.completed) {
        match.completed = req.query.completed === 'true';
    }

    if (req.query.sortBy) {
        const parts = req.query.sortBy.split(':');
        sort[parts[0]] = parts[1] === 'desc' ? -1 : 1;
    }

    try {
        await req.user.populate({
            path: 'tasks',
            match,
            options: {
                limit: parseInt(req.query.limit),
                skip: parseInt(req.query.skip),
                sort
            }
        }).execPopulate();
        res.send(req.user.tasks);
    } catch (e) {
        res.status(500).send();
    }
});

router.get('/tasks/:id', auth, async (req, res) => {
    const _id = req.params.id;

    try {
        const task = await Task.findOne({ _id, owner: req.user._id });

        if (!task) {
            return res.status(404).send();
        }

        res.send(task);
    } catch (e) {
        res.status(500).send();
    }
});

router.patch('/tasks/:id', auth, async (req, res) => {
    const updates = Object.keys(req.body);
    const allowedUpdates = ['description', 'completed'];
    const isValidOperation = updates.every((update) => allowedUpdates.includes(update));

    if (!isValidOperation) {
        res.status(400).send({ error: 'Invalid Updates' });
    }

    try {
        const task = await Task.findOne({ _id: req.params.id, owner: req.user._id });

        if (!task) {
            return res.status(404).send();
        }

        updates.forEach((update) => task[update] = req.body[update]);
        await task.save();
        res.send(task);
    } catch (e) {
        res.status(400).send(e);
    }
});

router.delete('/tasks/:id', auth, async (req, res) => {
    try {
        const task = await Task.findOneAndDelete({ _id: req.params.id, owner: req.user._id });

        if (!task) {
            return res.status(404).send();
        }

        res.send(task);
    } catch (e) {
        res.status(500).send(e);
    }
});

const image = multer({
    limits: {
        fileSize: 1000000
    },
    fileFilter(req, file, cb) {
        if (!file.originalname.match(/\.(jpg|jpeg|png|svg)$/)) {
            return cb(new Error('Please upload a image file'));
        }

        cb(undefined, true);
    }
});

router.post('/tasks/:id/image', auth, image.single('image'), async (req, res) => {
    const buffer = await sharp(req.file.buffer).png().toBuffer();
    const task = await Task.findById({ _id: req.params.id });

    if (!task) {
        res.status(404).send({ error: 'Task not found!' });
    }

    task.image = buffer;
    await task.save();
    res.send();
}, (error, req, res, next) => {
    res.status(400).send({ error: error.message });
});

router.delete('/tasks/:id/image', auth, async (req, res) => {
    const task = await Task.findById({ _id: req.params.id });

    if (!task) {
        res.status(404).send({ error: 'Task not found!' });
    }

    task.image = undefined;
    await task.save();
    res.send();
}, (error, req, res, next) => {
    res.status(400).send({ error: error.message });
});

router.get('/tasks/:id/image', async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);

        if (!task || !task.image) {
            throw new Error();
        }

        res.set('Content-Type', 'image/png');
        res.send(task.image);
    } catch (e) {
        res.status(404).send();
    }
});

export default router;
