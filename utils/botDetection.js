// utils/botDetection.js - ADVANCED BOT DETECTION 2026
// Meta's recommended bot detection for Conversions API with AI agent handling
// Reference: 2026 Industry Best Practices & Security Boulevard Research

/**
 * MAIN BOT DETECTION FUNCTION - Multi-layer approach
 */
function isBotRequest(req, options = {}) {
  const userAgent = req.get('User-Agent') || '';
  const ip = extractIP(req);
  const lowerUserAgent = userAgent.toLowerCase();

  // Fast exit for empty user agents
  if (!userAgent || userAgent.trim() === '') {
    return true;
  }

  // Layer 1: Meta's own security scanners (CRITICAL)
  if (isMetaSecurityScanner(lowerUserAgent)) {
    return true;
  }

  // Layer 2: Malicious AI & LLM scrapers
  if (isMaliciousAIBot(lowerUserAgent)) {
    return true;
  }

  // Layer 3: Legitimate AI crawlers (track but don't always block)
  const legitimateAI = isLegitimateAIBot(lowerUserAgent);
  if (legitimateAI && options.blockLegitimateAI !== false) {
    return true; // Default: block all AI for Meta CAPI accuracy
  }

  // Layer 4: Social previews & messaging apps
  if (isSocialPreview(lowerUserAgent)) {
    return true;
  }

  // Layer 5: SEO & Marketing tools
  if (isSEOTool(lowerUserAgent)) {
    return true;
  }

  // Layer 6: Monitoring & performance tools
  if (isMonitoringTool(lowerUserAgent)) {
    return true;
  }

  // Layer 7: Ad networks & crawlers
  if (isAdBot(lowerUserAgent)) {
    return true;
  }

  // Layer 8: Technical automation libraries
  if (isTechnicalBot(lowerUserAgent)) {
    return true;
  }

  // Layer 9: Cloud IP ranges (updated for 2026)
  if (isCloudBotIP(ip)) {
    return true;
  }

  // Layer 10: Behavioral & heuristic checks
  if (isSuspiciousPattern(userAgent, lowerUserAgent)) {
    return true;
  }

  return false;
}

/**
 * Extract real IP from request (handles proxies, CF, etc.)
 */
function extractIP(req) {
  return (req.headers['cf-connecting-ip'] || // Cloudflare
          req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
          req.headers['x-real-ip'] ||
          req.ip ||
          req.connection?.remoteAddress ||
          '0.0.0.0');
}
/**
 * Simple user-agent string check (used when full request object not available)
 */
function isBotUserAgent(userAgent) {
  if (!userAgent || typeof userAgent !== 'string') return false;
  const ua = userAgent.toLowerCase();

  // Combine patterns from all bot layers (scanners, AI, SEO, monitoring, etc.)
  const botPatterns = [
    'facebookexternalhit', 'facebot', 'meta-externalagent', 'meta-externalfetcher',
    'facebookcatalog', 'instagrambot', 'whatsapp',
    'gptbot', 'chatgpt-user', 'claude-web-crawler', 'omgilibot', 'imagesiftbot',
    'diffbot', 'cohere-web', 'phiomega', 'llama-web', 'mistralai',
    'claudebot', 'claude-web', 'anthropic', 'google-extended', 'applebot-extended',
    'bytespider', 'ccbot', 'perplexitybot', 'amazonbot', 'metabot',
    'copilot', 'gemini-web', 'grok',
    'twitterbot', 'xbot', 'linkedinbot', 'slackbot', 'slurp', 'discordbot',
    'telegrambot', 'pinterest', 'skypeuripreview', 'viber', 'snapchat', 'tumblr',
    'redditbot', 'bluesky', 'mastodon',
    'ahrefsbot', 'semrushbot', 'semrush', 'mozl', 'dotbot', 'petalbot', 'mj12bot',
    'screaming frog', 'siteaudit', 'yandexbot', 'baiduspider', 'bingbot', 'sogou',
    'exabot', 'seznambot', 'majestic', 'serpstat', 'proximic', 'blexbot',
    'trendiction', 'alexabot', 'dataprovider',
    'uptimerobot', 'pingdom', 'gtmetrix', 'lighthouse', 'pagespeed',
    'google-read-aloud', 'sentry', 'datadog', 'newrelic', 'kuma', 'elastic',
    'honeycomb', 'segment', 'bugsnag', 'rollbar', 'loggly', 'papertrail', 'splunk',
    'adsbot-google', 'googlebot-adscrawler', 'mediapartners-google', 'googlebot-image',
    'googlebot-video', 'adidxbot', 'bingpreview', 'adstxt', 'criteo', 'taboola', 'outbrain',
    'curl', 'wget', 'python', 'java', 'go-http-client', 'powershell', 'libwww',
    'httpclient', 'axios', 'requests', 'scrapy', 'guzzle', 'php', 'node-fetch',
    'fetch', 'urllib', 'headless', 'phantomjs', 'puppeteer', 'selenium', 'playwright',
    'cypress', 'webdriver', 'faker', 'postman', 'insomnia', 'jmeter', 'rust-http',
    'hyper', 'reqwest', 'aiohttp'
  ];

  return botPatterns.some(pattern => ua.includes(pattern));
}
/**
 * Layer 1: Meta Security Scanners
 */
