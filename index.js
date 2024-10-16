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


app.use(express.json());

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

// Routes for Cart Functionality

////shop route
app.get('/products', async (req, res) => {
    try {
        // Fetch products and their corresponding images
        const [products] = await db.query(`
            SELECT p.*, GROUP_CONCAT(pi.image_path) AS images
            FROM products p
            LEFT JOIN product_images pi ON p.product_id = pi.product_id
            GROUP BY p.product_id
        `);
        
        // Map the products and split their image paths into arrays
        const productsWithImages = products.map(product => {
            product.images = product.images ? product.images.split(',') : []; // Split the concatenated image paths into an array
            return product;
        });

        // Render the products view and pass the products with their images
        res.render('products', { products: productsWithImages, user: req.session.user });
    } catch (err) {
        console.error('Error fetching products and images:', err.message);
        res.status(500).send('Error fetching products and images');
    }
});


///////////////////////////////////////////////////////////////////////////////

app.get('/cart', isAuthenticated, (req, res) => {
    res.render('cart');  // Render the cart page without data for now
});



app.get('/api/cart', isAuthenticated, async (req, res) => {
    const user_id = req.session.user.id;

    try {
        const [cartItems] = await db.query(`
            SELECT c.cart_id, c.quantity, p.name, p.price, p.product_id, 
                   GROUP_CONCAT(pi.image_path) AS images
            FROM cart c
            JOIN products p ON c.product_id = p.product_id
            LEFT JOIN product_images pi ON p.product_id = pi.product_id
            WHERE c.user_id = ?
            GROUP BY c.cart_id, p.product_id
        `, [user_id]);

        // Ensure images are returned as arrays
        const cartItemsWithImages = cartItems.map(item => {
            return {
                ...item,
                images: item.images ? item.images.split(',') : [] // Convert image paths to an array
            };
        });

        res.json(cartItemsWithImages);  // Return cart items with images as JSON
    } catch (err) {
        console.error('Error fetching cart items:', err);
        res.status(500).json({ error: 'Failed to fetch cart items' });
    }
});




// Add to Cart Route
app.post('/cart/add', isAuthenticated, async (req, res) => {
    const { product_id } = req.body;
    const user_id = req.session.user.id;

    try {
        // Fetch the product details from the database using the product_id
        const [product] = await db.query('SELECT * FROM products WHERE product_id = ?', [product_id]);

        if (!product || product.length === 0) {
            return res.status(400).json({ message: 'Invalid product' });
        }

        // Set default quantity to 1 if not provided
        const quantity = 1;

        // Insert product into cart or update the quantity if it already exists
        await db.query(`
            INSERT INTO cart (user_id, product_id, quantity) 
            VALUES (?, ?, ?) 
            ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)
        `, [user_id, product[0].product_id, quantity]);

        res.status(200).json({ message: 'Product added to cart successfully' });
    } catch (err) {
        console.error('Error adding to cart:', err.message);
        res.status(500).json({ message: 'Error adding to cart' });
    }
});


app.post('/cart/update', isAuthenticated, async (req, res) => {
    const { cart_id, quantity } = req.body;

    try {
        if (quantity > 0) {
            await db.query('UPDATE cart SET quantity = ? WHERE cart_id = ?', [quantity, cart_id]);
            res.status(200).json({ message: 'Cart updated successfully' });
        } else {
            await db.query('DELETE FROM cart WHERE cart_id = ?', [cart_id]);
            res.status(200).json({ message: 'Item removed from cart' });
        }
    } catch (err) {
        console.error('Error updating cart:', err.message);
        res.status(500).json({ message: 'Error updating cart' });
    }
});

/////////////////////////////////////////////////////////////////////


// 4. Confirm Order Route - Fetches cart from the database
app.post('/confirmOrder', isAuthenticated, async (req, res) => {
    const user_id = req.session.user.id;
    const { taxes, shipping } = req.body;

    try {
        // Fetch cart items for the user
        const [cartItems] = await db.query(`
            SELECT p.product_id, p.name, p.price, c.quantity 
            FROM cart c 
            JOIN products p ON c.product_id = p.product_id
            WHERE c.user_id = ?
        `, [user_id]);

        if (cartItems.length === 0) {
            return res.status(400).json({ message: 'No items in cart to place order.' });
        }

        // Calculate subtotal and total
        const subtotal = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
        const total = subtotal + parseFloat(taxes) + parseFloat(shipping);

        // Convert cart data to JSON string
        const cartData = JSON.stringify(cartItems);

        // Generate a unique 8-digit order ID
        const generateOrderId = () => Math.floor(10000000 + Math.random() * 90000000);
        let orderId = generateOrderId();

        // Ensure the generated orderId is unique
        const [existingOrder] = await db.query('SELECT order_id FROM orders WHERE order_id = ?', [orderId]);

        if (existingOrder.length > 0) {
            orderId = generateOrderId(); // Generate another one if already exists
        }

        // Insert order into the orders table
        await db.query(`
            INSERT INTO orders (order_id, user_id, cartData, subtotal, tax, shipping, total, status, createdAt) 
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
            [orderId, user_id, cartData, subtotal, taxes, shipping, total]
        );

        // Clear the user's cart after successful order placement
        await db.query('DELETE FROM cart WHERE user_id = ?', [user_id]);

        // Respond with success message and orderId
        res.status(200).json({ message: 'Order confirmed successfully', orderId });
    } catch (err) {
        console.error('Error confirming order:', err.message);
        res.status(500).json({ message: 'Error confirming order', error: err.message });
    }
});


// Other routes (existing routes)

// Registration route
app.get('/register', (req, res) => {
    res.render('register', { cssFile: 'register.css' });
});

// Registration functionality
app.post('/register', async (req, res) => {
    const { firstName, lastName, username, email, password, phone, address } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const [userCountRows] = await db.query('SELECT COUNT(*) as count FROM users');
        const userCount = userCountRows[0].count;

        const role = userCount === 0 ? 'admin' : 'customer';

        await db.query(`INSERT INTO users (firstName, lastName, username, email, password, phone, address, role)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                       [firstName, lastName, username, email, hashedPassword, phone, address, role]);

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
        // Fetch the slideshow data
        const [slideshow] = await db.query('SELECT * FROM slideshow ORDER BY position LIMIT 3');

        // Fetch the products along with their images
        const [products] = await db.query(`
            SELECT p.*, GROUP_CONCAT(pi.image_path) AS images
            FROM products p
            LEFT JOIN product_images pi ON p.product_id = pi.product_id
            GROUP BY p.product_id
            ORDER BY p.created_at DESC
        `);

        // Render the index page, passing slideshow and products (with images)
        res.render('index', {
            slideshow,
            products: products.map(product => ({
                ...product,
                images: product.images ? product.images.split(',') : [] // Convert image paths to array
            }))
        });
    } catch (err) {
        console.error('Error fetching data:', err.message);
        res.status(500).send('Error fetching data');
    }
});



