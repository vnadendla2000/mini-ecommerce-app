// ============================================
// E-Commerce Backend Server
// Local Development Version - Windows 11
// Created by: Lucas Langstraat
// Updated: Added Auth + Admin routes - Vineesha
// ============================================

const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto'); // built-in Node.js, no install needed
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'my-local-secret-key-123';

// Simple JWT helpers (no external package needed)
function base64url(str) {
    return Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function signToken(payload) {
    const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = base64url(JSON.stringify(payload));
    const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64')
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return `${header}.${body}.${sig}`;
}
function verifyToken(token) {
    try {
        const [header, body, sig] = token.split('.');
        const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64')
            .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
        if (sig !== expected) return null;
        const payload = JSON.parse(Buffer.from(body, 'base64').toString());
        if (payload.exp && Date.now() > payload.exp) return null;
        return payload;
    } catch { return null; }
}
function hashPassword(password) {
    return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex');
}

// Middleware: protect routes that need login
function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Login required' });
    const payload = verifyToken(token);
    if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });
    req.user = payload;
    next();
}

// Middleware: protect admin-only routes
function requireAdmin(req, res, next) {
    requireAuth(req, res, () => {
        if (!req.user.is_admin) return res.status(403).json({ error: 'Admin access required' });
        next();
    });
}

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// SETUP DATABASE
// ============================================
const dbPath = path.join(__dirname, 'local-ecommerce.db');
const db = new sqlite3.Database(dbPath);

console.log('💻 Using LOCAL SQLite database (no AWS needed)');
console.log('📁 Database file: ' + dbPath);

// ============================================
// CREATE TABLES (Runs automatically on startup)
// ============================================
db.serialize(() => {
    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');

    // Users table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            address_line1 TEXT,
            address_line2 TEXT,
            city TEXT,
            state TEXT,
            zip_code TEXT,
            phone TEXT,
            is_admin INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    // Add is_admin column if upgrading existing DB
    db.run(`ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0`, () => {});

    // Products table
    db.run(`
        CREATE TABLE IF NOT EXISTS products (
            product_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            price REAL NOT NULL,
            inventory_count INTEGER NOT NULL DEFAULT 0,
            category TEXT,
            image_url TEXT,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Cart items table (LUCAS'S MAIN TABLE)
    db.run(`
        CREATE TABLE IF NOT EXISTS cart_items (
            cart_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(user_id),
            FOREIGN KEY (product_id) REFERENCES products(product_id),
            UNIQUE(user_id, product_id)
        )
    `);

    // Orders table
    db.run(`
        CREATE TABLE IF NOT EXISTS orders (
            order_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            guest_email TEXT,
            order_status TEXT DEFAULT 'pending',
            total_amount REAL NOT NULL,
            shipping_address TEXT,
            billing_address TEXT,
            payment_method TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Order items table
    db.run(`
        CREATE TABLE IF NOT EXISTS order_items (
            order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER,
            product_name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            price_at_time REAL NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders(order_id)
        )
    `);

    console.log('✅ Database tables ready');
});

// ============================================
// ADD SAMPLE DATA (Only if database is empty)
// ============================================
db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
    if (row.count === 0) {
        console.log('🌱 Adding sample data...');

        // Add test user (admin)
        const adminHash = hashPassword('password123');
        db.run(`
            INSERT INTO users (email, password_hash, full_name, city, state, is_admin)
            VALUES ('admin@example.com', '${adminHash}', 'Admin User', 'Omaha', 'NE', 1)
        `);
        // Add regular test user
        const userHash = hashPassword('password123');
        db.run(`
            INSERT INTO users (email, password_hash, full_name, city, state, is_admin)
            VALUES ('test@example.com', '${userHash}', 'Test User', 'Omaha', 'NE', 0)
        `);

        // Add sample products
        const products = [
            ['Wireless Headphones', 'Noise-cancelling over-ear headphones', 79.99, 25, 'Electronics'],
            ['Cotton T-Shirt', '100% organic cotton crew neck', 24.99, 50, 'Clothing'],
            ['Coffee Mug', '15oz ceramic travel mug', 18.99, 100, 'Home & Kitchen'],
            ['Leather Journal', 'A5 leather journal 200 pages', 22.99, 75, 'Office'],
            ['Water Bottle', '32oz insulated stainless steel', 15.99, 40, 'Sports'],
            ['USB-C Cable', '6ft braided fast charging cable', 12.99, 200, 'Electronics'],
            ['Yoga Mat', 'Extra thick 6mm TPE mat', 34.99, 30, 'Sports'],
            ['Desk Lamp', 'LED lamp with USB charging port', 45.99, 45, 'Office'],
            ['Cast Iron Skillet', '12-inch pre-seasoned skillet', 29.99, 60, 'Home & Kitchen'],
            ['Wool Sweater', 'Lightweight merino wool sweater', 59.99, 35, 'Clothing']
        ];

        const stmt = db.prepare(`
            INSERT INTO products (name, description, price, inventory_count, category)
            VALUES (?, ?, ?, ?, ?)
        `);

        products.forEach(product => {
            stmt.run(product);
        });

        stmt.finalize();
        console.log('✅ Sample data added (1 user, 10 products)');
    }
});

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Log every request
app.use((req, res, next) => {
    console.log(`📨 ${req.method} ${req.url}`);
    next();
});