function isMetaSecurityScanner(lowerUserAgent) {
  const metaScanners = [
    'facebookexternalhit',
    'facebot',
    'meta-externalagent',
    'meta-externalfetcher',
    'facebookcatalog',
    'instagrambot',
    'whatsapp'
  ];
  return metaScanners.some(scanner => lowerUserAgent.includes(scanner));
}

/**
 * Layer 2: Malicious AI Scrapers (Updated 2026)
 * These are AI crawlers that are known for aggressive scraping
 */
function isMaliciousAIBot(lowerUserAgent) {
  const maliciousAI = [
    // OpenAI aggressive crawlers
    'gptbot',
    'chatgpt-user',
    // Anthropic aggressive variants
    'claude-web-crawler',
    // Malicious LLM training crawlers
    'omgilibot',
    'imagesiftbot',
    // Known aggressive data miners
    'diffbot',
    'cohere-web',
    // Recent 2026 scrapers
    'phiomega',
    'llama-web',
    'mistralai'
  ];
  return maliciousAI.some(bot => lowerUserAgent.includes(bot));
}

/**
 * Layer 2b: Legitimate AI Crawlers (2026 Updated)
 * These crawlers properly declare themselves and respect robots.txt
 */
function isLegitimateAIBot(lowerUserAgent) {
  const legitimateAI = [
    // Major verified AI platforms
    'gptbot-verified',
    'claudebot',
    'claude-web',
    'anthropic',
    'google-extended',
    'applebot-extended',
    'bytespider',
    'ccbot',
    'perplexitybot',
    'amazonbot',
    'metabot', // 2026 addition
    'copilot',
    'gemini-web',
    'grok'
  ];
  return legitimateAI.some(bot => lowerUserAgent.includes(bot));
}

/**
 * Layer 4: Social Preview Bots
 */
function isSocialPreview(lowerUserAgent) {
  const socialBots = [
    'twitterbot',
    'x.com/bot',
    'xbot',
    'linkedinbot',
    'slackbot',
    'slurp', // Yahoo
    'discordbot',
    'telegrambot',
    'pinterest',
    'skypeuripreview',
    'viber',
    'snapchat',
    'tumblr',
    'redditbot',
    'bluesky', // 2026 addition
    'mastodon'
  ];
  return socialBots.some(bot => lowerUserAgent.includes(bot));
}

/**
 * Layer 5: SEO & Marketing Tools
 */
function isSEOTool(lowerUserAgent) {
  const seoTools = [
    'ahrefsbot',
    'semrushbot',
    'semrush',
    'mozl',
    'dotbot',
    'petalbot',
    'mj12bot',
    'screaming frog',
    'siteaudit',
    'yandexbot',
    'baiduspider',
    'bingbot',
    'sogou',
    'exabot',
    'seznambot',
    'majestic',
    'serpstat',
    'proximic',
    'blexbot',
    'trendiction',
    'alexabot', // 2026 addition
    'dataprovider'
  ];
  return seoTools.some(bot => lowerUserAgent.includes(bot));
}

/**
 * Layer 6: Monitoring & Performance Tools
 */
function isMonitoringTool(lowerUserAgent) {
  const monitoringTools = [
    'uptimerobot',
    'pingdom',
    'gtmetrix',
    'lighthouse',
    'pagespeed',
    'google-read-aloud',
    'sentry',
    'datadog',
    'newrelic',
    'kuma',
    'elastic',
    'honeycomb',
    'segment',
    'bugsnag',
    'rollbar',
    'loggly',
    'papertrail',
    'splunk'
  ];
  return monitoringTools.some(bot => lowerUserAgent.includes(bot));
}

