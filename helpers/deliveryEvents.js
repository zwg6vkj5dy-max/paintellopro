// helpers/deliveryEvents.js
const sendFacebookCAPIEvent = require('../services/facebookCapi');

// UUID v4 generator function
function generateEventId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
async function sendPurchaseForDeliveredCOD(order) {
  if (order.paymentMethod !== "cod" || !order.metaUserData || Object.keys(order.metaUserData).length === 0) {
    console.log("⚠️ Skip Purchase – not a valid COD order or missing user data");
    return;
  }

  // --- Extract items array safely ---
  let itemsArray = [];
  const cart = order.cart;
  if (cart && cart.items) {
    if (Array.isArray(cart.items)) {
      itemsArray = cart.items;
    } else if (typeof cart.items === 'object') {
      itemsArray = Object.values(cart.items);
    }
  }

  const contents = itemsArray.map(item => ({
    id: (item.item && item.item._id) ? item.item._id.toString() : (item._id ? item._id.toString() : ''),
    quantity: item.qty || item.quantity || 1,
    item_price: item.price || (item.unitPrice || 0),
  }));
  const content_ids = contents.map(c => c.id).filter(id => id);

  if (content_ids.length === 0) {
    console.log("⚠️ No valid product IDs – skipping Purchase event");
    return;
  }

  const eventId = generateEventId();
  const userData = order.metaUserData;

  try {
    await sendFacebookCAPIEvent({
      eventName: "Purchase",
      eventId: eventId,
      userData: userData,
      customData: {
        value: order.totalWithShipping || order.cart.totalPrice,
        currency: "DZD",
        content_type: "product",
        content_ids: content_ids,
        contents: contents,
      },
      eventSourceUrl: `https://${process.env.DOMAIN || "paintellopro.onrender.com"}/order/${order._id}`,
      testEventCode: process.env.FB_TEST_EVENT_CODE,
    });
    console.log(`✅ Purchase event sent for delivered COD order ${order._id}, eventID: ${eventId}`);
  } catch (err) {
    console.error(`❌ Failed to send Purchase for order ${order._id}:`, err);
  }
}

module.exports = { sendPurchaseForDeliveredCOD };
