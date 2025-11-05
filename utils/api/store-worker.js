import Stripe from 'stripe';
import { testPriceCreation, listExistingPrices } from './price-utils.js';

// ==============================================
// UTILITIES & SETUP
// ==============================================

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

const stripe = new Stripe('sk_test_YOUR_STRIPE_SECRET_KEY');

// ==============================================
// DYNAMIC PRICE MANAGEMENT
// ==============================================

async function getOrCreatePrice(productData, env) {
  try {
    const { name, amount, temuId, markup } = productData;

    // Check if product exists
    const productsResponse = await fetch('https://api.stripe.com/v1/products?active=true', {
      headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` }
    });
    const products = await productsResponse.json();
    let product = products.data.find(p => p.metadata?.temuId === temuId);

    if (!product) {
      // Create product
      const createProductResponse = await fetch('https://api.stripe.com/v1/products', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `name=${encodeURIComponent(name)}&metadata[temuId]=${temuId}&metadata[markup]=${markup}`
      });
      product = await createProductResponse.json();
      console.log(`[Store Worker] Created product: ${product.id} for Temu ID: ${temuId}`);
    }

    // Check if price exists for this amount
    const pricesResponse = await fetch(`https://api.stripe.com/v1/prices?product=${product.id}&active=true`, {
      headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` }
    });
    const prices = await pricesResponse.json();
    let price = prices.data.find(p => p.unit_amount === amount);

    if (!price) {
      // Create price
      const createPriceResponse = await fetch('https://api.stripe.com/v1/prices', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `product=${product.id}&unit_amount=${amount}&currency=usd`
      });
      price = await createPriceResponse.json();
      console.log(`[Store Worker] Created price: ${price.id} for $${amount/100} (Temu ID: ${temuId})`);
    }

    return price.id;
  } catch (error) {
    console.error(`[Store Worker] Error creating/getting price for ${productData.name}:`, error);
    throw error;
  }
}

// ==============================================
// MAIN WORKER ROUTER
// ==============================================

export default {
    async fetch(request, env) {
        // Handle CORS
        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: corsHeaders()
            });
        }

        const url = new URL(request.url);
        const pathname = url.pathname;

        try {
            // Route: Create checkout session
            if (pathname === "/api/create-checkout-session" && request.method === "POST") {
                const { productId, price, name, temuId, markup } = await request.json();

                // Validate required fields
                if (!productId || !price || !name || !temuId) {
                    return new Response(JSON.stringify({
                        error: "Missing required fields: productId, price, name, temuId"
                    }), {
                        status: 400,
                        headers: { "Content-Type": "application/json", ...corsHeaders() }
                    });
                }

                // Create or get price dynamically
                const priceId = await getOrCreatePrice({
                    name,
                    amount: Math.round(price * 100), // Convert to cents
                    temuId,
                    markup: markup || 0.3
                }, env);

                // Create checkout session
                const session = await stripe.checkout.sessions.create({
                    payment_method_types: ['card'],
                    line_items: [{
                        price: priceId,
                        quantity: 1,
                    }],
                    mode: 'payment',
                    success_url: `${new URL(request.url).origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
                    cancel_url: `${new URL(request.url).origin}/`,
                    metadata: {
                        productId,
                        temuId,
                        markup: markup || 0.3,
                        originalPrice: price,
                        finalPrice: price
                    }
                });

                console.log(`[Store Worker] Created session ${session.id} for product ${productId}`);

                return new Response(JSON.stringify({
                    success: true,
                    sessionId: session.id,
                    url: session.url
                }), {
                    status: 200,
                    headers: { "Content-Type": "application/json", ...corsHeaders() }
                });
            }

            // Route: Test price creation
            if (pathname === "/api/test-prices" && request.method === "POST") {
                const createdPrices = await testPriceCreation(env);
                return new Response(JSON.stringify({
                    success: true,
                    message: "Test prices created successfully",
                    prices: createdPrices
                }), {
                    status: 200,
                    headers: { "Content-Type": "application/json", ...corsHeaders() }
                });
            }

            // Route: List prices
            if (pathname === "/api/test-prices" && request.method === "GET") {
                const prices = await listExistingPrices(env);
                return new Response(JSON.stringify({
                    success: true,
                    prices: prices
                }), {
                    status: 200,
                    headers: { "Content-Type": "application/json", ...corsHeaders() }
                });
            }

            // Default response
            return new Response("Store API - Use specific endpoints", {
                status: 200,
                headers: { "Content-Type": "text/plain", ...corsHeaders() }
            });

        } catch (error) {
            console.error('[Store Worker] Error:', error);
            return new Response(JSON.stringify({
                error: "API request failed",
                details: error.message
            }), {
                status: 500,
                headers: { "Content-Type": "application/json", ...corsHeaders() }
            });
        }
    }
};