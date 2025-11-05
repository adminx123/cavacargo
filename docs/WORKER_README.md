# Dropshipping Store Worker Setup

## Overview
Your Cloudflare Worker now automatically creates Stripe prices when products are purchased, eliminating manual Stripe dashboard work.

## Key Features
- **Dynamic Price Creation**: Prices are created automatically when checkout sessions are initiated
- **Temu Integration**: Automatic order placement with Temu API on successful payment
- **Markup Support**: Configurable markup percentages per product
- **Error Handling**: Robust error handling and logging
- **CORS Support**: Proper CORS headers for frontend integration

## API Endpoints

### Create Checkout Session
```
POST /api/create-checkout-session
```
Creates a Stripe checkout session and automatically creates the price if it doesn't exist.

**Request Body:**
```json
{
  "productId": "gadget1",
  "price": 32.99,
  "name": "Wireless Earbuds",
  "temuId": "TEMU12345",
  "markup": 0.3
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/..."
}
```

### Test Price Creation
```
POST /api/test-prices
```
Creates sample prices for testing.

### List Prices
```
GET /api/test-prices
```
Lists all existing Stripe prices.

## Environment Variables
Set these in your Cloudflare Worker secrets:

- `STRIPE_SECRET_KEY`: Your Stripe secret key
- `STRIPE_WEBHOOK_SECRET`: Your Stripe webhook endpoint secret
- `TEMU_API_KEY`: Your Temu API key
- `TEMU_API_URL`: Temu API base URL (default: https://api.temu.com/v1/orders)

## How It Works

1. **Product Display**: Frontend fetches product data from Temu API using `/api/fetch-product`
2. **Price Calculation**: Frontend calculates final price with markup
3. **Checkout Creation**: Frontend calls `/api/create-checkout-session` with product details
4. **Dynamic Pricing**: Worker creates Stripe product/price if it doesn't exist
5. **Payment**: Customer completes payment on Stripe Checkout
6. **Order Fulfillment**: Webhook triggers Temu order placement

## Testing

1. Deploy the worker: `wrangler deploy`
2. Test price creation: `curl -X POST https://yourdomain.com/api/test-prices`
3. Check created prices: `curl https://yourdomain.com/api/test-prices`

## Benefits

- ✅ No manual Stripe price creation
- ✅ Automatic markup application
- ✅ Seamless Temu integration
- ✅ Robust error handling
- ✅ Scalable for multiple products