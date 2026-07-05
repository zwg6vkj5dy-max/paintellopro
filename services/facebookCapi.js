// services/facebookCapi.js - FIXED SDK METHOD NAMES
const bizSdk = require('facebook-nodejs-business-sdk');
const crypto = require('crypto');

// In v22.0.3, these are the correct classes
const ServerEvent = bizSdk.ServerEvent;
const EventRequest = bizSdk.EventRequest;
const UserData = bizSdk.UserData;
const CustomData = bizSdk.CustomData;
const Content = bizSdk.Content;

function hash(data) {
  if (!data || typeof data !== 'string') return null;
  
  // Data should already be cleaned by userData.js
  // Just hash it as-is (it should already be lowercase and trimmed)
  return crypto.createHash("sha256")
    .update(data)
    .digest("hex");
}

const sendFacebookCAPIEvent = async ({
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
    return null;
  }

  // ✅ CRITICAL: Check if userData is null (bot detected)
  if (userData === null) {
    return {
      success: false,
      reason: 'bot_detected',
      eventId: eventId
    };
  }

  try {
    // ========== CREATE USER DATA ==========
    const userDataObj = new UserData();
    
    // ✅ v22.0.3 CORRECT METHODS:
    userDataObj.setClientIpAddress(userData.ip || '0.0.0.0');
    userDataObj.setClientUserAgent(userData.userAgent || '');
    
    // Facebook cookies
    if (userData.fbp) {
      userDataObj.setFbp(userData.fbp);
    }
    
    if (userData.fbc) {
      userDataObj.setFbc(userData.fbc);
    }
    
    // ✅ COUNTRY (already cleaned to ISO code like "dz")
    if (userData.country) {
      const hashedCountry = hash(userData.country);
      if (hashedCountry) {
        userDataObj.setCountry(hashedCountry);
      }
    }
    
    // ✅ CITY (already cleaned to lowercase)
    if (userData.city) {
      const hashedCity = hash(userData.city);
      if (hashedCity) {
        userDataObj.setCity(hashedCity);
      }
    }
    
    // ✅ EMAIL (already cleaned to lowercase)
    if (userData.email) {
      const hashedEmail = hash(userData.email);
      if (hashedEmail) {
        userDataObj.setEmail(hashedEmail);
      }
    }
    
    // ✅ PHONE (already formatted as 213XXXXXXXXX)
    // CRITICAL FIX: Use setPhone() not setPh()
    if (userData.numero) {
      const hashedPhone = hash(userData.numero);
      if (hashedPhone) {
        userDataObj.setPhone(hashedPhone); // FIXED: setPhone() not setPh()
      }
    }
    
    // ✅ FIRST NAME (already cleaned to lowercase)
    if (userData.firstName) {
      const hashedFirstName = hash(userData.firstName);
      if (hashedFirstName) {
        userDataObj.setFirstName(hashedFirstName); // FIXED: setFirstName() not setFn()
      }
    }
    
    // ✅ LAST NAME (already cleaned to lowercase)
    if (userData.lastName) {
      const hashedLastName = hash(userData.lastName);
      if (hashedLastName) {
        userDataObj.setLastName(hashedLastName); // FIXED: setLastName() not setLn()
      }
    }
    
    // ========== CREATE CUSTOM DATA ==========
    const customDataObj = new CustomData()
      .setCurrency(customData.currency || "DZD");
    
    // Set value for purchase events
    if (customData.value !== undefined) {
      customDataObj.setValue(parseFloat(customData.value));
    }
    
    // Product information
    if (customData.content_name) {
      customDataObj.setContentName(customData.content_name);
    }
    
    if (customData.content_ids && Array.isArray(customData.content_ids)) {
      customDataObj.setContentIds(customData.content_ids.map(id => id.toString()));
    }
    
    if (customData.content_type) {
      customDataObj.setContentType(customData.content_type);
    }
    
    // Product contents
    if (customData.contents && Array.isArray(customData.contents)) {
      const contents = customData.contents.map(content => {
        const contentObj = new Content()
          .setId(content.id ? content.id.toString() : '');
        
        if (content.quantity) {
          contentObj.setQuantity(content.quantity);
        }
        
        if (content.item_price) {
          contentObj.setItemPrice(parseFloat(content.item_price));
        }
        
        return contentObj;
      });
      
      if (contents.length > 0) {
        customDataObj.setContents(contents);
      }
    }
    
    // ========== CREATE SERVER EVENT ==========
    const serverEvent = new ServerEvent()
      .setEventName(eventName)
      .setEventTime(Math.floor(Date.now() / 1000))
      .setEventId(eventId)
      .setActionSource("website")
      .setUserData(userDataObj)
      .setCustomData(customDataObj);
    
    if (eventSourceUrl) {
      serverEvent.setEventSourceUrl(eventSourceUrl);
    }
    
    // ========== SEND EVENT ==========
    const eventsData = [serverEvent];
    
    const eventRequest = new EventRequest(ACCESS_TOKEN, PIXEL_ID)
      .setEvents(eventsData);
    
    if (testEventCode) {
      eventRequest.setTestEventCode(testEventCode);
    }
    
    // Execute the request
    const response = await eventRequest.execute();
    
    return {
      success: true,
      eventId: eventId,
      response: response
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      eventId: eventId
    };
  }
};

module.exports = sendFacebookCAPIEvent;