/**
 * Layer 7: Ad Networks & Crawlers
 */
function isAdBot(lowerUserAgent) {
  const adBots = [
    'adsbot-google',
    'googlebot-adscrawler',
    'mediapartners-google',
    'googlebot-image',
    'googlebot-video',
    'adidxbot',
    'bingpreview',
    'adstxt',
    'criteo',
    'taboola',
    'outbrain'
  ];
  return adBots.some(bot => lowerUserAgent.includes(bot));
}

/**
 * Layer 8: Technical & Automation Libraries
 */
function isTechnicalBot(lowerUserAgent) {
  const technicalBots = [
    // Command line tools
    'curl',
    'wget',
    'python',
    'java',
    'go-http-client',
    'powershell',
    // HTTP clients
    'libwww',
    'httpclient',
    'axios',
    'requests',
    // Scraping frameworks
    'scrapy',
    'guzzle',
    'php',
    'node-fetch',
    'fetch',
    'urllib',
    // Browser automation
    'headless',
    'phantomjs',
    'puppeteer',
    'selenium',
    'playwright',
    'cypress',
    'webdriver',
    // Testing & monitoring
    'faker',
    'postman',
    'insomnia',
    'jmeter',
    // 2026 additions
    'rust-http',
    'hyper',
    'reqwest',
    'aiohttp'
  ];
  return technicalBots.some(bot => lowerUserAgent.includes(bot));
}

/**
 * Layer 9: Cloud IP Ranges (UPDATED 2026)
 * Scrapers commonly run on these cloud providers
 */
function isCloudBotIP(ip) {
  if (!ip) return false;

  const botIPRanges = [
    // Google Cloud & Google
    '66.249.', '64.233.', '72.14.', '74.125.', '216.239.',
    '209.85.', '209.185.', '34.', '35.', '104.196.',
    '142.250.', '142.251.', '172.217.', '172.218.',
    // AWS (common for scrapers)
    '52.', '54.', '3.', '13.', '52.1.', '52.2.',
    // Microsoft Azure (2026 update)
    '40.77.', '157.55.', '207.46.', '13.64.', '13.67.',
    '13.68.', '13.69.', '13.70.', '13.71.', '13.72.',
    '13.73.', '13.74.', '13.75.', '13.76.', '13.77.',
    // Digital Ocean
    '104.131.', '104.236.', '107.170.', '188.226.',
    // Linode
    '45.33.', '45.76.', '45.77.', '139.162.',
    // Vultr
    '45.76.', '45.77.', '45.78.', '45.32.',
    // Alibaba Cloud
    '47.88.', '47.89.', '47.90.', '47.91.',
    // Tencent Cloud
    '1.14.', '1.15.'
  ];

  return botIPRanges.some(range => ip.startsWith(range));
}

/**
 * Layer 10: Behavioral & Heuristic Checks
 */
function isSuspiciousPattern(userAgent, lowerUserAgent) {
  // Too short user agent
  if (userAgent.length < 15) return true;

  // Missing standard browser identifiers but has bot keywords
  const hasCommonBrowserMarker = lowerUserAgent.includes('mozilla') ||
                                  lowerUserAgent.includes('chrome') ||
                                  lowerUserAgent.includes('safari') ||
                                  lowerUserAgent.includes('firefox') ||
                                  lowerUserAgent.includes('edge');

  if (!hasCommonBrowserMarker) {
    // Check for bot keywords without proper browser UA
    if (lowerUserAgent.includes('bot') ||
        lowerUserAgent.includes('crawler') ||
        lowerUserAgent.includes('spider') ||
        lowerUserAgent.includes('scraper') ||
        lowerUserAgent.includes('fetch') ||
        lowerUserAgent.includes('fetch-api')) {
      return true;
    }
  }

  // Suspicious character patterns
  if (/[\[\]{}]/.test(userAgent)) {
    return true; // Likely JSON or malformed
  }

  // Empty Mozilla string with other indicators
  if (userAgent === 'Mozilla' || userAgent === 'Mozilla/5.0') {
    return true;
  }

  return false;
}

/**
 * Enhanced Meta Compliant User Data Collection
 * Returns null for bots, enhanced user data for real users
 */
