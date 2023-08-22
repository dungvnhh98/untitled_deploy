const express = require('express');
const Order = require('../models/order');
const SubOrder = require('../models/suborder');
const Promotion = require('../models/promotion');
const Product = require('../models/product');
const User = require('../models/user');
const router = express.Router();

router.post('/create', async (req, res) => {
    try {
        const {iduser, idpromotion, products} = req.body;

        const newOrder = new Order({
            iduser,
            idpromotion,
            status: 'pending',
        });

        let promotion = null;

        if (idpromotion !== null && idpromotion !== "") {
            promotion = await Promotion.findById(idpromotion);
            if (!promotion) {
                return res.status(200).json({message: 'Không tìm thấy khuyến mãi', result: false});
            }
        }

        let totalOriginalPrice = 0;

        console.log(products)

        // Tạo các đơn hàng nhỏ và tính tổng giá trị
        for (const product of products) {
            const productInfo = await Product.findById(product.idproduct);

            if (!productInfo) {
                return res.status(200).json({
                    message: `Không tìm thấy sản phẩm với id ${product.idproduct}`,
                    result: false,
                });
            }

            const subOrder = new SubOrder({
                idorder: newOrder._id,
                idproduct: product.idproduct,
                price: productInfo.price,
                quantity: product.quantity,
                size: product.size
            });

            await subOrder.save();

            totalOriginalPrice += productInfo.price * product.quantity;

            // update lượt bán và số lượng của sản phẩm
            productInfo.soldCount += product.quantity;
            productInfo.quantity -= product.quantity;
            await productInfo.save();
        }

        newOrder.originalPrice = totalOriginalPrice;

        if (promotion !== null && totalOriginalPrice >= promotion.orderValueCondition) {
            if (promotion.discountType === 'percent') {
                newOrder.discountedPrice = totalOriginalPrice - totalOriginalPrice * promotion.discountValue / 100;
            } else {
                newOrder.discountedPrice = totalOriginalPrice - promotion.discountValue;
            }
        } else {
            newOrder.discountedPrice = totalOriginalPrice;
            newOrder.idpromotion = null;
        }

        await newOrder.save();

        res.status(201).json({message: 'Đơn hàng đã được tạo thành công', order: newOrder, result: true});
    } catch (error) {
        res.status(500).json({message: 'Đã có lỗi xảy ra', error: error.message, result: false});
        console.log(error)
    }
});

router.get('/getall', async (req, res) => {
    try {
        const orders = await Order.find()
            .populate('iduser idpromotion')
            .sort({createdAt: -1}) // Sắp xếp theo trường createdAt, đảo ngược (mới nhất đầu tiên)
            .exec();

        res.status(200).json({orders, result: true});
    } catch (error) {
        res.status(500).json({message: 'Đã có lỗi xảy ra', result: false});
    }
});
router.get('/orders/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const orders = await Order.find({iduser: userId}).populate('iduser idpromotion').exec();
        res.status(200).json({orders, result: true});
    } catch (error) {
        res.status(500).json({message: 'Đã có lỗi xảy ra', result: false});
    }
});

router.get('/suborders/:orderId', async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const subOrders = await SubOrder.find({idorder: orderId}).populate('idproduct').exec();
        res.status(200).json({subOrders, result: true});
    } catch (error) {
        res.status(500).json({message: 'Đã có lỗi xảy ra', result: false});
    }
});

router.get('/revenue', async (req, res) => {
    try {
        const revenue = await Order.aggregate([
            {$match: {status: 'confirmed'}}, // Chỉ tính doanh thu từ các đơn hàng đã xác nhận
            {$group: {_id: null, totalRevenue: {$sum: "$discountedPrice"}}}
        ]);

        if (revenue.length > 0) {
            res.status(200).json({totalRevenue: revenue[0].totalRevenue, result: true});
        } else {
            res.status(200).json({totalRevenue: 0, result: true}); // Không có đơn hàng xác nhận
        }
    } catch (error) {
        res.status(500).json({message: 'Đã có lỗi xảy ra', result: false});
    }
});

router.get('/revenue-by-month', async (req, res) => {
    try {
        const revenueByMonth = await Order.aggregate([
            {$match: {status: 'confirmed'}}, // Chỉ tính doanh thu từ các đơn hàng đã xác nhận
            {
                $group: {
                    _id: {$month: "$createdAt"}, // Nhóm theo tháng
                    totalRevenue: {$sum: "$discountedPrice"} // Tính tổng doanh thu cho mỗi tháng
                }
            },
            {$sort: {_id: 1}} // Sắp xếp theo tháng tăng dần
        ]);

        res.status(200).json({revenueByMonth, result: true});
    } catch (error) {
        res.status(500).json({message: 'Đã có lỗi xảy ra', result: false});
    }
});

router.put('/update-status/:orderId', async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const {status} = req.body;

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({message: 'Không tìm thấy đơn hàng', result: false});
        }

        order.status = status;
        await order.save();

        res.status(200).json({message: 'Trạng thái đơn hàng đã được cập nhật', order, result: true});
    } catch (error) {
        res.status(500).json({message: 'Đã có lỗi xảy ra', error: error.message, result: false});
    }
});
router.post('/revenue', async (req, res) => {
    try {
        const { fromDate, toDate } = req.body;

        const fromDateObj = new Date(fromDate);
        const toDateObj = new Date(toDate);

        const orders = await Order.find({
            createdAt: {
                $gte: fromDateObj,
                $lte: toDateObj,
            },
            status: 'delivered', // You may adjust the status as needed
        });

        let totalRevenue = 0;
        for (const order of orders) {
            totalRevenue += order.discountedPrice || order.originalPrice;
        }

        res.status(200).json({ totalRevenue, result: true });
    } catch (error) {
        res.status(500).json({ message: 'Đã có lỗi xảy ra', error: error.message, result: false });
    }
});
module.exports = router;
