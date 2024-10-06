require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const mysql = require('mysql2');
const multer = require('multer');

// Create a MySQL connection pool
const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'rootpassword',
    database: process.env.MYSQL_DATABASE || 'ecome_db'
});

// Promisify the pool's query method to use async/await
const db = pool.promise();

// Set up storage for image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'public', 'images'));
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }  // Limit file size to 2MB
}).array('images', 3);  // Max 3 images

////////////////////////////////////////////
const app = express();
const port = 80;

// Set the view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// Set up session management
app.use(session({
    secret: process.env.SESSION_SECRET || 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1 day
}));

// Middleware to attach session user to res.locals
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// Middleware to check if user is logged in
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    } else {
        res.redirect('/login');
    }
}

// Registration route
app.get('/register', (req, res) => {
    res.render('register', { cssFile: 'register.css' });
});

// Registration functionality
app.post('/register', async (req, res) => {
    const { firstName, lastName, username, email, password, phone, address } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query(`INSERT INTO users (firstName, lastName, username, email, password, phone, address, role)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                       [firstName, lastName, username, email, hashedPassword, phone, address, 'customer']);
        res.redirect('/login');
    } catch (err) {
        console.error('Error registering user:', err.message);
        res.status(500).send('Error registering user');
    }
});

// Login route
app.get('/login', (req, res) => {
    res.render('login', { cssFile: 'login.css' });
});

// Login functionality
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        const user = rows[0];

        if (!user) {
            return res.status(400).send('User not found');
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (isMatch) {
            req.session.user = user;
            res.redirect('/');
        } else {
            res.status(400).send('Invalid password');
        }
    } catch (err) {
        console.error('Error fetching user:', err.message);
        res.status(500).send('Server error');
    }
});

// Home route
app.get('/', async (req, res) => {
    try {
        const [slideshow] = await db.query('SELECT * FROM slideshow ORDER BY position LIMIT 3');
        const [products] = await db.query('SELECT * FROM products ORDER BY created_at DESC');
        res.render('index', { slideshow, products });
    } catch (err) {
        console.error('Error fetching data:', err.message);
        res.status(500).send('Error fetching data');
    }
});

// Product details route
app.get('/product/:id', async (req, res) => {
    const productId = req.params.id;

    try {
        const [rows] = await db.query('SELECT * FROM products WHERE product_id = ?', [productId]);
        const product = rows[0];

        if (!product) {
            return res.status(404).send('Product not found');
        }

        res.render('product_details', { product });
    } catch (err) {
        console.error('Error fetching product details:', err.message);
        res.status(500).send('Error fetching product details');
    }
});

// Cart route
app.get('/cart', (req, res) => {
    res.render('cart', { cssFile: 'cart.css' });
});

// Checkout route
app.get('/checkout', (req, res) => {
    if (!req.session.user) {
        return res.render('checkout', { user: null });
    }
    res.render('checkout', { user: req.session.user });
});

// Checkout process
app.post('/checkout', isAuthenticated, async (req, res) => {
    const userId = req.session.user.id;
    const { cartData, subtotal, taxes, shipping, total } = req.body;

    try {
        const cartDataJson = JSON.stringify(cartData);
        await db.query(`INSERT INTO orders (user_id, cartData, subtotal, tax, shipping, total, status, createdAt)
                        VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`,
                       [userId, cartDataJson, subtotal, taxes, shipping, total]);
        res.send('Order placed successfully!');
    } catch (err) {
        console.error('Error saving order:', err.message);
        res.status(500).send('Error saving order');
    }
});


// Confirm order (Simulated payment) - Route
app.post('/confirmOrder', isAuthenticated, async (req, res) => {
    const { cartData, userId, subtotal, taxes, shipping, total } = req.body;

    try {
        const generateOrderId = () => Math.floor(10000000 + Math.random() * 90000000);
        let orderId = generateOrderId();

        const [existingOrder] = await db.query('SELECT order_id FROM orders WHERE order_id = ?', [orderId]);

        if (existingOrder.length > 0) {
            orderId = generateOrderId(); // Generate another one if already exists
        }

        const cartDataJson = JSON.stringify(cartData);

        await db.query(`
            INSERT INTO orders (order_id, user_id, cartData, subtotal, tax, shipping, total, status, createdAt) 
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
            [orderId, userId, cartDataJson, subtotal, taxes, shipping, total]
        );

        res.status(200).json({ message: 'Order confirmed successfully', orderId });
    } catch (err) {
        console.error('Error confirming order:', err.message);
        res.status(500).json({ message: 'Error confirming order', error: err.message });
    }
});

