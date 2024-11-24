const express = require('express');
const app = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config();

function checkSignIn(req, res, next) {
    try {
        const secret = process.env.TOKEN_SECRET;
        const token = req.headers['authorization'];
        const result = jwt.verify(token, secret);

        if (result != undefined) {
            next();
        }
    } catch (e) {
        res.status(500).send({ error: e.message });
    }
}

function getUserId(req, res) {
    try {
        const secret = process.env.TOKEN_SECRET;
        const token = req.headers['authorization'];
        const result = jwt.verify(token, secret);

        if (result != undefined) {
            return result.id;
        }
    } catch (e) {
        res.status(500).send({ error: e.message });
    }
}

app.post('/signIn', async (req, res) => {
    try {
        if (req.body.user == undefined || req.body.pass == undefined) {
            return res.status(401).send('unauthorized');
        }

        const user = await prisma.user.findFirst({
            select: {
                id: true,
                name: true
            },
            where: {
                user: req.body.user,
                pass: req.body.pass,
                status: 'use'
            }
        })

        if (user != null) {
            const secret = process.env.TOKEN_SECRET;
            const token = jwt.sign(user, secret, { expiresIn: '30d' });

            return res.send({ token: token })
        }

        res.status(401).send({ message: 'unauthorized' });
    } catch (e) {
        res.status(500).send({ error: e.message })
    }
})

app.get('/info', checkSignIn, async (req, res, next) => {
    try {
        const userId = getUserId(req, res)
        const user = await prisma.user.findFirst({
            select: {
                name: true
            },
            where: {
                id: userId
            }
        })

        res.send({ result: user });
    } catch (e) {
        res.status(500).send({ error: e.message })
    }
})

app.post('/register', async (req, res) => {
    const { fullname, lastname, phone, email, username, password, confirmPassword } = req.body;

    try {
        // Validate input fields
        if (!fullname || !lastname || !phone || !email || !username || !password || !confirmPassword) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        // Check if passwords match
        if (password !== confirmPassword) {
            return res.status(400).json({ message: 'Passwords do not match.' });
        }

        // Check if the email or username already exists
        const existingUser = await prisma.customer.findFirst({
            where: {
                OR: [{ email }, { username }],
            },
        });

        if (existingUser) {
            return res.status(400).json({ message: 'Email or Username already exists.' });
        }

        // Hash the password with bcrypt
        const salt = await bcrypt.genSalt(10); // Generate a salt
        const hashedPassword = await bcrypt.hash(password, salt);

        // Save user to the database
        const user = await prisma.customer.create({
            data: {
                fullname,
                lastname,
                phone,
                email,
                username,
                password: hashedPassword,
            },
        });

        // Respond with success
        res.status(201).json({ message: 'User registered successfully!', user: { id: user.id, username: user.username } });
    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

app.post('/sign-in', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password are required.' });
        }

        // Find the user in the database
        const user = await prisma.customer.findUnique({
            where: { username },
            select: {
                id: true,
                username: true,
                password: true // Include the password for comparison
            },
        });

        if (!user) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }

        // Verify the hashed password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }

        // Generate a JWT token
        const secret = process.env.TOKEN_SECRET;
        const token = jwt.sign(
            { id: user.id, username: user.username },
            secret,
            { expiresIn: '1d' } // Token expires in 1 day
        );

        // Return the token and user information
        res.status(200).json({
            token,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
            },
        });
    } catch (error) {
        console.error('Error during sign-in:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

app.get('/data', checkSignIn, async (req, res) => {
    try {
        const token = req.headers['authorization'];
        const decoded = jwt.verify(token, process.env.TOKEN_SECRET);

        const user = await prisma.customer.findUnique({
            where: { 
                id: decoded.id 
            },
            select: { 
                fullname: true 
            }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({ fullname: user.fullname });
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});



module.exports = app;
