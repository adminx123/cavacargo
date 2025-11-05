export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const pathname = url.pathname;

        // Handle CORS
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type"
                }
            });
        }

        try {
            if (pathname === "/api/products" && request.method === "GET") {
                // List all products
                const products = await env.PRODUCTS.list();
                const productList = [];
                for (const key of products.keys) {
                    const product = await env.PRODUCTS.get(key.name);
                    if (product) {
                        productList.push(JSON.parse(product));
                    }
                }
                return new Response(JSON.stringify(productList), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } else if (pathname === "/api/products" && request.method === "POST") {
                // Add a new product
                const { temuId, markup = 0.3 } = await request.json();
                if (!temuId) {
                    return new Response('Missing temuId', { status: 400 });
                }

                // Fetch from Temu API
                const temuResponse = await fetch(`https://api.temu.com/products/${temuId}`, {
                    headers: {
                        'Authorization': `Bearer ${env.TEMU_API_KEY}`
                    }
                });

                if (!temuResponse.ok) {
                    throw new Error('Temu API error');
                }

                const temuData = await temuResponse.json();
                const sellingPrice = Math.round(temuData.price * (1 + markup));

                const productData = {
                    id: temuId,
                    temuId,
                    markup,
                    name: temuData.name,
                    description: temuData.description,
                    images: temuData.images,
                    temuPrice: temuData.price,
                    sellingPrice
                };

                // Store in KV
                await env.PRODUCTS.put(temuId, JSON.stringify(productData));

                return new Response(JSON.stringify(productData), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } else if (pathname.startsWith("/api/products/") && request.method === "GET") {
                // Get specific product
                const temuId = pathname.split("/api/products/")[1];
                const product = await env.PRODUCTS.get(temuId);
                if (!product) {
                    return new Response('Product not found', { status: 404 });
                }
                return new Response(product, {
                    headers: { 'Content-Type': 'application/json' }
                });
            } else if (pathname === "/api/fetch-product" && request.method === "GET") {
                // Legacy single fetch
                const temuId = url.searchParams.get('temuId');
                const markup = parseFloat(url.searchParams.get('markup')) || 0;

                if (!temuId) {
                    return new Response('Missing temuId', { status: 400 });
                }

                const temuResponse = await fetch(`https://api.temu.com/products/${temuId}`, {
                    headers: {
                        'Authorization': `Bearer ${env.TEMU_API_KEY}`
                    }
                });

                if (!temuResponse.ok) {
                    throw new Error('Temu API error');
                }

                const temuData = await temuResponse.json();
                const sellingPrice = Math.round(temuData.price * (1 + markup));

                const productData = {
                    name: temuData.name,
                    description: temuData.description,
                    images: temuData.images,
                    temuPrice: temuData.price,
                    sellingPrice
                };

                return new Response(JSON.stringify(productData), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } else {
                return new Response('Not found', { status: 404 });
            }
        } catch (error) {
            console.error('Error:', error);
            return new Response('Error', { status: 500 });
        }
    }
};