// Product details route
app.get('/product/:id', async (req, res) => {
    const productId = req.params.id;

    try {
        // Fetch the product details from the products table
        const [productRows] = await db.query('SELECT * FROM products WHERE product_id = ?', [productId]);
        const product = productRows[0];

        if (!product) {
            return res.status(404).send('Product not found');
        }

        // Fetch product images from the product_images table
        const [imageRows] = await db.query('SELECT image_path FROM product_images WHERE product_id = ?', [productId]);
        const images = imageRows.map(row => row.image_path);

        // Attach images to the product object
        product.images = images.length > 0 ? images : null; // Set null if no images found

        // Render the product details page with the product and images
        res.render('product_details', { product });
    } catch (err) {
        console.error('Error fetching product details:', err.message);
        res.status(500).send('Error fetching product details');
    }
});




// Checkout route
app.get('/checkout', (req, res) => {
    if (!req.session.user) {
        return res.render('checkout', { user: null });
    }
    res.render('checkout', { user: req.session.user });
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


// Admin - Show the Add Product form
app.get('/add-product', isAuthenticated, (req, res) => {
    if (req.session.user.role !== 'admin') {
        return res.status(403).send('Access denied. Admins only.');
    }

    // Render the form for adding a new product
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

// Route to fetch product details for editing
app.get('/edit-product/:id', isAuthenticated, async (req, res) => {
    const productId = req.params.id;

    try {
        const [rows] = await db.query('SELECT * FROM products WHERE product_id = ?', [productId]);
        const product = rows[0];

        if (!product) {
            return res.status(404).send('Product not found');
        }

        const [images] = await db.query('SELECT image_path FROM product_images WHERE product_id = ?', [productId]);

        // Pass product and images to the edit form
        res.render('edit_product', { product, images, user: req.session.user });
    } catch (err) {
        console.error('Error fetching product details:', err.message);
        res.status(500).send('Error fetching product details');
    }
});


// Route to handle updating a product
app.post('/edit-product/:id', upload, isAuthenticated, async (req, res) => {
    const productId = req.params.id;
    const {
        name, description, price, discount_amount, stock, category, subcategory, brand, model,
        sku, weight, dimensions, color, size, material, release_date, warranty, return_policy, additional_info
    } = req.body;

    const images = req.files.map(file => file.filename);

    try {
        // Create an object with the updated fields (if they have values)
        const updateFields = {};
        if (name) updateFields.name = name;
        if (description) updateFields.description = description;
        if (price) updateFields.price = price;
        if (discount_amount) updateFields.discount_amount = discount_amount;
        if (stock) updateFields.stock = stock;
        if (category) updateFields.category = category;
        if (subcategory) updateFields.subcategory = subcategory;
        if (brand) updateFields.brand = brand;
        if (model) updateFields.model = model;
        if (sku) updateFields.sku = sku;
        if (weight) updateFields.weight = weight;
        if (dimensions) updateFields.dimensions = dimensions;
        if (color) updateFields.color = color;
        if (size) updateFields.size = size;
        if (material) updateFields.material = material;
        if (release_date) updateFields.release_date = release_date || null;  // Allow release_date to be null if empty
        if (warranty) updateFields.warranty = warranty;
        if (return_policy) updateFields.return_policy = return_policy;
        if (additional_info) updateFields.additional_info = additional_info;

        // Dynamically construct the query
        const fieldsToUpdate = Object.keys(updateFields).map(field => `${field} = ?`).join(', ');
        const valuesToUpdate = Object.values(updateFields);

        // Update the product if there are fields to update
        if (fieldsToUpdate) {
            await db.query(`
                UPDATE products 
                SET ${fieldsToUpdate}
                WHERE product_id = ?`, 
                [...valuesToUpdate, productId]
            );
        }

        // Handle new images if provided
        if (images.length > 0) {
            // Delete old images
            await db.query('DELETE FROM product_images WHERE product_id = ?', [productId]);

            // Insert new images
            for (const image of images) {
                await db.query('INSERT INTO product_images (product_id, image_path) VALUES (?, ?)', [productId, image]);
            }
        }

        res.redirect('/products');
    } catch (err) {
        console.error('Error updating product:', err.message);
        res.status(500).send('Error updating product');
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
        // Fetch all orders
        const [orders] = await db.query('SELECT * FROM orders');

        // Fetch all products to be used in the order details
        const [products] = await db.query('SELECT product_id, name, price, category, description, brand, model FROM products');

        // Render the orders view with both orders and products data
        res.render('orders', { cssFile: 'orders.css', orders, products });
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

// Start the server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
