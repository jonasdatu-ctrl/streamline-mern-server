/**
 * Shopify GraphQL Client
 *
 * Handles communication with Shopify GraphQL Admin API
 * Implements rate limiting to respect Shopify's request limits
 * Shopify API uses a cost-based system instead of simple rate limiting
 */

const https = require("https");

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  // Maximum requests per second
  requestsPerSecond: 2,
  // Maximum concurrent requests
  maxConcurrentRequests: 5,
};

// Track rate limiting state
let requestQueue = [];
let activeRequests = 0;
let lastRequestTime = Date.now();

/**
 * Wait between requests to respect rate limits
 */
const waitForRateLimit = async () => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  const minTimeBetweenRequests = 1000 / RATE_LIMIT_CONFIG.requestsPerSecond;

  if (timeSinceLastRequest < minTimeBetweenRequests) {
    const waitTime = minTimeBetweenRequests - timeSinceLastRequest;
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
};

/**
 * Wait for concurrent request slot to be available
 */
const waitForConcurrentSlot = async () => {
  while (activeRequests >= RATE_LIMIT_CONFIG.maxConcurrentRequests) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
};

/**
 * Execute GraphQL query with automatic rate limiting
 *
 * @param {string} query - GraphQL query string
 * @param {Object} variables - GraphQL variables
 * @returns {Promise<Object>} GraphQL response data
 * @throws {Error} If request fails or order not found
 */
const executeGraphQLQuery = async (query, variables = {}) => {
  try {
    await waitForConcurrentSlot();
    activeRequests++;

    await waitForRateLimit();

    const shopUrl = process.env.SHOPIFY_SHOP_URL;
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

    if (!shopUrl || !accessToken) {
      throw new Error(
        "Missing Shopify credentials. Set SHOPIFY_SHOP_URL and SHOPIFY_ACCESS_TOKEN in environment variables.",
      );
    }

    const options = {
      hostname: shopUrl.replace("https://", "").replace("http://", ""),
      port: 443,
      path: "/admin/api/2024-01/graphql.json",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
    };

    return new Promise((resolve, reject) => {
      const request = https.request(options, (response) => {
        let data = "";

        response.on("data", (chunk) => {
          data += chunk;
        });

        response.on("end", () => {
          activeRequests--;

          try {
            const parsed = JSON.parse(data);

            // Check for GraphQL errors
            if (parsed.errors) {
              const errorMessages = parsed.errors
                .map((e) => e.message)
                .join(", ");
              reject(new Error(`GraphQL Error: ${errorMessages}`));
              return;
            }

            // Log rate limit info if available
            if (response.headers["api-call-limit"]) {
              console.log(
                `Shopify API Rate Limit: ${response.headers["api-call-limit"]}`,
              );
            }

            resolve(parsed.data);
          } catch (parseError) {
            activeRequests--;
            reject(
              new Error(
                `Failed to parse Shopify response: ${parseError.message}`,
              ),
            );
          }
        });
      });

      request.on("error", (error) => {
        activeRequests--;
        reject(error);
      });

      request.write(JSON.stringify({ query, variables }));
      request.end();
    });
  } catch (error) {
    activeRequests--;
    throw error;
  }
};

/**
 * Fetch order by order ID from Shopify
 *
 * @param {number|string} orderId - Shopify order ID (numeric)
 * @returns {Promise<Object>} Order data from Shopify
 * @throws {Error} If order not found or API error occurs
 */
const fetchOrderById = async (orderId) => {
  // GraphQL query to fetch order details
  const query = `
    query FetchOrder($id: ID!) {
      order(id: $id) {
        id
        name
        createdAt
        updatedAt
        processedAt
        displayFulfillmentStatus
        displayFinancialStatus
        email
        phone
        customer {
          id
          firstName
          lastName
          email
          phone
        }
        billingAddress {
          firstName
          lastName
          address1
          address2
          city
          province
          zip
          country
        }
        shippingAddress {
          firstName
          lastName
          address1
          address2
          city
          province
          zip
          country
        }
        lineItems(first: 10) {
          edges {
            node {
              id
              title
              quantity
              sku
              variant {
                id
                title
                sku
              }
              product {
                id
                title
              }
            }
          }
        }
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        totalTaxSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        totalShippingPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
      }
    }
  `;

  // Shopify uses global IDs in GraphQL, but we'll accept numeric order IDs
  // and construct the proper ID format
  const globalId = `gid://shopify/Order/${orderId}`;

  try {
    const response = await executeGraphQLQuery(query, { id: globalId });

    if (!response.order) {
      throw new Error(`Order ${orderId} not found in Shopify`);
    }

    return response.order;
  } catch (error) {
    if (error.message.includes("not found")) {
      throw new Error(`Order ${orderId} does not exist in Shopify`);
    }
    throw error;
  }
};

/**
 * Fetch order by order number (human-readable number like #1001)
 *
 * @param {number|string} orderNumber - Order number (human-readable)
 * @returns {Promise<Object>} Order data from Shopify
 * @throws {Error} If order not found or API error occurs
 */
const fetchOrderByNumber = async (orderNumber) => {
  const query = `
    query SearchOrders($query: String!) {
      orders(first: 1, query: $query) {
        edges {
          node {
            id
            name
            createdAt
            updatedAt
            processedAt
            displayFulfillmentStatus
            displayFinancialStatus
            email
            phone
            customer {
              id
              firstName
              lastName
              email
              phone
            }
            billingAddress {
              firstName
              lastName
              address1
              address2
              city
              province
              zip
              country
            }
            shippingAddress {
              firstName
              lastName
              address1
              address2
              city
              province
              zip
              country
            }
            lineItems(first: 10) {
              edges {
                node {
                  id
                  title
                  quantity
                  sku
                  variant {
                    id
                    title
                    sku
                  }
                  product {
                    id
                    title
                  }
                }
              }
            }
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            totalTaxSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            totalShippingPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await executeGraphQLQuery(query, {
      query: `name:${orderNumber}`,
    });

    const orders = response.orders?.edges || [];
    if (orders.length === 0) {
      throw new Error(`Order ${orderNumber} not found in Shopify`);
    }

    return orders[0].node;
  } catch (error) {
    if (error.message.includes("not found")) {
      throw new Error(`Order ${orderNumber} does not exist in Shopify`);
    }
    throw error;
  }
};

module.exports = {
  fetchOrderById,
  fetchOrderByNumber,
  executeGraphQLQuery,
  RATE_LIMIT_CONFIG,
};
