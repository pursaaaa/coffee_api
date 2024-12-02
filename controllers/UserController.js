const express = require('express');
const app = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer')

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

function sendmail(toemail, subject, html) {
    const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com', //simple mail tranfer protocal
        service: 'gmail',
        auth: {
            user: 'outhailnw@gmail.com',   // your email
            pass: 'jqwe ptdn qjep gcfs'    // app password from gmail
        }
    });

    // send mail with defined transport object
    let mailOptions = {
        from: '"Coffee Shop" <coffee.shop5768@gmail.com>',  // sender address
        to: toemail,    // list of receivers
        subject: subject,   // Subject line
        html: html     // html mail body
    };

    // send mail with defined transport object
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log(error);
            res.send('เกิดข้อผิดพลาด ไม่สามารถส่งอีเมลได้ โปรดลองใหม่ภายหลัง');
        }
        else {
            console.log("Send email successful");
        }
    });
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

app.post('/forgetPassword', async (req, res) => {
    const { email } = req.body;

    try {
        const user = await prisma.customer.findUnique({
            where: {
                email: email
            }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found!' });
        }

        // Generate a random password
        let randomPassword = Math.random().toString(36).substring(2, 10);

        // Hash the random password using bcrypt
        const salt = await bcrypt.genSalt(10); // You can increase the salt rounds for stronger encryption
        const hashedPassword = await bcrypt.hash(randomPassword, salt);

        // Update the user's password in the database
        await prisma.customer.update({
            where: { 
                email: email 
            },
            data: { 
                password: hashedPassword 
            }
        });

        // Send email with the new password
        const subject = "รหัสผ่านของคุณมีการเปลี่ยนแปลง";
        const html = `
            สวัสดี คุณ ${user.email}<br><br>
            &nbsp;&nbsp;รหัสผ่านเว็บไซต์ CoffeeShop ของคุณมีการเปลี่ยนแปลงตามที่คุณร้องขอ<br>
            รหัสผ่านใหม่ของคุณ คือ &nbsp;${randomPassword}<br>
            ให้ใช้รหัสผ่านนี้ในการเข้าสู่ระบบ และคุณสามารถเปลี่ยนแปลงรหัสผ่านของคุณได้หลังจากเข้าสู่ระบบแล้ว<br><br><br>
            ขอบคุณ<br>NodeLoginX
        `;
        sendmail(user.email, subject, html);

        res.status(200).json({ message: 'รีเซ็ตรหัสผ่านสำเร็จ โปรดตรวจสอบกล่องข้อความภายในอีเมล' });

    } catch (e) {
        console.error(e.message);
        res.status(500).send({ error: e.message });
    }
});

app.post('/checkEmail', async (req, res) => {
    const { email } = req.body;

    try {
        const user = await prisma.customer.findUnique({
            where: {
                email: email
            }
        });

        if (!user) {
            return res.status(404).json({ message: 'ไม่พบอีเมลนี้ในระบบ' });
        }

        res.status(200).json({ message: 'Email found!' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


app.get('/data', checkSignIn, async (req, res) => {
    try {
        const userId = getUserId(req, res);

        const user = await prisma.customer.findUnique({
            where: {
                id: userId
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
