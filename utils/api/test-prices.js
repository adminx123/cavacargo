import { testPriceCreation, listExistingPrices } from './price-utils.js';

// ==============================================
// PRICE MANAGEMENT WORKER
// ==============================================

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

export default {
    async fetch(request, env) {
        // Handle CORS
        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: corsHeaders()
            });
        }

        try {
            if (request.method === "POST") {
                // Create test prices
                const createdPrices = await testPriceCreation(env);
                return new Response(JSON.stringify({
                    success: true,
                    message: "Test prices created successfully",
                    prices: createdPrices
                }), {
                    status: 200,
                    headers: { "Content-Type": "application/json", ...corsHeaders() }
                });

            } else if (request.method === "GET") {
                // List existing prices
                const prices = await listExistingPrices(env);
                return new Response(JSON.stringify({
                    success: true,
                    prices: prices
                }), {
                    status: 200,
                    headers: { "Content-Type": "application/json", ...corsHeaders() }
                });
            }

            return new Response("Method not allowed", {
                status: 405,
                headers: corsHeaders()
            });

        } catch (error) {
            console.error('[Price Test Worker] Error:', error);
            return new Response(JSON.stringify({
                error: "Price management failed",
                details: error.message
            }), {
                status: 500,
                headers: { "Content-Type": "application/json", ...corsHeaders() }
            });
        }
    }
};