// Contact route
app.get('/contact', (req, res) => {
    res.render('contact', { cssFile: 'contact.css' });
});

// Handle contact form
app.post('/contact', async (req, res) => {
    const { name, email, message } = req.body;

    try {
        await db.query(`INSERT INTO contact_requests (name, email, message)
                        VALUES (?, ?, ?)`, [name, email, message]);
        res.redirect('/thank-you');
    } catch (err) {
        console.error('Error saving contact request:', err.message);
        res.status(500).send('Error saving contact request');
    }
});

// Thank you page
app.get('/thank-you', (req, res) => {
    res.render('thank_you', { cssFile: 'thank_you.css' });
});

// Thank you for your order page
app.get('/thankyouforyour', (req, res) => {
    res.render('thankyouforyour', { cssFile: 'thank_you.css' });
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error logging out:', err);
            return res.status(500).send('An error occurred while logging out.');
        }

        res.clearCookie('connect.sid', { path: '/' });
        res.redirect('/login');
    });
});

// Profile route
app.get('/profile', isAuthenticated, async (req, res) => {
    const userId = req.session.user.id;

    try {
        const [userRows] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        const [orderRows] = await db.query('SELECT * FROM orders WHERE user_id = ?', [userId]);
        const user = userRows[0];

        res.render('profile', { user, orders: orderRows });
    } catch (err) {
        console.error('Error fetching profile:', err.message);
        res.status(500).send('Error fetching profile');
    }
});

// Update profile POST
app.post('/profile', isAuthenticated, async (req, res) => {
    const { firstName, lastName, email, phone, address } = req.body;
    const userId = req.session.user.id;

    try {
        await db.query(`UPDATE users SET firstName = ?, lastName = ?, email = ?, phone = ?, address = ? WHERE id = ?`, 
            [firstName, lastName, email, phone, address, userId]);

        req.session.user = { ...req.session.user, firstName, lastName, email, phone, address };

        res.render('profile', { user: req.session.user, orders: [], success: true });
    } catch (err) {
        console.error('Error updating profile:', err.message);
        res.status(500).render('profile', { user: req.session.user, orders: [], success: false, error: true });
    }
});

// Admin - Update slide route
app.post('/updateSlide', isAuthenticated, async (req, res) => {
    const { slide_id, image_url, title, description } = req.body;

    try {
        await db.query(`UPDATE slideshow SET image_url = ?, title = ?, description = ? WHERE id = ?`, 
                        [image_url, title, description, slide_id]);
        res.redirect('/');
    } catch (err) {
        console.error('Error updating slide:', err.message);
        res.status(500).send('Error updating slide');
    }
});

app.get('/products', async (req, res) => {
    try {
        // Fetch all products from the database
        const [rows] = await db.query('SELECT * FROM products');
        
        // Render the products page and pass the retrieved products
        res.render('products', { cssFile: 'products.css', products: rows, user: req.session.user });
    } catch (err) {
        console.error('Error fetching products:', err.message);
        res.status(500).send('Error fetching products');
    }
});


// Admin - Display all products
app.get('/productsTable', isAuthenticated, async (req, res) => {
    if (req.session.user.role !== 'admin') {
        return res.status(403).send('Access denied. Admins only.');
    }

    try {
        const [rows] = await db.query('SELECT * FROM products');
        res.render('items', { cssFile: 'products.css', products: rows });
    } catch (err) {
        console.error('Error fetching products:', err.message);
        res.status(500).send('Error fetching products');
    }
});