function getMetaCompliantUserData(req, options = {}) {
  // Step 1: Check for bots
  if (isBotRequest(req, options)) {
    return null;
  }

  const user = req.user || {};
  const cookies = req.cookies || {};
  const ip = extractIP(req);

  // Hash sensitive data for GDPR compliance (optional)
  const hashData = options.hashSensitive !== false;

  const userData = {
    // Network identification
    ip: ip,
    userAgent: req.get('User-Agent') || '',

    // Meta pixel & CAPI identifiers
    fbc: cookies._fbc || null,
    fbp: cookies._fbp || null,

    // User identifiers
    email: user.email ? (hashData ? hashEmail(user.email) : user.email) : null,
    phone: user.phone || user.numero ? (hashData ? hashPhone(user.phone || user.numero) : user.phone || user.numero) : null,
    externalId: user.id || user._id || null,

    // User profile data
    firstName: user.firstName || user.first_name || null,
    lastName: user.lastName || user.last_name || null,

    // Location data
    country: user.country || req.headers['cf-ipcountry'] || null,
    city: user.city || null,
    state: user.state || null,
    zipCode: user.zipCode || user.zip || null,

    // Device & session
    timestamp: new Date().toISOString(),
    requestId: generateRequestId(),
    isBot: false,
    botConfidence: 0
  };

  return userData;
}

/**
 * Advanced Event Send Check with logging
 */
function shouldSendEvent(req, options = {}) {
  const isBot = isBotRequest(req, options);

  // Optional: Log suspicious requests for analysis
  if (isBot && options.logBots) {
    logBotAttempt(req);
  }

  return !isBot;
}

/**
 * Get Bot Classification for Analytics
 * Returns detailed bot information for tracking
 */
function getBotClassification(req) {
  const userAgent = req.get('User-Agent') || '';
  const lowerUserAgent = userAgent.toLowerCase();
  const ip = extractIP(req);

  if (!isBotRequest(req)) {
    return null;
  }

  let botType = 'unknown';
  let botSeverity = 'low'; // low, medium, high

  if (isMetaSecurityScanner(lowerUserAgent)) {
    botType = 'meta_security';
    botSeverity = 'low';
  } else if (isMaliciousAIBot(lowerUserAgent)) {
    botType = 'malicious_ai';
    botSeverity = 'high';
  } else if (isLegitimateAIBot(lowerUserAgent)) {
    botType = 'legitimate_ai';
    botSeverity = 'low';
  } else if (isSocialPreview(lowerUserAgent)) {
    botType = 'social_preview';
    botSeverity = 'low';
  } else if (isSEOTool(lowerUserAgent)) {
    botType = 'seo_tool';
    botSeverity = 'low';
  } else if (isMonitoringTool(lowerUserAgent)) {
    botType = 'monitoring';
    botSeverity = 'low';
  } else if (isAdBot(lowerUserAgent)) {
    botType = 'ad_network';
    botSeverity = 'medium';
  } else if (isTechnicalBot(lowerUserAgent)) {
    botType = 'technical_automation';
    botSeverity = 'high';
  } else if (isCloudBotIP(ip)) {
    botType = 'cloud_ip_scraper';
    botSeverity = 'high';
  }

  return {
    isBot: true,
    botType,
    botSeverity,
    userAgent,
    ip,
    timestamp: new Date().toISOString()
  };
}

/**
 * Helper: Hash email for GDPR compliance
 */
function hashEmail(email) {
  try {
    const crypto = require('crypto');
    return crypto
      .createHash('sha256')
      .update(email.toLowerCase().trim())
      .digest('hex');
  } catch (e) {
    return null;
  }
}

/**
 * Helper: Hash phone for GDPR compliance
 */
function hashPhone(phone) {
  try {
    const crypto = require('crypto');
    return crypto
      .createHash('sha256')
      .update(phone.replace(/\D/g, ''))
      .digest('hex');
  } catch (e) {
    return null;
  }
}

/**
 * Helper: Generate unique request ID
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Helper: Log bot attempts (optional)
 */
function logBotAttempt(req) {
  const classification = getBotClassification(req);
  console.warn('[BOT DETECTED]', {
    timestamp: new Date().toISOString(),
    classification,
    path: req.path,
    method: req.method,
    ip: extractIP(req)
  });

  // Optional: Send to analytics service
  // await sendToAnalytics(classification);
}

module.exports = {
  isBotRequest,
  getMetaCompliantUserData,
  shouldSendEvent,
  getBotClassification,
  isLegitimateAIBot,
  isMaliciousAIBot,
  extractIP,
  isBotUserAgent
};
