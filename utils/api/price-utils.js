// ==============================================
// PRICE MANAGEMENT UTILITIES
// ==============================================

/**
 * Test script to create and list Stripe prices for dropshipping products
 * Run this in your worker environment to verify price creation works
 */

async function testPriceCreation(env) {
  try {
    console.log("[Test] Creating test prices for dropshipping products...");

    // Test products with different markups
    const testProducts = [
      { name: "Wireless Earbuds", temuId: "TEMU12345", markup: 0.3, basePrice: 25.99 },
      { name: "Smart Watch", temuId: "TEMU67890", markup: 0.25, basePrice: 49.99 },
      { name: "Bluetooth Speaker", temuId: "TEMU11111", markup: 0.4, basePrice: 19.99 }
    ];

    const createdPrices = [];

    for (const product of testProducts) {
      const finalPrice = product.basePrice * (1 + product.markup);

      // Create product in Stripe
      const productResponse = await fetch('https://api.stripe.com/v1/products', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          name: product.name,
          description: `Dropship product with ${product.markup * 100}% markup`,
          'metadata[temuId]': product.temuId,
          'metadata[markup]': product.markup.toString(),
          'metadata[basePrice]': product.basePrice.toString()
        }).toString()
      });

      if (!productResponse.ok) {
        console.error(`Failed to create product ${product.name}`);
        continue;
      }

      const stripeProduct = await productResponse.json();

      // Create price for this product
      const priceResponse = await fetch('https://api.stripe.com/v1/prices', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          product: stripeProduct.id,
          unit_amount: Math.round(finalPrice * 100), // Convert to cents
          currency: 'usd',
          nickname: `${product.name} - $${finalPrice.toFixed(2)}`
        }).toString()
      });

      if (priceResponse.ok) {
        const price = await priceResponse.json();
        createdPrices.push({
          temuId: product.temuId,
          name: product.name,
          basePrice: product.basePrice,
          markup: product.markup,
          finalPrice: finalPrice,
          stripePriceId: price.id,
          stripeProductId: stripeProduct.id
        });
        console.log(`✅ Created price for ${product.name}: $${finalPrice.toFixed(2)} (${price.id})`);
      } else {
        console.error(`Failed to create price for ${product.name}`);
      }
    }

    return createdPrices;

  } catch (error) {
    console.error('[Test] Error in price creation:', error);
    throw error;
  }
}

async function listExistingPrices(env) {
  try {
    console.log("[Test] Listing existing Stripe prices...");

    const response = await fetch('https://api.stripe.com/v1/prices?limit=20', {
      headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` }
    });

    if (!response.ok) {
      throw new Error(`Failed to list prices: ${response.status}`);
    }

    const prices = await response.json();

    console.log(`Found ${prices.data.length} prices:`);
    prices.data.forEach(price => {
      console.log(`- ${price.id}: ${price.nickname || 'Unnamed'} - $${price.unit_amount / 100} ${price.currency.toUpperCase()}`);
    });

    return prices.data;

  } catch (error) {
    console.error('[Test] Error listing prices:', error);
    throw error;
  }
}

// Export for use in worker
export { testPriceCreation, listExistingPrices };