// ============================================
// API ROUTES
// ============================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        database: 'connected',
        environment: 'development',
        timestamp: new Date().toISOString()
    });
});

// ============================================
// PRODUCTS
// ============================================

// Get all products (with optional filters)
app.get('/api/products', (req, res) => {
    const { category, sort_by, order } = req.query;

    let sql = 'SELECT * FROM products WHERE is_active = 1';
    const params = [];

    if (category) {
        sql += ' AND category = ?';
        params.push(category);
    }

    if (sort_by === 'price') {
        sql += ' ORDER BY price';
        if (order === 'desc') sql += ' DESC';
        else sql += ' ASC';
    } else if (sort_by === 'name') {
        sql += ' ORDER BY name';
        if (order === 'desc') sql += ' DESC';
        else sql += ' ASC';
    } else {
        sql += ' ORDER BY category, name';
    }

    db.all(sql, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        // Get categories for filters
        db.all('SELECT DISTINCT category FROM products WHERE is_active = 1 ORDER BY category', [], (err2, categories) => {
            res.json({
                success: true,
                count: rows.length,
                categories: categories.map(c => c.category),
                products: rows
            });
        });
    });
});

// Get single product
app.get('/api/products/:id', (req, res) => {
    db.get('SELECT * FROM products WHERE product_id = ? AND is_active = 1', [req.params.id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json({ success: true, product: row });
    });
});

// ============================================
// SHOPPING CART (LUCAS'S MAIN CODE)
// ============================================

// Get user's cart
app.get('/api/cart/:user_id', (req, res) => {
    const sql = `
        SELECT 
            c.cart_id,
            c.quantity,
            c.added_at,
            p.product_id,
            p.name,
            p.price,
            p.inventory_count,
            p.category,
            ROUND(p.price * c.quantity, 2) as subtotal
        FROM cart_items c
        JOIN products p ON c.product_id = p.product_id
        WHERE c.user_id = ?
        ORDER BY c.added_at DESC
    `;

    db.all(sql, [req.params.user_id], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        const total = rows.reduce((sum, item) => sum + item.subtotal, 0);

        res.json({
            success: true,
            cart: rows,
            item_count: rows.length,
            total: Math.round(total * 100) / 100
        });
    });
});

// Add item to cart
app.post('/api/cart/add', (req, res) => {
    const { user_id, product_id, quantity = 1 } = req.body;

    if (!user_id || !product_id) {
        return res.status(400).json({ error: 'user_id and product_id are required' });
    }

    // Check if product exists and has inventory
    db.get('SELECT * FROM products WHERE product_id = ? AND is_active = 1', [product_id], (err, product) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!product) return res.status(404).json({ error: 'Product not found' });
        if (product.inventory_count < quantity) {
            return res.status(400).json({ error: `Only ${product.inventory_count} available` });
        }

        // Check if already in cart
        db.get('SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?', [user_id, product_id], (err, existing) => {
            if (err) return res.status(500).json({ error: err.message });

            if (existing) {
                // Update quantity
                const newQty = existing.quantity + quantity;
                if (newQty > product.inventory_count) {
                    return res.status(400).json({ error: 'Not enough inventory' });
                }
                db.run('UPDATE cart_items SET quantity = ? WHERE cart_id = ?', [newQty, existing.cart_id], function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json({ success: true, message: 'Cart updated', cart_id: existing.cart_id, quantity: newQty });
                });
            } else {
                // Insert new
                db.run('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)', [user_id, product_id, quantity], function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    res.status(201).json({ success: true, message: 'Added to cart', cart_id: this.lastID, quantity });
                });
            }
        });
    });
});

