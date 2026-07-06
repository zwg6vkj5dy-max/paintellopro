// utils/userData.js - FIXED VERSION
const { isBotRequest } = require("./botDetection");

// ✅ COUNTRY MAPPING TO ISO CODES
const COUNTRY_MAPPING = {
  // Algeria variations -> "dz"
  'algeria': 'dz',
  'algérie': 'dz',
  'algerie': 'dz',
  'dz': 'dz',
  'dza': 'dz',
  
  // Common countries (add more as needed)
  'france': 'fr',
  'fr': 'fr',
  'united states': 'us',
  'usa': 'us',
  'us': 'us',
  'united kingdom': 'gb',
  'uk': 'gb',
  'canada': 'ca',
  'ca': 'ca',
  'morocco': 'ma',
  'maroc': 'ma',
  'ma': 'ma',
  'tunisia': 'tn',
  'tunisie': 'tn',
  'tn': 'tn'
};

function cleanString(data) {
  if (!data || typeof data !== 'string') return null;
  return data.trim().toLowerCase();
}

function cleanPhoneNumber(phone) {
  if (!phone) return null;
  
  // Convert to string and remove all non-digits
  let cleanPhone = phone.toString().replace(/\D/g, '');
  
  // If empty after cleaning, return null
  if (cleanPhone.length === 0) return null;
  
  // Remove leading 0 if present
  if (cleanPhone.startsWith('0')) {
    cleanPhone = cleanPhone.substring(1);
  }
  
  // Ensure it starts with country code 213 (Algeria)
  if (!cleanPhone.startsWith('213')) {
    // If it's 9 digits (Algerian number without country code)
    if (cleanPhone.length === 9) {
      cleanPhone = '213' + cleanPhone;
    }
    // If it's 10 digits (might have had leading 0)
    else if (cleanPhone.length === 10) {
      cleanPhone = '213' + cleanPhone;
    }
  }
  
  // Final validation: should start with 213 and be 12 digits total
  if (cleanPhone.startsWith('213') && cleanPhone.length === 12) {
    return cleanPhone;
  }
  
  return cleanPhone; // Return even if not perfect format
}

function cleanCountry(country) {
  if (!country) return null;
  
  const cleaned = cleanString(country);
  if (!cleaned) return null;
  
  // Check if it's already a 2-letter ISO code
  if (cleaned.length === 2 && /^[a-z]{2}$/.test(cleaned)) {
    return cleaned;
  }
  
  // Look up in mapping
  if (COUNTRY_MAPPING[cleaned]) {
    return COUNTRY_MAPPING[cleaned];
  }
  
  // Return cleaned version (Meta will hash whatever we send)
  return cleaned;
}

function getCleanUserData(req) {
  // ✅ ENHANCED BOT DETECTION FIRST
  if (isBotRequest(req)) {
    return null; // Return null to indicate bot
  }
  
  // ✅ Collect data only for real users
  const userAgent = req.headers["user-agent"] || "";
  let ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0] || "0.0.0.0";
  
  // Clean IPv6 prefix if present
  if (ip.includes('::ffff:')) {
    ip = ip.replace('::ffff:', '');
  }
  
  // Clean the IP
  const cleanIp = ip.split(',')[0].trim();
  
  // Extract cookies
  const cookies = req.cookies || {};
  
  // ✅ INITIALIZE userData with basic info
  let userData = {
    ip: cleanIp,
    userAgent: userAgent,
    fbp: cookies._fbp || null,
    fbc: cookies._fbc || null
  };
  
  // ✅ CRITICAL FIX: ALWAYS check req.body for form data
  if (req.body) {
    // Email
    if (req.body.email) {
      userData.email = cleanString(req.body.email);
    }
    
    // Phone number - CRITICAL: Check multiple field names
    if (req.body.numero) {
      userData.numero = cleanPhoneNumber(req.body.numero);
    } else if (req.body.phone) {
      userData.numero = cleanPhoneNumber(req.body.phone);
    } else if (req.body.telephone) {
      userData.numero = cleanPhoneNumber(req.body.telephone);
    }
    
    // Names
    if (req.body.firstName) {
      userData.firstName = cleanString(req.body.firstName);
    } else if (req.body.firstname) {
      userData.firstName = cleanString(req.body.firstname);
    }
    
    if (req.body.lastName) {
      userData.lastName = cleanString(req.body.lastName);
    } else if (req.body.lastname) {
      userData.lastName = cleanString(req.body.lastname);
    }
    
    // Location
    if (req.body.city) {
      userData.city = cleanString(req.body.city);
    }
    
    // Country - CRITICAL: Check your form field name
    if (req.body.country) {
      userData.country = cleanCountry(req.body.country);
    } else if (req.body.pays) { // French for country
      userData.country = cleanCountry(req.body.pays);
    }
  }
  
  // ✅ THEN check for logged-in user data (as fallback)
  if (req.user && req.user._id) {
    // Only use user data if not already set from form
    if (!userData.email && req.user.email) {
      userData.email = cleanString(req.user.email);
    }
    if (!userData.numero && req.user.numero) {
      userData.numero = cleanPhoneNumber(req.user.numero);
    }
    if (!userData.firstName && req.user.firstName) {
      userData.firstName = cleanString(req.user.firstName);
    }
    if (!userData.lastName && req.user.lastName) {
      userData.lastName = cleanString(req.user.lastName);
    }
    if (!userData.country && req.user.country) {
      userData.country = cleanCountry(req.user.country);
    }
    if (!userData.city && req.user.city) {
      userData.city = cleanString(req.user.city);
    }
  }
  
  // ✅ Also check session data if available
  if (req.session && req.session.confirmationData) {
    const sessionData = req.session.confirmationData;
    
    if (!userData.email && sessionData.email) {
      userData.email = cleanString(sessionData.email);
    }
    if (!userData.numero && sessionData.numero) {
      userData.numero = cleanPhoneNumber(sessionData.numero);
    }
    if (!userData.firstName && sessionData.firstName) {
      userData.firstName = cleanString(sessionData.firstName);
    }
    if (!userData.lastName && sessionData.lastName) {
      userData.lastName = cleanString(sessionData.lastName);
    }
    if (!userData.city && sessionData.city) {
      userData.city = cleanString(sessionData.city);
    }
    if (!userData.country && sessionData.country) {
      userData.country = cleanCountry(sessionData.country);
    }
  }
  
  return userData;
}

module.exports = getCleanUserData;
