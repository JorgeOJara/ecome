const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./ecome.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');

        // Create users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            firstName TEXT NOT NULL,
            lastName TEXT NOT NULL,
            username TEXT UNIQUE NOT NULL,
            email TEXT NOT NULL,
            password TEXT NOT NULL,
            phone TEXT NOT NULL,
            address TEXT NOT NULL,
            role TEXT DEFAULT 'customer',
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Create orders table
        db.run(`CREATE TABLE IF NOT EXISTS orders (
            order_id TEXT PRIMARY KEY,  -- Unique 8-digit order number
            user_id INTEGER,
            cartData TEXT,
            subtotal REAL,              -- Subtotal of all items in the cart
            tax REAL,                   -- Tax amount
            shipping REAL,              -- Shipping amount
            total REAL,                 -- Total amount (subtotal + tax + shipping)
            status TEXT DEFAULT 'pending',
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);
        
        // Create updated products table
        db.run(`CREATE TABLE IF NOT EXISTS products (
            product_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            price REAL NOT NULL,
            discount_amount REAL DEFAULT 0,
            stock INTEGER DEFAULT 0,
            category TEXT NOT NULL,
            subcategory TEXT,
            brand TEXT,
            model TEXT,
            sku TEXT UNIQUE,
            weight REAL,
            dimensions TEXT,
            color TEXT,
            size TEXT,
            material TEXT,
            release_date DATE,
            warranty TEXT,
            return_policy TEXT,
            additional_info TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        // Create contact_requests table
        db.run(`CREATE TABLE IF NOT EXISTS contact_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            message TEXT NOT NULL,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) {
                console.error('Error creating contact_requests table:', err.message);
            } else {
                console.log('contact_requests table created successfully.');
            }
        });

        // Create product_images table
        db.run(`CREATE TABLE IF NOT EXISTS product_images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER,
            image_path TEXT,
            FOREIGN KEY (product_id) REFERENCES products(product_id)
        )`);

            // Create slideshow table with position column
        db.run(`CREATE TABLE IF NOT EXISTS slideshow (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            image_url TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            position INTEGER DEFAULT 0  -- Adding position column with a default value of 0
        )`, (err) => {
            if (err) {
                console.error('Error creating slideshow table:', err.message);
            } else {
                console.log('slideshow table created successfully.');
            }
        });


         // Create configurations table to store admin settings
         db.run(`CREATE TABLE IF NOT EXISTS configurations (
            key TEXT PRIMARY KEY,
            value TEXT
        )`, (err) => {
            if (err) {
                console.error('Error creating configurations table:', err.message);
            } else {
                console.log('Configurations table created successfully.');
            }
        });

    }
});

module.exports = db;