// Update quantity
app.put('/api/cart/update', (req, res) => {
    const { cart_id, quantity } = req.body;

    if (quantity <= 0) {
        // Remove item
        db.run('DELETE FROM cart_items WHERE cart_id = ?', [cart_id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: 'Item removed from cart' });
        });
        return;
    }

    // Check inventory
    db.get(`SELECT p.inventory_count FROM cart_items c JOIN products p ON c.product_id = p.product_id WHERE c.cart_id = ?`, [cart_id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Cart item not found' });
        if (row.inventory_count < quantity) {
            return res.status(400).json({ error: `Only ${row.inventory_count} available` });
        }

        db.run('UPDATE cart_items SET quantity = ? WHERE cart_id = ?', [quantity, cart_id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: 'Quantity updated', quantity });
        });
    });
});

// Remove item from cart
app.delete('/api/cart/remove/:cart_id', (req, res) => {
    db.run('DELETE FROM cart_items WHERE cart_id = ?', [req.params.cart_id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'Item removed' });
    });
});

// Clear entire cart
app.post('/api/cart/clear/:user_id', (req, res) => {
    db.run('DELETE FROM cart_items WHERE user_id = ?', [req.params.user_id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: `Removed ${this.changes} items` });
    });
});

// ============================================
// CHECKOUT
// ============================================
app.post('/api/checkout', (req, res) => {
    const { user_id, guest_email, shipping_address, billing_address, payment_method } = req.body;

    // Get cart items
    db.all(`
        SELECT c.*, p.price, p.name, p.inventory_count
        FROM cart_items c
        JOIN products p ON c.product_id = p.product_id
        WHERE c.user_id = ?
    `, [user_id], (err, cartItems) => {
        if (err) return res.status(500).json({ error: err.message });
        if (cartItems.length === 0) return res.status(400).json({ error: 'Cart is empty' });

        // Check inventory
        for (let item of cartItems) {
            if (item.inventory_count < item.quantity) {
                return res.status(400).json({ error: `Not enough ${item.name}` });
            }
        }

        // Calculate total
        const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        // Start transaction
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            // Create order
            db.run(`
                INSERT INTO orders (user_id, guest_email, total_amount, shipping_address, billing_address, payment_method, order_status)
                VALUES (?, ?, ?, ?, ?, ?, 'confirmed')
            `, [user_id, guest_email, total, JSON.stringify(shipping_address), JSON.stringify(billing_address), payment_method], function(err) {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: err.message });
                }

                const orderId = this.lastID;

                // Add order items and update inventory
                let completed = 0;
                cartItems.forEach(item => {
                    db.run('INSERT INTO order_items (order_id, product_id, product_name, quantity, price_at_time) VALUES (?, ?, ?, ?, ?)',
                        [orderId, item.product_id, item.name, item.quantity, item.price]);

                    db.run('UPDATE products SET inventory_count = inventory_count - ? WHERE product_id = ?',
                        [item.quantity, item.product_id]);

                    completed++;
                    if (completed === cartItems.length) {
                        // Clear cart
                        db.run('DELETE FROM cart_items WHERE user_id = ?', [user_id], () => {
                            db.run('COMMIT');
                            res.status(201).json({
                                success: true,
                                message: 'Order placed!',
                                order_id: orderId,
                                total: Math.round(total * 100) / 100,
                                items: cartItems.length
                            });
                        });
                    }
                });
            });
        });
    });
});

// ============================================
// AUTH ROUTES - Register & Login
// ============================================