// Admin - Display all users
app.get('/usersTable', isAuthenticated, async (req, res) => {
    if (req.session.user.role !== 'admin') {
        return res.status(403).send('Access denied. Admins only.');
    }

    try {
        const [rows] = await db.query('SELECT * FROM users');
        res.render('users', { cssFile: 'users.css', users: rows });
    } catch (err) {
        console.error('Error fetching users:', err.message);
        res.status(500).send('Error fetching users');
    }
});

// Admin - Display all orders
app.get('/ordersTable', isAuthenticated, async (req, res) => {
    if (req.session.user.role !== 'admin') {
        return res.status(403).send('Access denied. Admins only.');
    }

    try {
        const [orders] = await db.query('SELECT * FROM orders');
        res.render('orders', { cssFile: 'orders.css', orders });
    } catch (err) {
        console.error('Error fetching orders:', err.message);
        res.status(500).send('Error fetching orders');
    }
});

// Admin - Display all contact requests
app.get('/contact-requests', isAuthenticated, async (req, res) => {
    if (req.session.user.role !== 'admin') {
        return res.status(403).send('Access denied. Admins only.');
    }

    try {
        const [rows] = await db.query('SELECT * FROM contact_requests');
        res.render('admin_contact_requests', { cssFile: 'admin.css', requests: rows });
    } catch (err) {
        console.error('Error fetching contact requests:', err.message);
        res.status(500).send('Error fetching contact requests');
    }
});

// Admin - Add new product route
app.get('/add-product', isAuthenticated, (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send('Access denied. Admins only.');
    }

    res.render('admin_add_product', { cssFile: 'admin_add_product.css' });
});

// Admin - Add new product POST handler
app.post('/add-product', upload, isAuthenticated, async (req, res) => {
    const {
        name, description, price, discount_amount, stock, category, subcategory, brand, model,
        sku, weight, dimensions, color, size, material, release_date, warranty, return_policy, additional_info
    } = req.body;

    const images = req.files.map(file => file.filename);

    try {
        const [result] = await db.query(`
            INSERT INTO products (name, description, price, discount_amount, stock, category, subcategory, brand, model, sku, weight, dimensions, color, size, material, release_date, warranty, return_policy, additional_info)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [name, description, price, discount_amount, stock, category, subcategory, brand, model, sku, weight, dimensions, color, size, material, release_date, warranty, return_policy, additional_info]
        );

        const productId = result.insertId;

        for (const image of images) {
            await db.query(`INSERT INTO product_images (product_id, image_path) VALUES (?, ?)`, [productId, image]);
        }

        res.render('admin_add_product', { cssFile: 'admin_add_product.css', success: true });
    } catch (err) {
        console.error('Error adding product:', err.message);
        res.status(500).send('Error adding product');
    }
});

// Admin - Edit product route
app.get('/products/:product_id', isAuthenticated, async (req, res) => {
    const productId = req.params.product_id;

    try {
        const [rows] = await db.query('SELECT * FROM products WHERE product_id = ?', [productId]);
        const product = rows[0];

        if (!product) {
            return res.status(404).send('Product not found');
        }

        res.render('edit_product', { product, cssFile: 'edit_product.css' });
    } catch (err) {
        console.error('Error fetching product details:', err.message);
        res.status(500).send('Error fetching product details');
    }
});

// Admin - Update product POST handler
app.post('/products/:product_id/edit', isAuthenticated, async (req, res) => {
    const productId = req.params.product_id;
    const { name, description, price, discount_amount, stock, category, subcategory, brand, model, sku, weight, dimensions, color, size, material, release_date, warranty, return_policy } = req.body;

    try {
        await db.query(`
            UPDATE products SET name = ?, description = ?, price = ?, discount_amount = ?, stock = ?, category = ?, subcategory = ?, brand = ?, model = ?, sku = ?, weight = ?, dimensions = ?, color = ?, size = ?, material = ?, release_date = ?, warranty = ?, return_policy = ?
            WHERE product_id = ?`, 
            [name, description, price, discount_amount, stock, category, subcategory, brand, model, sku, weight, dimensions, color, size, material, release_date, warranty, return_policy, productId]
        );

        res.render('edit_product', { product: req.body, cssFile: 'edit_product.css', success: true });
    } catch (err) {
        console.error('Error updating product:', err.message);
        res.status(500).send('Error updating product');
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
