# 🛒 ShopCloud — Mini E-Commerce Cloud Application

> **Group 12** · Full-Stack Web App deployed on AWS EC2

[![Live](https://img.shields.io/badge/Live-AWS%20EC2-orange?style=for-the-badge&logo=amazon-aws)](http://18.232.129.235:3000)
[![Node.js](https://img.shields.io/badge/Node.js-Express-green?style=for-the-badge&logo=node.js)](http://18.232.129.235:3000)
[![SQLite](https://img.shields.io/badge/Database-SQLite-blue?style=for-the-badge&logo=sqlite)](http://18.232.129.235:3000)

---

## 🌐 Live Application

| Page | URL | Description |
|------|-----|-------------|
| 🏠 **Homepage** | [18.232.129.235:3000](http://18.232.129.235:3000) | Amazon-style homepage with all products |
| 🛍️ **Shop** | [/shop.html](http://18.232.129.235:3000/shop.html) | Browse, filter, sort and add to cart |
| 🔐 **Login / Register** | [/auth.html](http://18.232.129.235:3000/auth.html) | Create account or sign in |
| 👤 **Account Profile** | [/profile.html](http://18.232.129.235:3000/profile.html) | Edit profile, address and order history |
| 📦 **Product Detail** | [/product.html?id=1](http://18.232.129.235:3000/product.html?id=1) | Single product page |
| 🛡️ **Admin Dashboard** | [/admin.html](http://18.232.129.235:3000/admin.html) | Manage products, inventory and orders |
| 📬 **Contact Us** | [/contact.html](http://18.232.129.235:3000/contact.html) | Customer support form |

> **Admin Login:** admin@example.com / password123

---

## Features

- Browse 10+ products with category filters, price sorting and live search
- Shopping cart with quantity controls and full checkout flow
- User registration and login with JWT token authentication
- Guest checkout supported — no account required
- Admin dashboard to add, edit, delete products and adjust inventory
- Live inventory tracking with Sold Out badges
- Account profile with saved shipping address and order history
- Deployed permanently on AWS EC2 with pm2 auto-restart

---

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js + Express.js
- **Database:** SQLite (dev) + AWS RDS MySQL (configured)
- **Auth:** JWT tokens (custom HMAC-SHA256)
- **Cloud:** AWS EC2, RDS, IAM
- **DevOps:** pm2, GitHub

---

## Team — Group 12

- **Vineesha Nadendla** — AWS Infrastructure, Admin UI, Auth, Shop, Deployment, Products page, Filters, Contact Us 
- **Keerthi Sudha** — Presentations
- **Lucas Langstraat** — Backend API, SQLite database, Cart and Checkout