// Register a new user
// POST /api/register
// Body: { email, password, full_name, phone? }
app.post('/api/register', (req, res) => {
    const { email, password, full_name, phone } = req.body;

    if (!email || !password || !full_name) {
        return res.status(400).json({ error: 'email, password, and full_name are required' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const password_hash = hashPassword(password);

    db.run(
        `INSERT INTO users (email, password_hash, full_name, phone, is_admin) VALUES (?, ?, ?, ?, 0)`,
        [email.toLowerCase().trim(), password_hash, full_name, phone || null],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(409).json({ error: 'An account with this email already exists' });
                }
                return res.status(500).json({ error: err.message });
            }
            const token = signToken({ user_id: this.lastID, email, full_name, is_admin: false, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
            res.status(201).json({
                success: true,
                message: 'Account created successfully',
                token,
                user: { user_id: this.lastID, email, full_name, is_admin: false }
            });
        }
    );
});

// Login
// POST /api/login
// Body: { email, password }
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'email and password are required' });
    }

    const password_hash = hashPassword(password);

    db.get(
        `SELECT user_id, email, full_name, is_admin FROM users WHERE email = ? AND password_hash = ?`,
        [email.toLowerCase().trim(), password_hash],
        (err, user) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!user) return res.status(401).json({ error: 'Invalid email or password' });

            const token = signToken({ user_id: user.user_id, email: user.email, full_name: user.full_name, is_admin: !!user.is_admin, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
            res.json({
                success: true,
                message: 'Login successful',
                token,
                user: { user_id: user.user_id, email: user.email, full_name: user.full_name, is_admin: !!user.is_admin }
            });
        }
    );
});

// Get current logged-in user profile
// GET /api/me  (requires Authorization: Bearer <token>)
app.get('/api/me', requireAuth, (req, res) => {
    db.get(
        `SELECT user_id, email, full_name, address_line1, address_line2, city, state, zip_code, phone, is_admin, created_at FROM users WHERE user_id = ?`,
        [req.user.user_id],
        (err, user) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!user) return res.status(404).json({ error: 'User not found' });
            res.json({ success: true, user });
        }
    );
});

// Update profile
// PUT /api/me  (requires login)
// Body: { full_name?, address_line1?, city?, state?, zip_code?, phone? }
app.put('/api/me', requireAuth, (req, res) => {
    const { full_name, address_line1, address_line2, city, state, zip_code, phone } = req.body;
    db.run(
        `UPDATE users SET full_name=COALESCE(?,full_name), address_line1=COALESCE(?,address_line1),
         address_line2=COALESCE(?,address_line2), city=COALESCE(?,city), state=COALESCE(?,state),
         zip_code=COALESCE(?,zip_code), phone=COALESCE(?,phone) WHERE user_id=?`,
        [full_name, address_line1, address_line2, city, state, zip_code, phone, req.user.user_id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: 'Profile updated' });
        }
    );
});

// ============================================
// ADMIN ROUTES - Product & Inventory Management
// All routes below require admin login
// Header: Authorization: Bearer <token>
// ============================================

// Get all products including inactive (admin view)
// GET /api/admin/products
app.get('/api/admin/products', requireAdmin, (req, res) => {
    db.all(`SELECT * FROM products ORDER BY category, name`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, count: rows.length, products: rows });
    });
});

