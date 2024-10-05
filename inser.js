const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

// Connect to SQLite database
const db = new sqlite3.Database('./ecome.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');

        // Insert an admin user
        const adminPassword = 'admin123';  // Choose a secure password for admin
        bcrypt.hash(adminPassword, 10, (err, hashedPassword) => {
            if (err) {
                console.error('Error hashing admin password:', err.message);
            } else {
                db.run(`INSERT INTO users (firstName, lastName, username, email, password, phone, address, role)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    ['Admin', 'User', 'admin', 'admin@example.com', hashedPassword, '123-456-7890', 'Admin Address', 'admin'],
                    function (err) {
                        if (err) {
                            console.error('Error inserting admin user:', err.message);
                        } else {
                            console.log('Admin user inserted successfully.');
                        }
                    });
            }
        });

        // Insert a customer user
        const customerPassword = 'customer123';  // Choose a secure password for customer
        bcrypt.hash(customerPassword, 10, (err, hashedPassword) => {
            if (err) {
                console.error('Error hashing customer password:', err.message);
            } else {
                db.run(`INSERT INTO users (firstName, lastName, username, email, password, phone, address, role)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    ['John', 'Doe', 'johndoe', 'john@example.com', hashedPassword, '987-654-3210', 'Customer Address', 'customer'],
                    function (err) {
                        if (err) {
                            console.error('Error inserting customer user:', err.message);
                        } else {
                            console.log('Customer user inserted successfully.');
                        }
                    });
            }
        });


// Insert 10 sample products
const products = [
    ['Product 1', 'A great product', 29.99, 5, 5, 'Electronics', 'Smartphones', 'BrandX', 'ModelX', 'SKU001', 0.5, '10x5x1', 'Black', 'L', 'Plastic', '2023-01-01', '1-year', '30-day return', 'Additional info here'],
    ['Product 2', 'A cool product', 49.99, 10, 10, 'Electronics', 'Tablets', 'BrandY', 'ModelY', 'SKU002', 0.8, '12x8x2', 'White', 'M', 'Metal', '2023-02-15', '2-year', '30-day return', 'Additional info here'],
    ['Product 3', 'An awesome product', 99.99, 3, 3, 'Home Appliances', 'Vacuum Cleaners', 'BrandZ', 'ModelZ', 'SKU003', 3.2, '20x10x8', 'Red', 'N/A', 'Plastic', '2023-03-10', '1-year', '30-day return', 'Additional info here'],
    ['Product 4', 'A must-have product', 19.99, 8, 8, 'Kitchen', 'Blenders', 'BrandW', 'ModelW', 'SKU004', 1.2, '8x5x6', 'Blue', 'N/A', 'Metal', '2023-04-05', '6-month', '30-day return', 'Additional info here'],
    ['Product 5', 'A stylish product', 59.99, 6, 6, 'Fashion', 'Jackets', 'BrandQ', 'ModelQ', 'SKU005', 1.0, 'N/A', 'Black', 'M', 'Leather', '2023-05-01', '1-year', '30-day return', 'Additional info here'],
    ['Product 6', 'A durable product', 199.99, 4, 4, 'Electronics', 'Laptops', 'BrandR', 'ModelR', 'SKU006', 2.5, '15x10x1', 'Silver', 'N/A', 'Aluminum', '2023-06-20', '2-year', '30-day return', 'Additional info here'],
    ['Product 7', 'A convenient product', 79.99, 9, 9, 'Fitness', 'Treadmills', 'BrandT', 'ModelT', 'SKU007', 50.0, '70x30x15', 'Gray', 'N/A', 'Steel', '2023-07-10', '1-year', '30-day return', 'Additional info here'],
    ['Product 8', 'A budget-friendly product', 9.99, 15, 15, 'Beauty', 'Lipsticks', 'BrandU', 'ModelU', 'SKU008', 0.1, '1x1x3', 'Pink', 'N/A', 'Plastic', '2023-08-05', '6-month', '30-day return', 'Additional info here'],
    ['Product 9', 'An eco-friendly product', 12.99, 12, 12, 'Home', 'LED Bulbs', 'BrandV', 'ModelV', 'SKU009', 0.3, '5x5x5', 'Green', 'N/A', 'Glass', '2023-09-01', '1-year', '30-day return', 'Additional info here'],
    ['Product 10', 'A luxurious product', 499.99, 2, 2, 'Luxury', 'Watches', 'BrandS', 'ModelS', 'SKU010', 0.2, 'N/A', 'Gold', 'N/A', 'Gold', '2023-10-15', '5-year', '30-day return', 'Additional info here']
];

products.forEach((product) => {
    db.run(`INSERT INTO products (name, description, price, discount_amount, stock, category, subcategory, brand, model, sku, weight, dimensions, color, size, material, release_date, warranty, return_policy, additional_info)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        product, function (err) {
            if (err) {
                console.error('Error inserting product:', err.message);
            } else {
                console.log(`Product '${product[0]}' inserted successfully.`);
            }
        });
});




    }
});
