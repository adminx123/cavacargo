# Curated Affiliate Store

A modern affiliate marketing platform for curated Temu products with automated product discovery and commission tracking.

## 🏗️ Project Structure

```
cavacargo/
├── index.html              # Store homepage with product display
├── success.html            # Payment success page
├── assets/                 # Static assets
│   ├── style/
│   │   └── style.css      # Store styling
│   └── media/             # Product images and media
├── api/                    # Cloudflare Workers
│   ├── store-worker.js    # Main store API (checkout, pricing)
│   ├── webhook.js         # Stripe webhook handler
│   ├── fetch-product.js   # Temu API integration
│   └── price-utils.js     # Price management utilities
├── config/                 # Configuration files
│   ├── products.json      # Product catalog with temuIds and markups
│   └── wrangler.toml      # Cloudflare Worker configuration
├── legal/                  # Legal documents
│   ├── box                # Terms of service
│   └── tos.pdf           # Terms PDF
├── .wrangler/             # Worker deployment files
├── package.json           # Dependencies
├── WORKER_README.md       # Worker documentation
└── CNAME                  # Domain configuration
```

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   npx wrangler secret put STRIPE_SECRET_KEY
   npx wrangler secret put STRIPE_WEBHOOK_SECRET
   npx wrangler secret put TEMU_API_KEY
   ```

3. **Deploy:**
   ```bash
   npm run deploy
   ```

## 📋 Features

- **Automated Pricing**: Dynamic Stripe price creation with markup
- **Temu Integration**: Automatic product data fetching and order fulfillment
- **Responsive Design**: Modern black/white store theme
- **Secure Payments**: Stripe Checkout integration
- **Webhook Processing**: Automated order fulfillment on payment success

## 🔧 Configuration

### Products
Edit `config/products.json` to add new products:
```json
[
  {
    "id": "gadget1",
    "temuId": "TEMU12345",
    "markup": 0.3
  }
]
```

### Styling
Customize the store appearance in `assets/style/style.css`.

### Legal
Update terms of service in `legal/box` and `legal/tos.pdf`.

## 📚 Documentation

- [Worker API Documentation](./WORKER_README.md)
- [Stripe Integration Guide](https://stripe.com/docs)
- [Temu API Documentation](https://api.temu.com/docs)

## 🛠️ Development

```bash
# Local development
npm run dev

# Test deployment
npm run test

# Deploy to production
npm run deploy
```