// Add a new product
// POST /api/admin/products
// Body: { name, description?, price, inventory_count, category, image_url? }
app.post('/api/admin/products', requireAdmin, (req, res) => {
    const { name, description, price, inventory_count, category, image_url } = req.body;

    if (!name || price === undefined || inventory_count === undefined || !category) {
        return res.status(400).json({ error: 'name, price, inventory_count, and category are required' });
    }
    if (price < 0) return res.status(400).json({ error: 'Price cannot be negative' });
    if (inventory_count < 0) return res.status(400).json({ error: 'Inventory cannot be negative' });

    db.run(
        `INSERT INTO products (name, description, price, inventory_count, category, image_url, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [name, description || null, price, inventory_count, category, image_url || null],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ success: true, message: 'Product added', product_id: this.lastID });
        }
    );
});

// Edit a product
// PUT /api/admin/products/:id
// Body: any fields to update
app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
    const { name, description, price, inventory_count, category, image_url, is_active } = req.body;

    db.get(`SELECT * FROM products WHERE product_id = ?`, [req.params.id], (err, product) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!product) return res.status(404).json({ error: 'Product not found' });

        db.run(
            `UPDATE products SET
                name = ?,
                description = ?,
                price = ?,
                inventory_count = ?,
                category = ?,
                image_url = ?,
                is_active = ?
            WHERE product_id = ?`,
            [
                name ?? product.name,
                description ?? product.description,
                price ?? product.price,
                inventory_count ?? product.inventory_count,
                category ?? product.category,
                image_url ?? product.image_url,
                is_active ?? product.is_active,
                req.params.id
            ],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, message: 'Product updated' });
            }
        );
    });
});

// Delete a product (soft delete - marks inactive)
// DELETE /api/admin/products/:id
app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
    db.run(`UPDATE products SET is_active = 0 WHERE product_id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Product not found' });
        res.json({ success: true, message: 'Product removed from store' });
    });
});

// Adjust inventory only (quick update for admin dashboard)
// PATCH /api/admin/products/:id/inventory
// Body: { inventory_count }
app.patch('/api/admin/products/:id/inventory', requireAdmin, (req, res) => {
    const { inventory_count } = req.body;
    if (inventory_count === undefined || inventory_count < 0) {
        return res.status(400).json({ error: 'inventory_count must be 0 or more' });
    }
    db.run(`UPDATE products SET inventory_count = ? WHERE product_id = ?`, [inventory_count, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Product not found' });
        res.json({ success: true, message: 'Inventory updated', inventory_count });
    });
});

// Get all orders (admin view)
// GET /api/admin/orders
app.get('/api/admin/orders', requireAdmin, (req, res) => {
    db.all(
        `SELECT o.*, u.email, u.full_name FROM orders o LEFT JOIN users u ON o.user_id = u.user_id ORDER BY o.created_at DESC`,
        [],
        (err, orders) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, count: orders.length, orders });
        }
    );
});

// Get all users (admin view)
// GET /api/admin/users
app.get('/api/admin/users', requireAdmin, (req, res) => {
    db.all(`SELECT user_id, email, full_name, city, state, phone, is_admin, created_at FROM users ORDER BY created_at DESC`, [], (err, users) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, count: users.length, users });
    });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
    console.log('');
    console.log('============================================');
    console.log('🛒  E-COMMERCE CART API - LOCAL DEV SERVER');
    console.log('============================================');
    console.log(`🚀 Server running at: http://localhost:${PORT}`);
    console.log('');
    console.log('📋 Public routes:');
    console.log(`   Health:    GET  http://localhost:${PORT}/api/health`);
    console.log(`   Products:  GET  http://localhost:${PORT}/api/products`);
    console.log(`   Cart:      GET  http://localhost:${PORT}/api/cart/1`);
    console.log('');
    console.log('🔐 Auth routes:');
    console.log(`   Register:  POST http://localhost:${PORT}/api/register`);
    console.log(`   Login:     POST http://localhost:${PORT}/api/login`);
    console.log(`   Profile:   GET  http://localhost:${PORT}/api/me  (token required)`);
    console.log('');
    console.log('🛡️  Admin routes (admin token required):');
    console.log(`   Products:  GET/POST  http://localhost:${PORT}/api/admin/products`);
    console.log(`   Edit:      PUT       http://localhost:${PORT}/api/admin/products/:id`);
    console.log(`   Delete:    DELETE    http://localhost:${PORT}/api/admin/products/:id`);
    console.log(`   Inventory: PATCH     http://localhost:${PORT}/api/admin/products/:id/inventory`);
    console.log(`   Orders:    GET       http://localhost:${PORT}/api/admin/orders`);
    console.log(`   Users:     GET       http://localhost:${PORT}/api/admin/users`);
    console.log('');
    console.log('🧪 Test admin login: admin@example.com / password123');
    console.log('🧪 Test user login:  test@example.com  / password123');
    console.log('============================================');
    console.log('');
    console.log('Press Ctrl+C to stop the server');
});
