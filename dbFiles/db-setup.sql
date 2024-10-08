-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    firstName VARCHAR(255) NOT NULL,
    lastName VARCHAR(255) NOT NULL,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address TEXT NOT NULL,
    role VARCHAR(50) DEFAULT 'customer',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    order_id VARCHAR(8) PRIMARY KEY,  -- Unique 8-digit order number
    user_id INT,
    cartData TEXT,
    subtotal DECIMAL(10,2),              -- Subtotal of all items in the cart
    tax DECIMAL(10,2),                   -- Tax amount
    shipping DECIMAL(10,2),              -- Shipping amount
    total DECIMAL(10,2),                 -- Total amount (subtotal + tax + shipping)
    status VARCHAR(50) DEFAULT 'pending',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    product_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    stock INT DEFAULT 0,
    category VARCHAR(255) NOT NULL,
    subcategory VARCHAR(255),
    brand VARCHAR(255),
    model VARCHAR(255),
    sku VARCHAR(255) UNIQUE,
    weight DECIMAL(10,2),
    dimensions VARCHAR(255),
    color VARCHAR(255),
    size VARCHAR(255),
    material VARCHAR(255),
    release_date DATE,
    warranty TEXT,
    return_policy TEXT,
    additional_info TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create contact_requests table
CREATE TABLE IF NOT EXISTS contact_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create product_images table
CREATE TABLE IF NOT EXISTS product_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT,
    image_path VARCHAR(255),
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- Create slideshow table with position column
CREATE TABLE IF NOT EXISTS slideshow (
    id INT AUTO_INCREMENT PRIMARY KEY,
    image_url VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    position INT DEFAULT 0  -- Adding position column with a default value of 0
);

-- Create configurations table to store admin settings
CREATE TABLE IF NOT EXISTS configurations (
    `key` VARCHAR(255) PRIMARY KEY,
    value TEXT
);
