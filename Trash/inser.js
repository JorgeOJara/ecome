require('dotenv').config(); // Load environment variables
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

// Async function to create the admin user
async function createAdminUser() {
    try {
        // Create a connection pool to the database
        const db = await mysql.createPool({
            host: 'localhost',  // Replace with your MySQL host if different
            user: process.env.MYSQL_USER,  // MySQL user from .env
            password: process.env.MYSQL_PASSWORD,  // MySQL password from .env
            database: process.env.MYSQL_DATABASE,  // Database name from .env
        });

        // Retrieve the admin password from the .env file
        const adminPassword = process.env.MYSQL_PASSWORD;

        // Hash the password using bcrypt
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        // Insert the admin user into the users table
        const [result] = await db.query(`
            INSERT INTO users (firstName, lastName, username, email, password, phone, address, role)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, ['Admin', 'User', 'admin', 'admin@example.com', hashedPassword, '1234567890', 'Admin Address', 'admin']);

        if (result.affectedRows > 0) {
            console.log('Admin user created successfully!');
        } else {
            console.log('Failed to create admin user.');
        }

        // Close the database connection
        await db.end();
    } catch (err) {
        console.error('Error creating admin user:', err.message);
    }
}

// Call the function to create the admin user
createAdminUser();
