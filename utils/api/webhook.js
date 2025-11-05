import Stripe from 'stripe';

const stripe = new Stripe('sk_test_YOUR_STRIPE_SECRET_KEY'); // Same key

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
// TEMU ORDER PLACEMENT
// ==============================================

async function placeTemuOrder(temuId, customerDetails, session, env) {
    try {
        console.log(`[Webhook] Placing Temu order for product ${temuId}`);

        // Get Temu API credentials from environment
        const temuApiKey = env.TEMU_API_KEY;
        const temuApiUrl = env.TEMU_API_URL || 'https://api.temu.com/v1/orders';

        if (!temuApiKey) {
            throw new Error('TEMU_API_KEY not configured');
        }

        // Prepare order data for Temu
        const orderData = {
            productId: temuId,
            quantity: 1,
            customer: {
                name: customerDetails.name,
                email: customerDetails.email,
                // Add shipping address if available
                shippingAddress: session.shipping_details || customerDetails.address
            },
            metadata: {
                stripeSessionId: session.id,
                stripePaymentIntent: session.payment_intent,
                orderDate: new Date().toISOString()
            }
        };

        const response = await fetch(temuApiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${temuApiKey}`,
                'Content-Type': 'application/json',
                'X-API-Version': 'v1'
            },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Webhook] Temu API error: ${response.status} - ${errorText}`);
            throw new Error(`Temu order failed: ${response.status} ${response.statusText}`);
        }

        const temuOrder = await response.json();
        console.log(`[Webhook] Temu order placed successfully: ${temuOrder.orderId || temuOrder.id}`);

        return temuOrder;

    } catch (error) {
        console.error('[Webhook] Error placing Temu order:', error);
        throw error;
    }
}

// ==============================================
// ORDER FULFILLMENT
// ==============================================

async function handleOrderFulfillment(session, env) {
    try {
        const { productId, temuId, markup, originalPrice, finalPrice } = session.metadata;

        console.log(`[Webhook] Processing order fulfillment for session ${session.id}`, {
            productId,
            temuId,
            amount: session.amount_total / 100,
            customerEmail: session.customer_details?.email
        });

        // Place order with Temu
        const temuOrder = await placeTemuOrder(temuId, session.customer_details, session, env);

        // Update Stripe customer metadata for tracking
        if (session.customer) {
            try {
                await fetch(`https://api.stripe.com/v1/customers/${session.customer}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams({
                        'metadata[order_fulfilled]': 'true',
                        'metadata[temu_order_id]': temuOrder.orderId || temuOrder.id,
                        'metadata[fulfillment_date]': new Date().toISOString(),
                        'metadata[product_id]': productId,
                        'metadata[temu_id]': temuId
                    }).toString()
                });
                console.log(`[Webhook] Updated customer metadata for ${session.customer}`);
            } catch (error) {
                console.error('[Webhook] Error updating customer metadata:', error);
                // Don't fail the whole process for metadata update errors
            }
        }

        // Send notification (you could add email/Slack here)
        console.log(`[Webhook] ✅ Order fulfilled: ${productId} -> Temu order ${temuOrder.orderId || temuOrder.id}`);

        return {
            success: true,
            temuOrderId: temuOrder.orderId || temuOrder.id,
            productId,
            customerEmail: session.customer_details?.email
        };

    } catch (error) {
        console.error('[Webhook] Order fulfillment failed:', error);

        // Mark order as failed in metadata
        if (session.customer) {
            try {
                await fetch(`https://api.stripe.com/v1/customers/${session.customer}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams({
                        'metadata[order_fulfilled]': 'false',
                        'metadata[fulfillment_error]': error.message,
                        'metadata[error_date]': new Date().toISOString()
                    }).toString()
                });
            } catch (metaError) {
                console.error('[Webhook] Error updating failure metadata:', metaError);
            }
        }

        throw error;
    }
}

// ==============================================
// WEBHOOK HANDLER
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

        const sig = request.headers.get('stripe-signature');
        let event;

        try {
            event = stripe.webhooks.constructEvent(await request.text(), sig, env.STRIPE_WEBHOOK_SECRET);
        } catch (err) {
            console.error('[Webhook] Signature verification failed:', err.message);
            return new Response(`Webhook signature verification failed.`, {
                status: 400,
                headers: corsHeaders()
            });
        }

        try {
            // Handle successful checkout
            if (event.type === 'checkout.session.completed') {
                const session = event.data.object;

                // Only process dropshipping orders (those with temuId metadata)
                if (session.metadata?.temuId) {
                    await handleOrderFulfillment(session, env);
                } else {
                    console.log(`[Webhook] Ignoring non-dropshipping session ${session.id}`);
                }
            }

            // Handle other webhook events as needed
            console.log(`[Webhook] Processed event: ${event.type}`);

            return new Response(JSON.stringify({ received: true }), {
                status: 200,
                headers: { "Content-Type": "application/json", ...corsHeaders() }
            });

        } catch (error) {
            console.error('[Webhook] Error processing webhook:', error);
            return new Response(JSON.stringify({
                error: "Webhook processing failed",
                details: error.message
            }), {
                status: 500,
                headers: { "Content-Type": "application/json", ...corsHeaders() }
            });
        }
    }
};