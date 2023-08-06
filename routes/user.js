const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../model/user');

const router = express.Router();

// Đăng ký người dùng mới
router.post('/register', async (req, res) => {
    try {
        const { username, password, email, fullname, numberphone } = req.body;

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(409).json({ message: 'Tên người dùng đã tồn tại' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            username,
            password: hashedPassword,
            email,
            fullname,
            numberphone,
        });

        await newUser.save();

        res.status(201).json({ message: 'Đăng ký thành công' });
    } catch (error) {
        res.status(500).json({ message: 'Đã có lỗi xảy ra' });
    }
});

// Đăng nhập
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ message: 'Tên người dùng không tồn tại' });
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            return res.status(401).json({ message: 'Mật khẩu không chính xác' });
        }

        res.status(200).json({ message: 'Đăng nhập thành công', user });
    } catch (error) {
        res.status(500).json({ message: 'Đã có lỗi xảy ra' });
    }
});
// Đổi mật khẩu
router.put('/change-password', async (req, res) => {
    try {
        const { username, oldPassword, newPassword } = req.body;

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).send('Tên người dùng không tồn tại');
        }

        const isPasswordCorrect = await bcrypt.compare(oldPassword, user.password);
        if (!isPasswordCorrect) {
            return res.status(401).send('Mật khẩu cũ không chính xác');
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedNewPassword;
        await user.save();

        res.status(200).send('Đổi mật khẩu thành công');
    } catch (error) {
        res.status(500).send('Đã có lỗi xảy ra');
    }
});

// Đổi thông tin người dùng
router.put('/change-info', async (req, res) => {
    try {
        const { username, password, email, fullname, numberphone } = req.body;

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).send('Tên người dùng không tồn tại');
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            return res.status(401).send('Mật khẩu không chính xác');
        }

        user.email = email;
        user.fullname = fullname;
        user.numberphone = numberphone;
        await user.save();

        res.status(200).send('Đổi thông tin người dùng thành công');
    } catch (error) {
        res.status(500).send('Đã có lỗi xảy ra');
    }
});

module.exports = router;
