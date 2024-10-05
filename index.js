const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const SQLiteStore = require('connect-sqlite3')(session);

const multer = require('multer');

// Set up storage for image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'public', 'images'));  // Save images to public/images directory
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);  // Unique file name
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
app.use(express.urlencoded({ extended: true })); // To parse form data

// Import the database setup script and use the db object
const db = require('./dbSetup');  // Import the db object from dbSetup.js

// Set up session management
app.use(session({
    store: new SQLiteStore({ db: 'sessions.db' }),
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1 day
}));

// Middleware to attach session user to res.locals (so it is available in every EJS template)
app.use((req, res, next) => {
    res.locals.user = req.session.user || null; // Set user to null if not logged in
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



/// register functionality
app.post('/register', (req, res) => {
    const { firstName, lastName, username, email, password, phone, address } = req.body;

    // Hash the password before storing it in the database
    bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
            console.error('Error hashing password:', err.message);
            res.status(500).send('Server error');
        } else {
            db.run(`INSERT INTO users (firstName, lastName, username, email, password, phone, address, role)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [firstName, lastName, username, email, hashedPassword, phone, address, 'customer'], // Always set role to 'customer'
                function (err) {
                    if (err) {
                        console.error('Error registering user:', err.message);
                        res.status(500).send('Error registering user');
                    } else {
                        console.log(`User registered: ${firstName} ${lastName}`);
                        res.redirect('/login');
                    }
                });
        }
    });
});

// Login route
app.get('/login', (req, res) => {
    res.render('login', { cssFile: 'login.css' });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            console.error('Error fetching user:', err.message);
            res.status(500).send('Server error');
        } else if (!user) {
            res.status(400).send('User not found');
        } else {
            // Compare passwords
            bcrypt.compare(password, user.password, (err, isMatch) => {
                if (err) {
                    console.error('Error comparing passwords:', err.message);
                    res.status(500).send('Server error');
                } else if (isMatch) {
                    req.session.user = user;  // Store user info in session
                    res.redirect('/');
                } else {
                    res.status(400).send('Invalid password');
                }
            });
        }
    });
});



app.get('/', (req, res) => {
    const query = 'SELECT * FROM slideshow ORDER BY position LIMIT 3'; // Limit the number of slides to 3

    db.all(query, [], (err, slideshow) => {
        if (err) {
            console.error('Error fetching slides:', err.message);
            return res.status(500).send('Error fetching slides');
        }

        // Fetch other data like products if needed, then render
        const productQuery = 'SELECT * FROM products ORDER BY created_at DESC'; // Fetch last 5 products

        db.all(productQuery, [], (err, products) => {
            if (err) {
                console.error('Error fetching products:', err.message);
                return res.status(500).send('Error fetching products');
            }

            // Render the page with both slides and products
            res.render('index', { slideshow, products });
        });
    });
});



app.get('/product/:id', (req, res) => {
    const productId = req.params.id;

    const query = 'SELECT * FROM products WHERE product_id = ?';
    db.get(query, [productId], (err, product) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Error fetching product details');
        }
        
        res.render('product_details', { product });
    });
});



app.get('/products', (req, res) => {
    db.all('SELECT * FROM products', [], (err, rows) => {
        if (err) {
            console.error('Error fetching products:', err.message);
            res.status(500).send('Error fetching products');
        } else {
            console.log(req.session.user)
            res.render('products', { cssFile: 'products.css', products: rows , user : req.session.user  });
        }
    });
});

app.get('/contact', (req, res) => {
    res.render('contact', { cssFile: 'contact.css' });
});

app.get('/cart', (req, res) => {
    res.render('cart', { cssFile: 'cart.css' });
});

app.get('/checkout', (req, res) => {
    // Check if user is logged in
    if (!req.session.user) {
        return res.render('checkout', { user: null });
    }
    
    // If user is logged in, pass the user session to the checkout page
    res.render('checkout', { user: req.session.user });
});



app.post('/checkout', isAuthenticated, (req, res) => {
    const userId = req.session.user.id;
    const { cartData } = req.body;

    db.run(`INSERT INTO orders (user_id, cartData) VALUES (?, ?)`,
        [userId, cartData],
        function (err) {
            if (err) {
                console.error('Error saving order:', err.message);
                res.status(500).send('Error saving order');
            } else {
                console.log(`Order created for user ID ${userId}`);
                res.send('Order placed successfully!');
            }
        });
});

app.get('/logout', (req, res) => {
    // Destroy the session to log the user out
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).send('An error occurred while logging out.');
        }

        // Clear the session cookie to fully log out the user
        res.clearCookie('connect.sid', { path: '/' });

        // Redirect to the login page or home page after logout
        res.redirect('/login');
    });
});

//// Contact issues
app.post('/contact', (req, res) => {
    const { name, email, message } = req.body;

    // Insert the contact request into the database
    const query = `INSERT INTO contact_requests (name, email, message) VALUES (?, ?, ?)`;

    db.run(query, [name, email, message], function (err) {
        if (err) {
            console.error('Error saving contact request:', err.message);
            res.status(500).send('Error saving contact request');
        } else {
            console.log(`Contact request submitted by ${name}`);
            // Redirect to thank-you page after successful form submission
            res.redirect('/thank-you');
        }
    });
});

// Route to render the thank you page
app.get('/thank-you', (req, res) => {
    res.render('thank_you', { cssFile: 'thank_you.css' });
});



app.get('/thankyouforyour', (req, res) => {
    res.render('thankyouforyour', { cssFile: 'thank_you.css' });
});

app.get('/profile', (req, res) => {
    // Check if the user is logged in
    if (!req.session.user) {
        return res.redirect('/login'); // Redirect to login if not logged in
    }

    const userId = req.session.user.id;

    // Query to get the user's information
    const userQuery = `SELECT * FROM users WHERE id = ?`;
    // Query to get the user's current orders
    const ordersQuery = `SELECT * FROM orders WHERE user_id = ?`;

    db.get(userQuery, [userId], (err, user) => {
        if (err) {
            console.error('Error fetching user info:', err.message);
            res.status(500).send('Error fetching user information');
        } else {
            db.all(ordersQuery, [userId], (err, orders) => {
                if (err) {
                    console.error('Error fetching orders:', err.message);
                    res.status(500).send('Error fetching orders');
                } else {
                    res.render('profile', { user, orders, cssFile: 'profile.css' });
                }
            });
        }
    });
});

app.post('/profile', (req, res) => {
    const { firstName, lastName, email, phone, address } = req.body;
    const userId = req.session.user.id; // Assuming the user's ID is stored in session

    const query = `UPDATE users SET firstName = ?, lastName = ?, email = ?, phone = ?, address = ? WHERE id = ?`;

    db.run(query, [firstName, lastName, email, phone, address, userId], function (err) {
        if (err) {
            console.error('Error updating profile:', err.message);
            // Render the profile page with an error flag
            res.render('profile', { user: req.session.user, orders: [], success: false, error: true });
        } else {
            // Update session info
            req.session.user.firstName = firstName;
            req.session.user.lastName = lastName;
            req.session.user.email = email;
            req.session.user.phone = phone;
            req.session.user.address = address;

            // Render the profile page with a success flag
            res.render('profile', { user: req.session.user, orders: [], success: true, error: false });
        }
    });
});

//////////////////////////////////////////
////// Admin tools /////////
/////////////////////////////////////////

// Route to display full products table (Admin only)
app.get('/productsTable', (req, res) => {
    // Check if the user is logged in and if the role is 'admin'
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send('Access denied. Admins only.');
    }

    const query = 'SELECT * FROM products';  // Query the products table
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error fetching products:', err.message);
            res.status(500).send('Error fetching products');
        } else {
            res.render('items', { cssFile: 'products.css', products: rows });
        }
    });
});

// Route to display full users table (Admin only)
app.get('/usersTable', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send('Access denied. Admins only.');
    }

    const query = 'SELECT * FROM users';  // Query the users table
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error fetching users:', err.message);
            res.status(500).send('Error fetching users');
        } else {
            res.render('users', { cssFile: 'users.css', users: rows });
        }
    });
});

// Route to display full orders table (Admin only)
app.get('/ordersTable', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send('Access denied. Admins only.');
    }

    const orderQuery = 'SELECT * FROM orders';
    const productQuery = 'SELECT * FROM products';

    // Fetch all orders
    db.all(orderQuery, [], (err, orders) => {
        if (err) {
            console.error('Error fetching orders:', err.message);
            return res.status(500).send('Error fetching orders');
        }

        // Fetch all products
        db.all(productQuery, [], (productErr, products) => {
            if (productErr) {
                console.error('Error fetching products:', productErr.message);
                return res.status(500).send('Error fetching products');
            }

            // Send both orders and products to the frontend
            res.render('orders', { cssFile: 'orders.css', orders, products });
        });
    });
});


// Route to display full contact requests table (Admin only)
app.get('/contact-requests', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send('Access denied. Admins only.');
    }

    const query = 'SELECT * FROM contact_requests';  // Query the contact_requests table
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error fetching contact requests:', err.message);
            res.status(500).send('Error fetching contact requests');
        } else {
            res.render('admin_contact_requests', { cssFile: 'admin.css', requests: rows });
        }
    });
});



//////////// adding new products...

app.get('/add-product', (req, res) => {
    // Check if user is logged in and if they are admin
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send('Access denied. Admins only.');
    }
    
    // Render the EJS file for adding products
    res.render('admin_add_product', { cssFile: 'admin_add_product.css' });
});


app.post('/add-product', upload, (req, res) => {
    const {
        name, description, price, discount_amount, stock, category, subcategory, brand, model,
        sku, weight, dimensions, color, size, material, release_date, warranty, return_policy, additional_info
    } = req.body;

    // If files were uploaded, collect their file paths
    const images = req.files.map(file => file.filename);  // Get the file names for the uploaded images

    const query = `INSERT INTO products (name, description, price, discount_amount, stock, category, subcategory, brand, model, sku, weight, dimensions, color, size, material, release_date, warranty, return_policy, additional_info)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(query, [
        name, description, price, discount_amount, stock, category, subcategory, brand, model, sku, weight,
        dimensions, color, size, material, release_date, warranty, return_policy, additional_info
    ], function (err) {
        if (err) {
            console.error('Error adding product:', err.message);
            return res.status(500).send('Error adding product');
        }

        const productId = this.lastID;

        // Insert image file paths into the product_images table
        images.forEach((image) => {
            db.run(`INSERT INTO product_images (product_id, image_path) VALUES (?, ?)`, [productId, image], (err) => {
                if (err) {
                    console.error('Error inserting product image:', err.message);
                }
            });
        });

        // Render a success modal or page after the product is added
        res.render('admin_add_product', { cssFile: 'admin_add_product.css', success: true });
    });
});



// Route to get product details by product ID and display edit page
app.get('/products/:product_id', (req, res) => {
    const productId = req.params.product_id;

    const query = `SELECT * FROM products WHERE product_id = ?`;
    db.get(query, [productId], (err, product) => {
        if (err) {
            console.error('Error fetching product details:', err.message);
            return res.status(500).send('Error fetching product details');
        }

        if (!product) {
            return res.status(404).send('Product not found');
        }

        res.render('edit_product', { product, cssFile: 'edit_product.css' });
    });
});


// Route to handle product update (Admin only)
app.post('/products/:product_id/edit', (req, res) => {
    // Check if the user is logged in and has an admin role
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send('Access denied. Admins only.');
    }

    const productId = req.params.product_id;
    const { name, description, price, discount_amount, stock, category, subcategory, brand, model, sku, weight, dimensions, color, size, material, release_date, warranty, return_policy } = req.body;

    const query = `
        UPDATE products
        SET name = ?, description = ?,
        price = ?, discount_amount = ?,
        stock = ?, category = ?,
        subcategory = ?, brand = ?,
        model = ?, sku = ?, weight = ?,
        dimensions = ?, color = ?,
        size = ?, material = ?, 
        release_date = ?, warranty = ?,
        return_policy = ?
        WHERE product_id = ?`;

    db.run(query, [name, description, price, discount_amount, stock, category, subcategory, brand, model, sku, weight, dimensions, color, size, material, release_date, warranty, return_policy, productId], function (err) {
        if (err) {
            console.error('Error updating product:', err.message);
            return res.status(500).send('Error updating product');
        }

        res.render('edit_product', { product: req.body, cssFile: 'edit_product.css', success: true });
    });
});





// payment routes..

app.post('/confirmOrder', (req, res) => {
    const { cartData, userId, subtotal, taxes, shipping, total } = req.body;
    
    // Parse cart data to extract product IDs and quantities
    const parsedCartData = JSON.parse(cartData); // This is your cart data
    
    // Ensure the cartData object has the correct structure (with "cart" key)
    const cartItems = parsedCartData.cart || {}; // Access the "cart" key

    // Format the cartData as [{ product_id: x, quantity: y }]
    const formattedCartData = Object.values(cartItems).map(item => ({
        product_id: item.id,    // Ensure item.id is correct here
        quantity: item.quantity
    }));

    console.log('Formatted Cart Data:', formattedCartData); // Debugging

    const paymentSuccessful = true; // Simulating payment success

    if (paymentSuccessful) {
        // Generate random 8-digit order number
        const generateOrderId = () => Math.floor(10000000 + Math.random() * 90000000);

        function insertOrderWithUniqueId() {
            const orderId = generateOrderId();

            // Check if this orderId already exists in the orders table
            db.get(`SELECT order_id FROM orders WHERE order_id = ?`, [orderId], (err, row) => {
                if (err) {
                    console.error('Error checking order ID:', err.message);
                    return res.status(500).json({ message: 'Error checking order ID', error: err.message });
                }

                if (row) {
                    // If the orderId already exists, generate a new one and try again
                    insertOrderWithUniqueId();
                } else {
                    // Convert formattedCartData array to a JSON string for storage
                    const cartDataJson = JSON.stringify(formattedCartData);

                    // Insert the order into the table with the product ID and quantity
                    const sql = `
                        INSERT INTO orders (order_id, user_id, cartData, subtotal, tax, shipping, total, status, createdAt) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
                    `;
                    db.run(sql, [orderId, userId, cartDataJson, subtotal, taxes, shipping, total], function (err) {
                        if (err) {
                            console.error('Error creating order:', err.message);
                            return res.status(500).json({ message: 'Error creating order', error: err.message });
                        }

                        console.log('Order successfully inserted:', orderId);
                        res.status(200).json({ message: 'Order confirmed successfully', orderId });
                    });
                }
            });
        }

        insertOrderWithUniqueId();
    } else {
        res.status(400).json({ message: 'Payment failed. Order not created.' });
    }
});


app.post('/updateSlide', (req, res) => {
    const { slide_id, image_url, title, description } = req.body;
    
    const query = `UPDATE slideshow SET image_url = ?, title = ?, description = ? WHERE id = ?`;

    db.run(query, [image_url, title, description, slide_id], function(err) {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Error updating slide');
        }
        res.redirect('/'); // Redirect back to home page after update
    });
});




////////////////////// server runnning ....

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
