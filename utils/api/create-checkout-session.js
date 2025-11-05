import Stripe from 'stripe';

const stripe = new Stripe('sk_test_YOUR_STRIPE_SECRET_KEY'); // Replace with your secret key

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

// ==============================================
// DYNAMIC PRICE MANAGEMENT
// ==============================================

/**
 * Creates or retrieves a Stripe price for a product
 * This avoids manual price creation in Stripe dashboard
 */
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
      console.log(`[Checkout Worker] Created product: ${product.id} for Temu ID: ${temuId}`);
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
      console.log(`[Checkout Worker] Created price: ${price.id} for $${amount/100} (Temu ID: ${temuId})`);
    }

    return price.id;
  } catch (error) {
    console.error(`[Checkout Worker] Error creating/getting price for ${productData.name}:`, error);
    throw error;
  }
}

// ==============================================
// CHECKOUT SESSION CREATION
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

        if (request.method !== 'POST') {
            return new Response('Method not allowed', {
                status: 405,
                headers: corsHeaders()
            });
        }

        try {
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

            console.log(`[Checkout Worker] Created session ${session.id} for product ${productId}`);

            return new Response(JSON.stringify({
                success: true,
                sessionId: session.id,
                url: session.url
            }), {
                status: 200,
                headers: { "Content-Type": "application/json", ...corsHeaders() }
            });

        } catch (error) {
            console.error('[Checkout Worker] Error:', error);
            return new Response(JSON.stringify({
                error: "Failed to create checkout session",
                details: error.message
            }), {
                status: 500,
                headers: { "Content-Type": "application/json", ...corsHeaders() }
            });
        }
    }
};