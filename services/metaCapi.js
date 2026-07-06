// services/metaCapi.js - FIXED AND WORKING VERSION
require("dotenv").config();
const axios = require("axios");
const crypto = require("crypto");
const { isBotUserAgent } = require('../utils/botDetection'); // Import bot detection

// SHA-256 hash function
function hash(data) {
  if (!data) return undefined;
  return crypto.createHash("sha256")
    .update(data.trim().toLowerCase())
    .digest("hex");
}

const sendMetaCAPIEvent = async ({
  eventName,
  eventId,
  userData,
  customData = {},
  eventSourceUrl = null,
  testEventCode = null,
}) => {
  const PIXEL_ID = process.env.FB_PIXEL_ID;
  const ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

  if (!PIXEL_ID || !ACCESS_TOKEN) {
    console.error("❌ Missing Facebook Pixel ID or Access Token");
    return;
  }

  if (!eventName || !eventId) {
    console.error("❌ Missing eventName or eventId");
    return;
  }

  // ✅ Check if userData exists
  if (!userData) {
    console.log("🚫 Skipping CAPI event - No user data");
    return;
  }

  // ✅ BOT DETECTION - Use imported function
  if (isBotUserAgent(userData.userAgent)) {
    console.log(`🤖 Skipping ${eventName} event for bot`);
    return;
  }

  try {
    // ✅ Build user_data object
    const hashedUserData = {
      // 🔴 CRITICAL PARAMETERS
      fbp: userData.fbp,                    // Browser ID - Not hashed
      fbc: userData.fbc,                    // Click ID - Not hashed
      client_ip_address: userData.ip,       // Not hashed
      client_user_agent: userData.userAgent, // Not hashed
      
      // ✅ Always Algeria for your case
      country: hash("algeria"),
      
      // ✅ User data (hashed)
      em: hash(userData.email),
      ph: hash(userData.numero),
      fn: hash(userData.firstName),
      ln: hash(userData.lastName),
      
      // ✅ External ID for deduplication (uses FBP when available)
      external_id: hash(userData.fbp || userData.email || userData.numero)
    };

    // Remove undefined values
    Object.keys(hashedUserData).forEach(key => {
      if (hashedUserData[key] === undefined) {
        delete hashedUserData[key];
      }
    });

    // ✅ Enhanced custom_data
    const enhancedCustomData = {
      ...customData,
      currency: customData.currency || "DZD",
      content_category: customData.content_category || "home_decor"
    };

    // Clean undefined from custom_data
    Object.keys(enhancedCustomData).forEach(key => {
      if (enhancedCustomData[key] === undefined) {
        delete enhancedCustomData[key];
      }
    });

    // ✅ Diagnostic logging
    console.log("📊 Meta CAPI Diagnostics:", {
      eventName,
      eventId,
      isBot: isBotUserAgent(userData.userAgent) ? "🤖" : "👤",
      criticalParams: {
        fbp: !!hashedUserData.fbp ? "✅" : "❌",
        fbc: !!hashedUserData.fbc ? "✅" : "❌",
        ip: !!hashedUserData.client_ip_address ? "✅" : "❌",
        userAgent: !!hashedUserData.client_user_agent ? "✅" : "❌",
        country: !!hashedUserData.country ? "✅" : "❌"
      },
      userParams: {
        email: !!hashedUserData.em ? "✅" : "➖",
        phone: !!hashedUserData.ph ? "✅" : "➖"
      }
    });

    // ✅ Only send if we have basic requirements
    if (!hashedUserData.client_ip_address || !hashedUserData.client_user_agent) {
      console.log("🚫 Skipping event - Missing IP or UserAgent");
      return;
    }

    // ✅ CORRECT: Define payload variable
    const payload = {
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,
          event_source_url: eventSourceUrl,
          action_source: "website",
          user_data: hashedUserData,
          custom_data: enhancedCustomData,
        },
      ],
    };

    if (testEventCode) {
      payload.test_event_code = testEventCode;
      console.log("🧪 Test event code:", testEventCode);
    }

    // ✅ Send to Meta
    const url = `https://graph.facebook.com/v18.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;
    
    const response = await axios.post(url, payload, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' }
    });

    console.log("✅ Meta CAPI Event Sent Successfully");
    return response.data;

  } catch (error) {
    console.error("❌ Meta CAPI Error:", error.message);
    if (error.response) {
      console.error("❌ Meta API Response:", error.response.data);
    }
  }
};

module.exports = sendMetaCAPIEvent;
