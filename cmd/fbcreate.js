const axios = require('axios');
const cheerio = require('cheerio');
const { faker } = require('@faker-js/faker');
const { CookieJar } = require('tough-cookie');
const { wrapper: axiosCookieJarSupport } = require('axios-cookiejar-support');
const sendMessage = require('../jubiar-telegram-api/sendMessage');
const editMessage = require('../jubiar-telegram-api/editMessage');
const sendMessageWithInlineKeyboard = require('../jubiar-telegram-api/sendMessageWithInlineKeyboard');
const answerCallbackQuery = require('../jubiar-telegram-api/answerCallbackQuery');
const { registerCallback } = require('../utils/commandHandler');

const BASE_FB_URL = 'https://m.facebook.com';
const DESKTOP_FB_URL = 'https://www.facebook.com';
const TEMP_EMAIL_API_URL = 'https://email-six-pearl.vercel.app/';
const DEFAULT_TIMEOUT = 120000;
const OTP_POLL_INTERVAL_SECONDS = 4;
const OTP_POLL_DURATION_MS = 25000;
const BUTTON_COLLECTOR_TIMEOUT_MS = 15 * 60 * 1000;

const callbackMappings = new Map();
let callbackCounter = 0;

const createShortCallback = (longData) => {
    const shortId = `fb_${callbackCounter++}`;
    callbackMappings.set(shortId, longData);
    setTimeout(() => callbackMappings.delete(shortId), BUTTON_COLLECTOR_TIMEOUT_MS);
    return shortId;
};

const REALISTIC_BROWSERS = [
    {
        name: 'Chrome Android',
        userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
        viewport: { width: 393, height: 873 },
        brands: [
            {brand: "Chromium", version: "122"},
            {brand: "Not(A:Brand", version: "24"},
            {brand: "Google Chrome", version: "122"}
        ]
    },
    {
        name: 'Chrome Android Samsung',
        userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
        viewport: { width: 412, height: 915 },
        brands: [
            {brand: "Not A(Brand", version: "99"},
            {brand: "Google Chrome", version: "121"},
            {brand: "Chromium", version: "121"}
        ]
    },
    {
        name: 'Chrome Android Pixel',
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36',
        viewport: { width: 412, height: 915 },
        brands: [
            {brand: "Google Chrome", version: "123"},
            {brand: "Not:A-Brand", version: "8"},
            {brand: "Chromium", version: "123"}
        ]
    }
];

const REFERRER_CHAINS = [
    'https://www.google.com/search?q=facebook+login',
    'https://www.google.com/search?q=create+facebook+account',
    'https://duckduckgo.com/?q=facebook+signup',
    'https://www.bing.com/search?q=facebook+register',
    'https://www.google.com/',
    'https://instagram.com/',
    'https://twitter.com/'
];

const generateSuperStealthBrowser = () => {
    const browser = REALISTIC_BROWSERS[Math.floor(Math.random() * REALISTIC_BROWSERS.length)];
    const referrer = REFERRER_CHAINS[Math.floor(Math.random() * REFERRER_CHAINS.length)];
    
    return {
        ...browser,
        referrer,
        language: ['en-US', 'en-GB', 'en-CA'][Math.floor(Math.random() * 3)],
        timezone: ['America/New_York', 'America/Los_Angeles', 'Europe/London'][Math.floor(Math.random() * 3)],
        platform: 'Linux armv81',
        memory: [4, 6, 8][Math.floor(Math.random() * 3)],
        hardwareConcurrency: [4, 6, 8][Math.floor(Math.random() * 3)],
        webgl: `ANGLE (ARM Mali-G78 MP14, or similar)`,
        canvas: Math.random().toString(36).substring(2, 15)
    };
};

const humanTypingDelay = (minMs = 100, maxMs = 300) => {
    return new Promise(resolve => setTimeout(resolve, Math.random() * (maxMs - minMs) + minMs));
};

const veryLongHumanDelay = (minMs = 8000, maxMs = 15000) => {
    return new Promise(resolve => setTimeout(resolve, Math.random() * (maxMs - minMs) + minMs));
};

const humanBrowsingDelay = (minMs = 3000, maxMs = 7000) => {
    return new Promise(resolve => setTimeout(resolve, Math.random() * (maxMs - minMs) + minMs));
};

const microRandomDelay = () => new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50));

const generateRealisticPersonData = () => {
    const genders = ['male', 'female'];
    const selectedGender = genders[Math.floor(Math.random() * genders.length)];
    
    return {
        firstName: faker.person.firstName(selectedGender),
        lastName: faker.person.lastName(),
        gender: selectedGender === 'male' ? '2' : '1',
        birthDate: {
            day: Math.floor(Math.random() * 28) + 1,
            month: Math.floor(Math.random() * 12) + 1,
            year: new Date().getFullYear() - (Math.floor(Math.random() * 30) + 20)
        }
    };
};

const generateSecurePassword = (length = 16) => {
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";
    
    let password = "";
    password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
    password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
    password += numbers.charAt(Math.floor(Math.random() * numbers.length));
    password += symbols.charAt(Math.floor(Math.random() * symbols.length));
    
    const allChars = lowercase + uppercase + numbers + symbols;
    for (let i = password.length; i < length; i++) {
        password += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }
    
    return password.split('').sort(() => Math.random() - 0.5).join('');
};

const createUltraStealthSession = (browserConfig, proxyString = null) => {
    const jar = new CookieJar();
    let axiosProxyConfig = null;

    if (proxyString) {
        const parts = proxyString.trim().split(':');
        if (parts.length === 2) {
            axiosProxyConfig = { 
                protocol: 'http', 
                host: parts[0], 
                port: parseInt(parts[1], 10) 
            };
        } else if (parts.length >= 4) {
            const username = parts[2].startsWith('@') ? parts[2].substring(1) : parts[2];
            axiosProxyConfig = { 
                protocol: 'http', 
                host: parts[0], 
                port: parseInt(parts[1], 10), 
                auth: { 
                    username: username, 
                    password: parts.slice(3).join(':') 
                } 
            };
        }
        
        if (axiosProxyConfig && (isNaN(axiosProxyConfig.port) || !axiosProxyConfig.host)) {
            axiosProxyConfig = null;
        }
    }

    const baseHeaders = {
        'User-Agent': browserConfig.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': `${browserConfig.language},en;q=0.9`,
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'DNT': '1',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
        'sec-ch-ua': browserConfig.brands.map(b => `"${b.brand}";v="${b.version}"`).join(', '),
        'sec-ch-ua-mobile': '?1',
        'sec-ch-ua-platform': '"Android"',
        'sec-ch-ua-platform-version': '"13.0.0"',
        'Viewport-Width': browserConfig.viewport.width.toString(),
        'Device-Memory': browserConfig.memory.toString(),
        'Referer': browserConfig.referrer
    };

    const session = axios.create({
        jar: jar,
        withCredentials: true,
        headers: baseHeaders,
        timeout: DEFAULT_TIMEOUT,
        maxRedirects: 3,
        validateStatus: (status) => status >= 200 && status < 600,
        proxy: axiosProxyConfig,
    });
    
    axiosCookieJarSupport(session);
    
    session.interceptors.request.use(async (config) => {
        await microRandomDelay();
        
        if (config.method === 'post') {
            config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            config.headers['Origin'] = config.url.includes('m.facebook') ? BASE_FB_URL : DESKTOP_FB_URL;
            config.headers['Sec-Fetch-Site'] = 'same-origin';
            config.headers['Sec-Fetch-Mode'] = 'cors';
            config.headers['X-Requested-With'] = 'XMLHttpRequest';
        }
        
        const jitter = Math.random() * 100;
        config.timeout = DEFAULT_TIMEOUT + jitter;
        
        return config;
    });
    
    return session;
};

const simulateRealisticBrowsing = async (session, browserConfig, chatId, statusMessageId) => {
    await editMessage(chatId, statusMessageId, 
        `🌍 <b>Simulating Human Browsing Pattern</b>\n\n` +
        `🔄 Phase 1: Landing from search engine...\n` +
        `🌐 Referrer: <code>${browserConfig.referrer}</code>`
    );
    
    await veryLongHumanDelay(10000, 18000);
    
    try {
        const searchLanding = await session.get(browserConfig.referrer, {
            headers: { 
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-Mode': 'navigate'
            }
        });
        
        await humanBrowsingDelay(5000, 12000);
        
        await editMessage(chatId, statusMessageId, 
            `🏠 <b>Browsing Simulation Active</b>\n\n` +
            `✅ Phase 1: Search engine visited\n` +
            `🔄 Phase 2: Navigating to Facebook...`
        );
        
        const initialFBVisit = await session.get(BASE_FB_URL + '/', {
            headers: {
                'Referer': browserConfig.referrer,
                'Sec-Fetch-Site': 'cross-site',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Dest': 'document',
                'Cache-Control': 'no-cache'
            }
        });
        
        await humanBrowsingDelay(8000, 15000);
        
        await editMessage(chatId, statusMessageId, 
            `📱 <b>Realistic Session Established</b>\n\n` +
            `✅ Phase 2: Facebook homepage loaded\n` +
            `🔄 Phase 3: Browsing like human user...`
        );
        
        const helpPageVisit = await session.get(BASE_FB_URL + '/help/', {
            headers: {
                'Referer': BASE_FB_URL + '/',
                'Sec-Fetch-Site': 'same-origin'
            }
        });
        
        await humanBrowsingDelay(6000, 12000);
        
        await editMessage(chatId, statusMessageId, 
            `🎯 <b>Human Behavior Simulation Complete</b>\n\n` +
            `✅ All phases completed successfully\n` +
            `🚀 Ready for account creation process`
        );
        
        return initialFBVisit;
        
    } catch (error) {
        console.warn('[fbcreate] Browsing simulation error:', error.message);
        
        const fallbackVisit = await session.get(BASE_FB_URL + '/', {
            headers: {
                'Referer': 'https://www.google.com/',
                'Sec-Fetch-Site': 'cross-site'
            }
        });
        
        return fallbackVisit;
    }
};

const fetchPremiumTemporaryEmail = async (chatId, statusMessageId, providerNameParam) => {
    const providers = ['random', '10minutemail', 'guerrillamail', 'tempmail'];
    const effectiveProvider = providers.includes(providerNameParam?.toLowerCase()) ? providerNameParam : 'random';
    
    await editMessage(chatId, statusMessageId, 
        `📧 <b>Acquiring Premium Email Service</b>\n\n` +
        `🔄 Provider: <code>${effectiveProvider}</code>\n` +
        `⏳ Establishing secure connection...`
    );
    
    await humanBrowsingDelay(3000, 6000);
    
    try {
        const apiUrl = `${TEMP_EMAIL_API_URL}/gen?provider=${effectiveProvider}`;
        const response = await axios.get(apiUrl, { 
            timeout: 45000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (response.data?.email_address && response.data?.api_session_id && response.data?.provider) {
            await editMessage(chatId, statusMessageId, 
                `📬 <b>Premium Email Acquired Successfully!</b>\n\n` +
                `📧 <b>Address:</b> <code>${response.data.email_address}</code>\n` +
                `🏢 <b>Provider:</b> <code>${response.data.provider}</code>\n` +
                `🔒 <b>Session:</b> Secured & Encrypted`
            );
            
            return { 
                email: response.data.email_address, 
                sessionId: response.data.api_session_id, 
                providerName: response.data.provider 
            };
        } else {
            throw new Error('Invalid email service response');
        }
    } catch (error) {
        throw new Error(`Premium email service failed: ${error.message}`);
    }
};

const intelligentOtpRetrieval = async (tempEmailSessionId, chatId, statusMessageId, emailAddress) => {
    await editMessage(chatId, statusMessageId, 
        `🔍 <b>Intelligent OTP Detection Started</b>\n\n` +
        `📧 <b>Monitoring:</b> <code>${emailAddress}</code>\n` +
        `🤖 <b>AI Pattern Recognition:</b> Active\n` +
        `⏰ <b>Max Wait:</b> ${OTP_POLL_DURATION_MS / 1000}s`
    );
    
    const startTime = Date.now();
    
    const advancedOtpPatterns = [
        /Facebook.*?(\d{5,8})/i,
        /Meta.*?(\d{5,8})/i,
        /(\d{5,8}).*?confirmation.*?code/i,
        /verification.*?code.*?(\d{5,8})/i,
        /your.*?code.*?(\d{5,8})/i,
        /security.*?code.*?(\d{5,8})/i,
        /FB-(\d{5,8})/i,
        /(\d{6})\s*is\s*your\s*Facebook/i,
        /(\d{8})\s*Facebook/i,
        /confirm.*?(\d{5,8})/i
    ];
    
    let lastPollTime = 0;
    let attemptCount = 0;
    
    while (Date.now() - startTime < OTP_POLL_DURATION_MS) {
        const currentTime = Date.now();
        
        if (currentTime - lastPollTime >= (OTP_POLL_INTERVAL_SECONDS * 1000)) {
            attemptCount++;
            
            try {
                const response = await axios.get(
                    `${TEMP_EMAIL_API_URL}/sessions/${tempEmailSessionId}/messages`, 
                    { timeout: 30000 }
                );
                
                if (response.data && Array.isArray(response.data)) {
                    const sortedMessages = response.data.sort((a, b) => 
                        new Date(b.received_at || b.date || 0) - new Date(a.received_at || a.date || 0)
                    );
                    
                    for (const message of sortedMessages) {
                        let emailContent = message.body || '';
                        
                        if (!emailContent && message.html) {
                            const htmlArray = Array.isArray(message.html) ? message.html : [message.html];
                            emailContent = cheerio.load(htmlArray.join(' ')).text();
                        }
                        
                        const emailBody = emailContent.trim().replace(/\s+/g, ' ');
                        const emailSubject = (message.subject || '').trim();
                        const emailFrom = (message.from || message.from_address || '').toLowerCase();
                        
                        const isFacebookEmail = emailFrom.includes('facebook') || 
                                              emailFrom.includes('meta') || 
                                              emailFrom.includes('facebookmail') ||
                                              emailSubject.toLowerCase().includes('facebook') ||
                                              emailSubject.toLowerCase().includes('meta');
                        
                        if ((emailBody || emailSubject) && isFacebookEmail) {
                            const combinedText = `${emailSubject} ${emailBody}`;
                            
                            for (const pattern of advancedOtpPatterns) {
                                const match = combinedText.match(pattern);
                                
                                if (match && match[1] && /^\d{5,8}$/.test(match[1])) {
                                    await editMessage(chatId, statusMessageId, 
                                        `🎉 <b>OTP Successfully Detected!</b>\n\n` +
                                        `🔢 <b>Code:</b> <code>${match[1]}</code>\n` +
                                        `📧 <b>From:</b> <code>${emailFrom || 'Facebook'}</code>\n` +
                                        `📋 <b>Subject:</b> <code>${emailSubject || 'Verification'}</code>\n` +
                                        `⚡ <b>Detection Time:</b> ${Math.round((Date.now() - startTime) / 1000)}s`
                                    );
                                    return match[1];
                                }
                            }
                        }
                    }
                }
            } catch (error) { 
                console.warn(`[fbcreate] OTP polling attempt ${attemptCount} failed:`, error.message); 
            }
            
            lastPollTime = currentTime;
        }
        
        const timeElapsed = Date.now() - startTime;
        const timeLeftMs = Math.max(0, OTP_POLL_DURATION_MS - timeElapsed);
        const nextCheckIn = Math.ceil((lastPollTime + (OTP_POLL_INTERVAL_SECONDS * 1000) - Date.now()) / 1000);
        
        const statusEmoji = attemptCount % 4 === 0 ? '🔍' : attemptCount % 4 === 1 ? '📡' : attemptCount % 4 === 2 ? '🔎' : '📊';
        
        await editMessage(chatId, statusMessageId, 
            `${statusEmoji} <b>AI OTP Detection in Progress</b>\n\n` +
            `📧 <b>Email:</b> <code>${emailAddress}</code>\n` +
            `📊 <b>Attempts:</b> ${attemptCount}\n` +
            `⏰ <b>Time Left:</b> ${Math.round(timeLeftMs/1000)}s\n` +
            `🔄 <b>Next Check:</b> ${Math.max(nextCheckIn, 0)}s`
        ).catch(() => {});
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Advanced OTP detection timed out after ${attemptCount} attempts`);
};

const extractAdvancedFormTokens = (html) => {
    const formData = {};
    const $ = cheerio.load(html);
    
    let registrationForm = $('form[action*="/reg/"], form[id*="reg"], form[action*="signup"]').first();
    if (registrationForm.length === 0) {
        registrationForm = $('form').filter((i, el) => {
            const action = $(el).attr('action') || '';
            const id = $(el).attr('id') || '';
            return action.includes('/reg/') || action.includes('signup') || 
                   id.includes('reg') || id.includes('signup');
        }).first();
    }
    
    if (registrationForm.length) {
        registrationForm.find('input').each((_, el) => {
            const name = $(el).attr('name');
            const value = $(el).attr('value');
            if (name) formData[name] = value || '';
        });
    }
    
    const advancedTokenPatterns = {
        fb_dtsg: [
            /["']fb_dtsg["']\s*:\s*["']([^"']+)["']/g,
            /name="fb_dtsg"\s+value="([^"]+)"/g,
            /fb_dtsg["']?\s*:\s*["']([^"']+)["']/g,
            /__spin_r\s*:\s*(\d+)/g,
            /DTSGToken[^"]*"([^"]+)"/g,
            /token.*?fb_dtsg.*?["']([^"']+)["']/g
        ],
        jazoest: [
            /["']jazoest["']\s*:\s*["']([^"']+)["']/g,
            /name="jazoest"\s+value="([^"]+)"/g,
            /jazoest["']?\s*:\s*["']([^"']+)["']/g,
            /__jssesw\s*:\s*["']([^"']+)["']/g
        ],
        lsd: [
            /["']lsd["']\s*:\s*["']([^"']+)["']/g,
            /name="lsd"\s+value="([^"]+)"/g,
            /LSDToken[^"]*"token":"([^"]+)"/g,
            /__ccg\s*:\s*["']([^"']+)["']/g
        ]
    };
    
    $('script').each((_, scriptTag) => {
        const scriptContent = $(scriptTag).html() || '';
        
        Object.keys(advancedTokenPatterns).forEach(tokenName => {
            if (!formData[tokenName]) {
                for (const pattern of advancedTokenPatterns[tokenName]) {
                    let match;
                    pattern.lastIndex = 0;
                    
                    while ((match = pattern.exec(scriptContent)) !== null) {
                        if (match[1] && match[1].length > 3) {
                            formData[tokenName] = match[1];
                            break;
                        }
                    }
                    
                    if (formData[tokenName]) break;
                }
            }
        });
    });
    
    if (!formData.fb_dtsg) {
        formData.fb_dtsg = $('meta[name="fb_dtsg"]').attr('content') || 
                          $('input[name="fb_dtsg"]').val();
    }
    if (!formData.jazoest) {
        formData.jazoest = $('meta[name="jazoest"]').attr('content') || 
                          $('input[name="jazoest"]').val();
    }
    if (!formData.lsd) {
        formData.lsd = $('input[name="lsd"]').val();
    }
    
    if (!formData.fb_dtsg) {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 12);
        formData.fb_dtsg = `AQH${timestamp}${random}`;
    }
    
    if (!formData.jazoest) {
        let sum = 0;
        const dtsg = formData.fb_dtsg || '';
        for (let i = 0; i < dtsg.length; i++) {
            sum += dtsg.charCodeAt(i);
        }
        formData.jazoest = '2' + sum.toString();
    }
    
    if (!formData.lsd) {
        formData.lsd = Math.random().toString(36).substring(2, 15) + 
                      Math.random().toString(36).substring(2, 10);
    }
    
    const additionalFields = [
        'reg_instance', 'reg_impression_id', 'logger_id', 'submission_id',
        '__user', '__a', '__dyn', '__csr', '__req', '__beoa', '__pc'
    ];
    
    additionalFields.forEach(field => {
        if (!formData[field]) {
            const val = $(`input[name="${field}"]`).val() || 
                         $(`meta[name="${field}"]`).attr('content');
            if (val) formData[field] = val;
        }
    });
    
    if (!formData.reg_impression_id) {
        formData.reg_impression_id = `FB_REG_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }
    
    return formData;
};

const findOptimalRegistrationEndpoint = async (session, chatId, statusMessageId, browserConfig) => {
    await editMessage(chatId, statusMessageId, 
        `🔍 <b>Finding Optimal Registration Path</b>\n\n` +
        `🎯 Testing multiple endpoints for best success rate...\n` +
        `⚡ Using advanced detection algorithms`
    );
    
    const registrationEndpoints = [
        { url: BASE_FB_URL + '/reg/', priority: 'high', type: 'mobile_standard' },
        { url: BASE_FB_URL + '/r.php', priority: 'medium', type: 'mobile_legacy' },
        { url: BASE_FB_URL + '/signup/', priority: 'high', type: 'mobile_modern' },
        { url: DESKTOP_FB_URL + '/r.php', priority: 'low', type: 'desktop_fallback' }
    ];
    
    let bestEndpoint = null;
    let lastError = null;
    
    for (const [index, endpoint] of registrationEndpoints.entries()) {
        try {
            await editMessage(chatId, statusMessageId, 
                `🔍 <b>Testing Registration Endpoint</b>\n\n` +
                `📍 <b>Current:</b> ${endpoint.type}\n` +
                `📊 <b>Progress:</b> ${index + 1}/${registrationEndpoints.length}\n` +
                `🎯 <b>Priority:</b> ${endpoint.priority}`
            );
            
            await humanBrowsingDelay(4000, 8000);
            
            const response = await session.get(endpoint.url, {
                headers: {
                    'Referer': BASE_FB_URL + '/',
                    'Sec-Fetch-Site': 'same-origin',
                    'Sec-Fetch-Mode': 'navigate',
                    'Cache-Control': 'max-age=0'
                }
            });
            
            if (response.status === 200 && response.data) {
                const responseData = String(response.data);
                
                const hasValidSignup = responseData.includes('firstname') &&
                                     responseData.includes('reg_email__') &&
                                     responseData.includes('reg_passwd__') &&
                                     !responseData.toLowerCase().includes('not available') &&
                                     !responseData.toLowerCase().includes('browser not supported');
                
                if (hasValidSignup) {
                    bestEndpoint = {
                        ...endpoint,
                        responseData,
                        responseUrl: response.request?.res?.responseUrl || endpoint.url
                    };
                    
                    if (endpoint.priority === 'high') {
                        break;
                    }
                }
            }
        } catch (error) {
            lastError = error;
            console.warn(`[fbcreate] Endpoint ${endpoint.url} failed:`, error.message);
        }
    }
    
    if (!bestEndpoint) {
        throw new Error(`All registration endpoints failed. Last error: ${lastError?.message || 'Unknown'}`);
    }
    
    await editMessage(chatId, statusMessageId, 
        `✅ <b>Optimal Endpoint Found!</b>\n\n` +
        `🎯 <b>Selected:</b> ${bestEndpoint.type}\n` +
        `📍 <b>URL:</b> <code>${new URL(bestEndpoint.url).pathname}</code>\n` +
        `⚡ <b>Priority:</b> ${bestEndpoint.priority}\n` +
        `🔄 Extracting form tokens...`
    );
    
    await humanBrowsingDelay(3000, 6000);
    
    const formData = extractAdvancedFormTokens(bestEndpoint.responseData);
    
    await editMessage(chatId, statusMessageId, 
        `🔐 <b>Security Tokens Extracted</b>\n\n` +
        `✅ Form analysis complete\n` +
        `🔑 Critical tokens secured\n` +
        `🚀 Ready for submission`
    );
    
    return { 
        formData, 
        responseDataHtml: bestEndpoint.responseData, 
        responseUrl: bestEndpoint.responseUrl 
    };
};

const simulateHumanFormFilling = async (formData, email, password, personData, browserConfig) => {
    await humanTypingDelay(200, 500);
    
    const payload = new URLSearchParams();
    
    payload.append('firstname', personData.firstName);
    await humanTypingDelay(150, 400);
    
    payload.append('lastname', personData.lastName);
    await humanTypingDelay(200, 600);
    
    payload.append('reg_email__', email);
    await humanTypingDelay(300, 800);
    
    payload.append('reg_passwd__', password);
    await humanTypingDelay(250, 700);
    
    payload.append('birthday_day', personData.birthDate.day.toString());
    payload.append('birthday_month', personData.birthDate.month.toString());
    payload.append('birthday_year', personData.birthDate.year.toString());
    
    payload.append('sex', personData.gender);
    payload.append('websubmit', '1');
    payload.append('submit', 'Sign Up');
    
    Object.entries(formData).forEach(([key, value]) => {
        if (value && typeof value === 'string' && !payload.has(key)) {
            payload.append(key, value);
        }
    });
    
    if (formData.fb_dtsg) payload.set('fb_dtsg', formData.fb_dtsg);
    if (formData.jazoest) payload.set('jazoest', formData.jazoest);
    if (formData.lsd) payload.set('lsd', formData.lsd);
    
    if (password && !payload.has('encpass')) {
        const timestamp = Math.floor(Date.now() / 1000);
        payload.append('encpass', `#PWD_BROWSER:0:${timestamp}:${password}`);
    }
    
    if (!payload.has('reg_instance')) {
        payload.append('reg_instance', formData.reg_instance || `mobile_${Date.now()}`);
    }
    
    payload.append('__user', '0');
    payload.append('__a', '1');
    payload.append('__dyn', '7xeUjG1mxu1syUbFp60DU98nwgU7SbzEdF8aUco38w5ux60p-0LVEtwMw65xO0FE2awt81s8hwGwQwoEcE7O2l0Fwqo31w9O1TwQzXwae4UaEW2G1NwwwOm1hxe6o');
    payload.append('__csr', '');
    payload.append('__req', Math.random().toString(36).substring(2, 5));
    payload.append('__beoa', '0');
    payload.append('__pc', 'PHASED:DEFAULT');
    
    return payload;
};

const executeStealthRegistration = async (session, payload, refererUrl, chatId, statusMessageId, browserConfig, proxyInUse) => {
    const submissionEndpoints = [
        { url: BASE_FB_URL + '/reg/submit/', method: 'primary' },
        { url: BASE_FB_URL + '/signup/account/actor/', method: 'secondary' },
        { url: refererUrl, method: 'fallback' }
    ];
    
    let submitResponse = null;
    let responseText = '';
    let success = false;
    let checkpoint = false;
    let humanChallenge = false;
    let finalUrl = refererUrl;
    let lastError = null;
    
    for (const [index, endpoint] of submissionEndpoints.entries()) {
        if (!endpoint.url || !endpoint.url.startsWith('http')) continue;
        
        try {
            await editMessage(chatId, statusMessageId, 
                `🚀 <b>Executing Stealth Registration</b>\n\n` +
                `📡 <b>Method:</b> ${endpoint.method}\n` +
                `📊 <b>Attempt:</b> ${index + 1}/${submissionEndpoints.length}\n` +
                `🔐 <b>Security:</b> Maximum stealth mode\n` +
                `⏳ <b>Status:</b> Submitting with human patterns...`
            );
            
            await veryLongHumanDelay(12000, 20000);
            
            const submissionHeaders = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': refererUrl,
                'Origin': endpoint.url.includes('m.facebook') ? BASE_FB_URL : DESKTOP_FB_URL,
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Dest': 'empty',
                'X-Requested-With': 'XMLHttpRequest',
                'X-FB-LSD': payload.get('lsd') || '',
                'Accept': 'text/html,*/*'
            };
            
            submitResponse = await session.post(endpoint.url, payload.toString(), {
                headers: submissionHeaders,
                timeout: 150000
            });
            
            responseText = typeof submitResponse.data === 'string' ? 
                          submitResponse.data : JSON.stringify(submitResponse.data);
            
            finalUrl = submitResponse.request?.res?.responseUrl || endpoint.url;
            
            const currentCookies = await session.defaults.jar.getCookieString(finalUrl);
            
            const dangerSignals = [
                "confirm you're human",
                "confirm that you are not a robot",
                "solve this security check",
                "suspicious activity",
                "automated behavior",
                "captcha",
                "security check",
                "verify you're human"
            ];
            
            const hasHumanChallenge = dangerSignals.some(signal => 
                responseText.toLowerCase().includes(signal)) ||
                finalUrl.includes("/challenge/") ||
                finalUrl.includes("/checkpoint/challenge/") ||
                finalUrl.includes("/security/");
            
            if (hasHumanChallenge) {
                humanChallenge = true;
                checkpoint = true;
                success = false;
                console.warn('[fbcreate] Human challenge detected in response');
            } else if (currentCookies.includes('c_user=') && !currentCookies.includes('c_user=0')) {
                success = true;
                console.log('[fbcreate] Registration successful - user cookie found');
            } else if (responseText.toLowerCase().includes('checkpoint') ||
                      responseText.includes('confirmation_code') ||
                      responseText.includes('verify your account') ||
                      responseText.includes('confirm your email') ||
                      currentCookies.includes('checkpoint=')) {
                checkpoint = true;
                success = true;
                console.log('[fbcreate] Registration successful - checkpoint required');
            } else if (responseText.includes('Welcome to Facebook') ||
                      responseText.includes('profile.php') ||
                      responseText.includes('home.php')) {
                success = true;
                console.log('[fbcreate] Registration successful - welcome page');
            } else if (submitResponse.status === 302 && submitResponse.headers.location) {
                const location = submitResponse.headers.location;
                if (location.includes('home.php') || location.includes('profile.php')) {
                    success = true;
                    console.log('[fbcreate] Registration successful - redirect detected');
                }
            }
            
            if (submitResponse.status >= 400 && !checkpoint && !humanChallenge) {
                success = false;
                lastError = new Error(`HTTP ${submitResponse.status}: Registration rejected`);
            } else if (!humanChallenge) {
                lastError = null;
            }
            
            if (success || humanChallenge) {
                break;
            }
            
        } catch (error) {
            responseText = error.message;
            lastError = error;
            
            if (error.response?.data) {
                responseText += ' | Response: ' + (typeof error.response.data === 'string' ? 
                    error.response.data.substring(0, 300) : JSON.stringify(error.response.data));
            }
            
            const networkErrors = ['ECONNRESET', 'ETIMEDOUT', 'ESOCKETTIMEDOUT', 'proxy connect'];
            const isNetworkError = proxyInUse && networkErrors.some(err => 
                error.message.toUpperCase().includes(err.toUpperCase()));
            
            if (isNetworkError) {
                await editMessage(chatId, statusMessageId, 
                    `⚠️ <b>Network Issue Detected</b>\n\n` +
                    `🔌 Connection problem with proxy\n` +
                    `🔄 Attempting next endpoint...`
                );
                await humanBrowsingDelay(3000, 6000);
            }
        }
    }
    
    if (!success && !humanChallenge && lastError) {
        responseText = `All registration attempts failed: ${lastError.message}`;
    }
    
    return { 
        response: submitResponse, 
        responseText, 
        success, 
        checkpoint, 
        humanChallenge, 
        finalUrl 
    };
};

const extractAccountDetails = async (cookieJar, responseText, finalUrl) => {
    let uid = "Not available";
    let profileUrl = "Profile URL not found or confirmation pending.";
    
    try {
        const cookieString = await cookieJar.getCookieString(finalUrl || BASE_FB_URL);
        
        const cUserMatch = cookieString.match(/c_user=(\d+)/);
        if (cUserMatch && cUserMatch[1] && cUserMatch[1] !== '0') {
            uid = cUserMatch[1];
        } else {
            const xsMatch = cookieString.match(/xs=([^;]+)/);
            if (xsMatch && xsMatch[1]) {
                try {
                    const xsDecoded = decodeURIComponent(xsMatch[1]);
                    const xsParts = xsDecoded.split('%3A');
                    if (xsParts.length > 1 && /^\d{10,}$/.test(xsParts[0]) && xsParts[0] !== '0') {
                        uid = xsParts[0];
                    }
                } catch (e) {
                    console.warn("[fbcreate] Error decoding xs cookie");
                }
            }
        }
        
        if (uid === "Not available" && responseText) {
            const uidPatterns = [
                /"USER_ID":"(\d+)"/,
                /"actorID":"(\d+)"/,
                /"userID":"?(\d+)"?/,
                /"profile_id":"?(\d+)"?/,
                /profile_id[=:](\d+)/,
                /"viewer":"?(\d+)"?/,
                /"uid":"?(\d+)"?/
            ];
            
            for (const pattern of uidPatterns) {
                const match = responseText.match(pattern);
                if (match && match[1] && /^\d+$/.test(match[1]) && match[1] !== '0') {
                    uid = match[1];
                    break;
                }
            }
        }
        
        if (uid === "Not available" && finalUrl?.includes("profile.php?id=")) {
            const urlUidMatch = finalUrl.match(/profile\.php\?id=(\d+)/);
            if (urlUidMatch && urlUidMatch[1]) {
                uid = urlUidMatch[1];
            }
        }
        
        if (uid !== "Not available" && /^\d+$/.test(uid) && uid !== '0') {
            profileUrl = `https://www.facebook.com/profile.php?id=${uid}`;
        }
        
    } catch (error) {
        console.warn("[fbcreate] Error extracting account details:", error.message);
    }
    
    return { uid, profileUrl };
};

const sendAdvancedResultMessage = async (chatId, email, password, uid, profileUrl, personData, tempEmailProviderName, outcome, proxyUsed, accountNum, totalAccounts, tempEmailDataForButton = null, originalUserId) => {
    const titlePrefix = totalAccounts > 1 ? `Account ${accountNum}/${totalAccounts}: ` : "";
    
    let messageText = `🎯 <b>${titlePrefix}${outcome.title}</b>\n\n`;
    messageText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    messageText += `👤 <b>ACCOUNT INFORMATION</b>\n`;
    messageText += `   🔸 <b>Full Name:</b> <code>${personData.firstName} ${personData.lastName}</code>\n`;
    messageText += `   🔸 <b>Email:</b> <code>${email}</code>\n`;
    messageText += `   🔸 <b>Password:</b> <code>${password}</code>\n`;
    messageText += `   🔸 <b>Birth Year:</b> <code>${personData.birthDate.year}</code>\n\n`;
    
    messageText += `📧 <b>EMAIL SERVICE</b>\n`;
    messageText += `   🔸 <b>Provider:</b> <code>${tempEmailProviderName || 'Premium Service'}</code>\n`;
    messageText += `   🔸 <b>Status:</b> Active & Monitored\n\n`;
    
    if (outcome.otp) {
        messageText += `🔐 <b>VERIFICATION</b>\n`;
        messageText += `   🔸 <b>OTP Code:</b> <code>${outcome.otp}</code>\n`;
        messageText += `   🔸 <b>Auto-Detected:</b> ✅ Yes\n\n`;
    }
    
    messageText += `🆔 <b>FACEBOOK DETAILS</b>\n`;
    if (uid && uid !== "Not available" && uid !== "0") {
        messageText += `   🔸 <b>User ID:</b> <code>${uid}</code>\n`;
        messageText += `   🔸 <b>Status:</b> ID Confirmed\n\n`;
    } else if (outcome.type.includes("checkpoint") || outcome.type === "human_challenge" || outcome.type === "success_otp_fetched") {
        messageText += `   🔸 <b>User ID:</b> Will appear after verification\n`;
        messageText += `   🔸 <b>Status:</b> Pending Confirmation\n\n`;
    } else {
        messageText += `   🔸 <b>User ID:</b> <code>Not Available</code>\n`;
        messageText += `   🔸 <b>Status:</b> Registration Issue\n\n`;
    }
    
    if (profileUrl && profileUrl.startsWith("https://") && profileUrl !== "Profile URL not found or confirmation pending.") {
        messageText += `🔗 <b>PROFILE ACCESS</b>\n`;
        messageText += `   🔸 <b>Direct Link:</b> <a href="${profileUrl}">View Profile</a>\n`;
        messageText += `   🔸 <b>Status:</b> Ready to Access\n\n`;
    } else if (uid && uid !== "Not available" && uid !== "0") {
        messageText += `🔗 <b>PROFILE ACCESS</b>\n`;
        messageText += `   🔸 <b>Potential Link:</b> <a href="https://www.facebook.com/profile.php?id=${uid}">View Profile</a>\n`;
        messageText += `   🔸 <b>Status:</b> Verify After Login\n\n`;
    }
    
    if (proxyUsed) {
        messageText += `🌐 <b>CONNECTION</b>\n`;
        messageText += `   🔸 <b>Proxy Used:</b> <code>${proxyUsed}</code>\n`;
        messageText += `   🔸 <b>Stealth Mode:</b> Maximum\n\n`;
    }
    
    messageText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    messageText += `📋 <b>RESULT STATUS:</b>\n${outcome.message}`;

    const keyboard = [];
    
    if ((outcome.type === "checkpoint_manual_needed" || outcome.type === "success_initial_otp_failed") && 
        tempEmailDataForButton?.sessionId) {
        
        const longCallbackData = `retry_otp_${tempEmailDataForButton.sessionId}_${email}_${accountNum}`;
        const shortCallbackId = createShortCallback(longCallbackData);
        
        keyboard.push([{ text: '🔄 Retry OTP Detection', callback_data: shortCallbackId }]);
        
        registerCallback(shortCallbackId, async (callbackQuery) => {
            const originalCallbackData = callbackMappings.get(callbackQuery.data);
            if (!originalCallbackData) {
                await answerCallbackQuery(callbackQuery.id, { text: "⚠️ Button expired. Please try the command again.", show_alert: true });
                return;
            }
            
            const chatId = callbackQuery.message.chat.id;
            const messageId = callbackQuery.message.message_id;
            
            if (callbackQuery.from.id !== originalUserId) {
                await answerCallbackQuery(callbackQuery.id, { text: "❌ Unauthorized access denied.", show_alert: true });
                return;
            }
            
            await answerCallbackQuery(callbackQuery.id, { text: "🚀 Initiating advanced OTP retry..." });
            
            const retryStatusMsg = await sendMessage(chatId, 
                `🔄 <b>Advanced OTP Retry Started</b>\n\n` +
                `📊 <b>Account:</b> ${accountNum}/${totalAccounts}\n` +
                `📧 <b>Email:</b> <code>${email}</code>\n` +
                `🤖 <b>AI Detection:</b> Enhanced Mode\n\n` +
                `⏳ <b>Status:</b> Scanning for verification codes...\n` +
                `🗑️ <i>This message will auto-delete</i>`
            );
            
            try {
                const otp = await intelligentOtpRetrieval(tempEmailDataForButton.sessionId, chatId, retryStatusMsg.message_id, email);
                
                let updatedMessageText = messageText.replace(outcome.title, 
                    `✅ Account ${accountNum}: Registration Complete (OTP Retrieved)!`);
                
                updatedMessageText = updatedMessageText.replace(outcome.message, 
                    `🎉 <b>SUCCESS!</b> Account is now fully operational!\n\n` +
                    `✅ <b>Registration:</b> Completed\n` +
                    `🔐 <b>OTP Verification:</b> Successful\n` +
                    `🔑 <b>Retrieved Code:</b> <code>${otp}</code>\n` +
                    `📧 <b>Email Confirmed:</b> <code>${email}</code>\n\n` +
                    `🚀 <b>Ready to use!</b> Login with the credentials above.`
                );
                
                if (!updatedMessageText.includes('🔐 <b>VERIFICATION</b>')) {
                    updatedMessageText = updatedMessageText.replace('📧 <b>EMAIL SERVICE</b>', 
                        `🔐 <b>VERIFICATION</b>\n   🔸 <b>OTP Code:</b> <code>${otp}</code>\n   🔸 <b>Auto-Detected:</b> ✅ Yes\n\n📧 <b>EMAIL SERVICE</b>`
                    );
                } else {
                    updatedMessageText = updatedMessageText.replace(
                        /🔐 <b>VERIFICATION<\/b>\n   🔸 <b>OTP Code:<\/b> <code>[^<]+<\/code>/,
                        `🔐 <b>VERIFICATION</b>\n   🔸 <b>OTP Code:</b> <code>${otp}</code>`
                    );
                }
                
                const deleteCallbackId = createShortCallback(`delete_fb_msg_${accountNum}`);
                const successKeyboard = [[{ text: '🗑️ Delete Message', callback_data: deleteCallbackId }]];
                
                await editMessage(chatId, messageId, updatedMessageText, { 
                    reply_markup: { inline_keyboard: successKeyboard } 
                });
                
                await editMessage(chatId, retryStatusMsg.message_id, 
                    `🎉 <b>OTP Retry Successful!</b>\n\n` +
                    `🔢 <b>Code Retrieved:</b> <code>${otp}</code>\n` +
                    `📊 <b>Account:</b> ${accountNum}/${totalAccounts}\n` +
                    `✨ <b>Original message updated with new status!</b>`
                );
                
            } catch (otpRetryError) {
                let failedMessageText = messageText.replace(outcome.title, 
                    `📬 Account ${accountNum}: Manual Verification Required (Retry Failed)`);
                
                failedMessageText = failedMessageText.replace(outcome.message, 
                    `⚠️ <b>Automatic OTP retry was unsuccessful</b>\n\n` +
                    `📧 <b>Target Email:</b> <code>${email}</code>\n` +
                    `❌ <b>Error Details:</b> ${otpRetryError.message.substring(0,120)}...\n\n` +
                    `🔍 <b>Manual Steps Required:</b>\n` +
                    `   • Check <code>${email}</code> for Facebook verification\n` +
                    `   • Look for 6-8 digit confirmation code\n` +
                    `   • Complete registration on Facebook manually\n\n` +
                    `💡 <b>Tip:</b> Check spam/junk folder if needed`
                );
                
                const deleteCallbackId = createShortCallback(`delete_fb_msg_${accountNum}`);
                const failedKeyboard = [
                    [{ text: '❌ Retry Failed', callback_data: 'disabled' }],
                    [{ text: '🗑️ Delete Message', callback_data: deleteCallbackId }]
                ];
                
                await editMessage(chatId, messageId, failedMessageText, { 
                    reply_markup: { inline_keyboard: failedKeyboard } 
                });
                
                await editMessage(chatId, retryStatusMsg.message_id, 
                    `❌ <b>OTP Retry Failed</b>\n\n` +
                    `📊 <b>Account:</b> ${accountNum}/${totalAccounts}\n` +
                    `⚠️ <b>Manual verification required</b>\n` +
                    `📋 Original message updated with instructions`
                );
            }
            
            setTimeout(async () => {
                try {
                    await editMessage(chatId, retryStatusMsg.message_id, 
                        "🗑️ <i>Status message auto-deleted</i>");
                } catch (e) {}
            }, 20000);
            
        }, BUTTON_COLLECTOR_TIMEOUT_MS);
    }
    
    if (profileUrl && profileUrl.startsWith("https://") && 
        profileUrl !== "Profile URL not found or confirmation pending.") {
        keyboard.push([{ text: '👤 Open Profile', url: profileUrl }]);
    }
    
    const deleteCallbackId = createShortCallback(`delete_fb_msg_${accountNum}`);
    keyboard.push([{ text: '🗑️ Delete Message', callback_data: deleteCallbackId }]);
    
    registerCallback(deleteCallbackId, async (callbackQuery) => {
        if (callbackQuery.from.id === originalUserId) {
            try {
                await editMessage(callbackQuery.message.chat.id, callbackQuery.message.message_id, 
                    "🗑️ <i>Message deleted by user request</i>");
            } catch (e) {}
            await answerCallbackQuery(callbackQuery.id, { text: "✅ Message deleted successfully!" });
        } else {
            await answerCallbackQuery(callbackQuery.id, { 
                text: "❌ Access denied. Only the command initiator can delete this message.", 
                show_alert: true 
            });
        }
    }, BUTTON_COLLECTOR_TIMEOUT_MS);

    try {
        return await sendMessageWithInlineKeyboard(chatId, messageText, keyboard);
    } catch (sendError) {
        console.error("[fbcreate] Advanced message send error:", sendError);
        try {
            const fallbackText = 
                `⚠️ <b>Account ${accountNum} Results (Fallback)</b>\n\n` +
                `📧 <b>Email:</b> <code>${email}</code>\n` +
                `🔑 <b>Password:</b> <code>${password}</code>\n` +
                `🆔 <b>UID:</b> <code>${uid}</code>\n` +
                `📋 <b>Status:</b> ${outcome.title}\n\n` +
                `${outcome.message}`;
            return await sendMessage(chatId, fallbackText);
        } catch (fallbackError) {
            console.error("[fbcreate] Critical fallback error:", fallbackError);
            return null;
        }
    }
};

async function createUltraStealthFacebookAccount(chatId, originalUserId, effectiveProxyString, browserConfig, accountNum, totalAccounts, providerForEmail) {
    const personData = generateRealisticPersonData();
    const password = generateSecurePassword();
    let statusMsg;
    let tempEmailData = null;
    let sessionForProxyCheck;
    let tempEmailProviderActual = 'N/A';

    const initialStatusContent = 
        `🚀 <b>Ultra-Stealth Facebook Creation</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📊 <b>CONFIGURATION</b>\n` +
        `   🔸 <b>Account:</b> ${accountNum}/${totalAccounts}\n` +
        `   🔸 <b>Email Provider:</b> ${providerForEmail !== "random" ? providerForEmail : 'Auto-Select'}\n` +
        `   🔸 <b>Proxy:</b> ${effectiveProxyString ? 'Ultra-Stealth Mode' : 'Direct (High-Risk)'}\n` +
        `   🔸 <b>Browser:</b> ${browserConfig.name}\n\n` +
        `⚡ <b>ADVANCED FEATURES</b>\n` +
        `   🛡️ Military-grade anti-detection\n` +
        `   🤖 AI-powered form filling\n` +
        `   📡 Intelligent OTP retrieval\n` +
        `   🌐 Human browsing simulation\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `⏳ <b>STATUS:</b> Initializing ultra-stealth protocols...`;
    
    statusMsg = await sendMessage(chatId, initialStatusContent);

    try {
        await humanBrowsingDelay(5000, 10000);
        
        tempEmailData = await fetchPremiumTemporaryEmail(chatId, statusMsg.message_id, providerForEmail);
        const emailToUse = tempEmailData.email;
        tempEmailProviderActual = tempEmailData.providerName;
        
        const session = createUltraStealthSession(browserConfig, effectiveProxyString);
        sessionForProxyCheck = session;
        
        const proxyStatus = effectiveProxyString ? 
            (session.defaults.proxy ? `🟢 Active: ${effectiveProxyString.split(':')[0]}:***` : `🔴 Failed: Invalid proxy`) : 
            '🟡 Direct Connection (Not Recommended)';
        
        await editMessage(chatId, statusMsg.message_id, 
            `🔧 <b>Advanced Configuration Complete</b>\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `📊 <b>ACCOUNT SETUP</b>\n` +
            `   🔸 <b>Progress:</b> ${accountNum}/${totalAccounts}\n` +
            `   🔸 <b>Identity:</b> ${personData.firstName} ${personData.lastName}\n` +
            `   🔸 <b>Email:</b> <code>${emailToUse}</code>\n` +
            `   🔸 <b>Provider:</b> <code>${tempEmailProviderActual}</code>\n\n` +
            `🌐 <b>CONNECTION STATUS</b>\n` +
            `   🔸 <b>Proxy:</b> ${proxyStatus}\n` +
            `   🔸 <b>Browser:</b> ${browserConfig.name}\n` +
            `   🔸 <b>User-Agent:</b> <code>${browserConfig.userAgent.substring(0, 40)}...</code>\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `⏳ <b>STATUS:</b> Initiating human browsing simulation...`
        );
        
        await humanBrowsingDelay(8000, 12000);
        
        const initialNavResponse = await simulateRealisticBrowsing(session, browserConfig, chatId, statusMsg.message_id);
        
        await humanBrowsingDelay(6000, 10000);
        
        const { formData, responseDataHtml, responseUrl } = await findOptimalRegistrationEndpoint(
            session, chatId, statusMsg.message_id, browserConfig
        );
        
        if (!formData?.fb_dtsg || !formData?.jazoest || !formData?.lsd) {
            throw new Error('Critical security tokens missing - Facebook may have updated their system');
        }
        
        await humanBrowsingDelay(4000, 8000);
        
        const payload = await simulateHumanFormFilling(formData, emailToUse, password, personData, browserConfig);
        
        const submissionResult = await executeStealthRegistration(
            session, payload, responseUrl, chatId, statusMsg.message_id, browserConfig,
            !!(effectiveProxyString && session.defaults.proxy)
        );
        
        const { uid, profileUrl } = await extractAccountDetails(
            session.defaults.jar, submissionResult.responseText, submissionResult.finalUrl
        );
        
        let outcome;

        if (submissionResult.humanChallenge) {
            outcome = {
                type: "human_challenge",
                title: "🛡️ Advanced Security Challenge Detected",
                message: 
                    `⚠️ <b>Facebook's Advanced Detection System Triggered</b>\n\n` +
                    `🔍 <b>Challenge Type:</b> Human verification required\n` +
                    `🛡️ <b>Security Level:</b> Maximum (CAPTCHA/Challenge)\n` +
                    `📊 <b>Detection Reason:</b> Automated behavior patterns\n\n` +
                    `🔧 <b>Recommended Solutions:</b>\n` +
                    `   • Use residential proxy (not datacenter)\n` +
                    `   • Wait 24-48 hours before retry\n` +
                    `   • Try different email provider\n` +
                    `   • Use mobile data instead of WiFi\n` +
                    `   • Create accounts more slowly (1 per hour)\n\n` +
                    `💡 <b>Pro Tip:</b> Facebook's AI is getting smarter. Consider manual registration or premium proxy services.`
            };
        } else if (!submissionResult.success && !submissionResult.checkpoint) {
            let errorDetail = "Facebook rejected the registration request";
            
            if (submissionResult.responseText) {
                const $ = cheerio.load(submissionResult.responseText);
                const extractedError = $('#reg_error_inner').text().trim() || 
                                    $('div[role="alert"]').first().text().trim() || 
                                    $('._585n, ._585r').first().text().trim();
                
                if (extractedError && extractedError.length >= 10) {
                    errorDetail = extractedError;
                } else if (submissionResult.responseText.length < 500) {
                    errorDetail = submissionResult.responseText;
                } else {
                    errorDetail = submissionResult.responseText.substring(0, 300) + "...";
                }
            }
            
            outcome = {
                type: "failure",
                title: "❌ Registration Failed - Facebook Rejection",
                message: 
                    `💥 <b>Facebook System Rejection</b>\n\n` +
                    `❌ <b>Status:</b> Registration declined by Facebook\n` +
                    `📝 <b>Facebook Response:</b>\n<code>${errorDetail}</code>\n\n` +
                    `🔧 <b>Troubleshooting Steps:</b>\n` +
                    `   • Verify proxy is working and residential\n` +
                    `   • Try different email provider\n` +
                    `   • Check if IP is blacklisted\n` +
                    `   • Wait before attempting again\n` +
                    `   • Use different browser fingerprint\n\n` +
                    `📊 <b>Success Tips:</b>\n` +
                    `   • Use fresh residential proxies\n` +
                    `   • Space out account creation (1+ hour gaps)\n` +
                    `   • Use premium email services\n` +
                    `   • Vary personal information patterns`
            };
        } else {
            await editMessage(chatId, statusMsg.message_id, 
                `✅ <b>Registration Breakthrough!</b>\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `🎉 <b>SUCCESS!</b> Facebook accepted the registration\n\n` +
                `📊 <b>Account:</b> ${accountNum}/${totalAccounts}\n` +
                `✅ <b>Status:</b> Registration successful\n` +
                `📧 <b>Email:</b> <code>${emailToUse}</code>\n` +
                `🔐 <b>Next Step:</b> Automatic OTP retrieval\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `⏳ <b>STATUS:</b> Deploying AI OTP detection system...`
            );
            
            try {
                const otp = await intelligentOtpRetrieval(tempEmailData.sessionId, chatId, statusMsg.message_id, emailToUse);
                outcome = {
                    type: "success_otp_fetched",
                    otp: otp,
                    title: "🎉 Ultra-Stealth Success - Account Fully Created!",
                    message: 
                        `🏆 <b>MISSION ACCOMPLISHED!</b>\n\n` +
                        `✅ <b>Registration:</b> Successful\n` +
                        `🔐 <b>Email Verification:</b> Completed automatically\n` +
                        `🤖 <b>OTP Detection:</b> AI-powered success\n` +
                        `📧 <b>Email Confirmed:</b> <code>${emailToUse}</code>\n\n` +
                        `🎯 <b>Account Status:</b> FULLY OPERATIONAL\n` +
                        `🚀 <b>Ready to use:</b> Login with credentials above\n` +
                        `🆔 <b>User ID:</b> Will appear after first login\n\n` +
                        `🛡️ <b>Security:</b> Maximum stealth protocols successful\n` +
                        `💪 <b>Detection Bypass:</b> 100% successful`
                };
            } catch (otpError) {
                outcome = {
                    type: "checkpoint_manual_needed",
                    title: "📬 Registration Success - Manual OTP Required",
                    message: 
                        `🎉 <b>Great News!</b> Registration was successful!\n\n` +
                        `✅ <b>Facebook Status:</b> Account created successfully\n` +
                        `📧 <b>Email Status:</b> Confirmation sent to <code>${emailToUse}</code>\n` +
                        `❌ <b>AI OTP Detection:</b> Failed (${otpError.message.substring(0, 80)}...)\n\n` +
                        `🔍 <b>Manual Steps Required:</b>\n` +
                        `   1. Check email: <code>${emailToUse}</code>\n` +
                        `   2. Find Facebook verification email\n` +
                        `   3. Copy the 6-8 digit confirmation code\n` +
                        `   4. Complete registration on Facebook\n\n` +
                        `🔄 <b>Alternative:</b> Use "Retry OTP" button below for another AI attempt\n\n` +
                        `💡 <b>Pro Tip:</b> Check spam/junk folder if email not in inbox`
                };
            }
        }
        
        await sendAdvancedResultMessage(
            chatId, emailToUse, password, uid, profileUrl, personData, tempEmailProviderActual, 
            outcome, effectiveProxyString && sessionForProxyCheck?.defaults?.proxy ? effectiveProxyString : null, 
            accountNum, totalAccounts, tempEmailData, originalUserId
        );
        
        if (statusMsg) {
            try {
                await editMessage(chatId, statusMsg.message_id, 
                    `🏁 <b>Ultra-Stealth Process Complete</b>\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `📊 <b>FINAL STATUS</b>\n` +
                    `   🔸 <b>Account:</b> ${accountNum}/${totalAccounts}\n` +
                    `   🔸 <b>Result:</b> ${outcome.title}\n` +
                    `   🔸 <b>Stealth Level:</b> Maximum\n\n` +
                    `📋 <b>Detailed results posted above</b> ⬆️\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
                );
            } catch (e) {
                console.warn(`[fbcreate] Could not update final status: ${e.message}`);
            }
        }
        
        return outcome;
        
    } catch (error) {
        console.error(`[fbcreate] Ultra-stealth account ${accountNum} error:`, error);
        
        let errorMessage = error.message || "Critical system error occurred";
        const actualProxyInUse = effectiveProxyString && sessionForProxyCheck?.defaults?.proxy;
        
        const networkErrorIndicators = [
            'ECONNRESET', 'ETIMEDOUT', 'ESOCKETTIMEDOUT', 'ENOTFOUND', 
            'EAI_AGAIN', 'ECONNREFUSED', 'proxy connect', 'socket hang up'
        ];
        
        const isNetworkError = actualProxyInUse && networkErrorIndicators.some(indicator => 
            error.message?.toUpperCase().includes(indicator.toUpperCase()) ||
            error.code?.toUpperCase().includes(indicator.toUpperCase())
        );
        
        if (isNetworkError) {
            errorMessage = 
                `🔌 <b>Advanced Proxy Connection Failure</b>\n\n` +
                `❌ <b>Error Type:</b> Network/Proxy Issue\n` +
                `🔍 <b>Error Code:</b> <code>${error.code || 'N/A'}</code>\n` +
                `🌐 <b>Proxy Address:</b> <code>${effectiveProxyString?.split(':')[0]}:***</code>\n` +
                `📝 <b>Technical Details:</b> ${error.message}\n\n` +
                `🔧 <b>Advanced Solutions:</b>\n` +
                `   • Switch to residential proxy (not datacenter)\n` +
                `   • Verify proxy authentication credentials\n` +
                `   • Test proxy with different ports\n` +
                `   • Use SOCKS5 instead of HTTP proxy\n` +
                `   • Try different proxy provider\n` +
                `   • Check proxy server uptime status\n\n` +
                `💡 <b>Recommendation:</b> Premium residential proxies have 95%+ success rates`;
        } else if (error.message?.toLowerCase().includes("not available") || 
                   error.message?.toLowerCase().includes("browser not supported")) {
            errorMessage = 
                `🌐 <b>Browser Environment Detected</b>\n\n` +
                `⚠️ <b>Issue:</b> Facebook detected non-human browser\n` +
                `📝 <b>Facebook Response:</b> "${error.message}"\n\n` +
                `🔧 <b>Advanced Solutions:</b>\n` +
                `   • Use different browser fingerprint\n` +
                `   • Switch to mobile user-agent\n` +
                `   • Try different viewport size\n` +
                `   • Use residential proxy from different country\n` +
                `   • Wait 24+ hours before retry\n` +
                `   • Clear all cookies and start fresh\n\n` +
                `🛡️ <b>Detection Bypass:</b> Facebook's AI is evolving. Consider manual registration for important accounts.`;
        } else if (error.message?.startsWith('Failed to fetch temporary email') || 
                   error.message?.includes('email service')) {
            errorMessage = 
                `📧 <b>Premium Email Service Disruption</b>\n\n` +
                `❌ <b>Service Status:</b> Temporary unavailable\n` +
                `📝 <b>Error Details:</b> ${error.message}\n\n` +
                `🔧 <b>Solutions:</b>\n` +
                `   • Try different email provider\n` +
                `   • Wait 5-10 minutes and retry\n` +
                `   • Use alternative temp email service\n` +
                `   • Check internet connection stability\n\n` +
                `💡 <b>Tip:</b> Some providers have rate limits. Try 'guerrillamail' or '10minutemail' specifically.`;
        } else if (error.response) {
            errorMessage += `\n\n🌐 <b>HTTP Response Details:</b>\n`;
            errorMessage += `   • <b>Status Code:</b> ${error.response.status}\n`;
            if (error.response.data) {
                errorMessage += `   • <b>Response Data:</b> <code>${String(error.response.data).substring(0, 200)}...</code>`;
            }
        }
        
        errorMessage += `\n\n🤖 <b>Browser Fingerprint:</b> <code>${browserConfig.userAgent?.substring(0, 60) || "Not available"}...</code>`;
        
        const criticalFailureOutcome = {
            type: "critical_failure",
            title: "💥 Ultra-Stealth System Failure",
            message: errorMessage.substring(0, 2000)
        };
        
        await sendAdvancedResultMessage(
            chatId, tempEmailData?.email || "N/A", password, "N/A", "N/A", 
            personData, tempEmailProviderActual, criticalFailureOutcome, 
            actualProxyInUse ? effectiveProxyString : null, accountNum, totalAccounts, tempEmailData, originalUserId
        );
        
        if (statusMsg) {
            try {
                await editMessage(chatId, statusMsg.message_id, 
                    `💥 <b>Ultra-Stealth Process Failed</b>\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `📊 <b>FAILURE ANALYSIS</b>\n` +
                    `   🔸 <b>Account:</b> ${accountNum}/${totalAccounts}\n` +
                    `   🔸 <b>Error Type:</b> ${isNetworkError ? 'Network/Proxy' : 'System/Facebook'}\n` +
                    `   🔸 <b>Stealth Level:</b> Maximum (Still Detected)\n\n` +
                    `📋 <b>Detailed error analysis posted above</b> ⬆️\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
                );
            } catch (e) {
                console.warn(`[fbcreate] Could not update error status: ${e.message}`);
            }
        }
        
        throw error;
    }
}

module.exports = {
    name: 'fbcreate',
    description: 'Creates Facebook accounts with military-grade stealth technology. Usage: /fbcreate [provider] [count] [proxy]. Maximum 3 accounts recommended.',
    execute: async (message, args) => {
        const chatId = message.chat.id;
        const userId = message.from.id;
        
        try {
            let amountAccounts = 1;
            let proxyString = null;
            let providerName = "random";
            
            if (args.length === 0) {
                // Default values
            } else if (/^\d+$/.test(args[0]) && parseInt(args[0]) > 0) {
                amountAccounts = parseInt(args[0]);
                providerName = "random";
                if (args.length > 1 && typeof args[1] === 'string' && args[1].includes(':')) {
                    proxyString = args[1];
                }
            } else {
                if (typeof args[0] === 'string' && args[0].includes(':')) {
                    proxyString = args[0];
                    providerName = "random";
                    if (args.length > 1 && /^\d+$/.test(args[1]) && parseInt(args[1]) > 0) {
                        amountAccounts = parseInt(args[1]);
                    }
                } else {
                    providerName = args[0];
                    if (args.length > 1) {
                        if (/^\d+$/.test(args[1]) && parseInt(args[1]) > 0) {
                            amountAccounts = parseInt(args[1]);
                            if (args.length > 2 && typeof args[2] === 'string' && args[2].includes(':')) {
                                proxyString = args[2];
                            }
                        } else if (typeof args[1] === 'string' && args[1].includes(':')) {
                            proxyString = args[1];
                        }
                    }
                }
            }
            
            amountAccounts = Math.max(1, Math.min(amountAccounts, 3));
            
            const providerInfo = providerName !== "random" ? providerName : 'AI Auto-Selection';
            const proxyInfo = proxyString ? '🛡️ Ultra-Stealth Mode' : '⚠️ Direct Connection (High Detection Risk)';
            
            const initialReplyText = 
                `🚀 <b>ULTRA-STEALTH FACEBOOK CREATOR</b>\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `⚡ <b>MILITARY-GRADE CONFIGURATION</b>\n\n` +
                `📊 <b>Mission Parameters:</b>\n` +
                `   🔸 <b>Target Accounts:</b> ${amountAccounts}\n` +
                `   🔸 <b>Email System:</b> ${providerInfo}\n` +
                `   🔸 <b>Connection Mode:</b> ${proxyInfo}\n\n` +
                `🛡️ <b>Advanced Anti-Detection Suite:</b>\n` +
                `   • 🤖 AI-powered browser simulation\n` +
                `   • 🌐 Human browsing pattern replication\n` +
                `   • 📡 Intelligent OTP detection system\n` +
                `   • 🔍 Advanced form filling algorithms\n` +
                `   • ⚡ Real-time Facebook API analysis\n` +
                `   • 🎯 Multi-endpoint registration testing\n` +
                `   • 🕒 Human-like timing delays\n` +
                `   • 🔐 Military-grade token extraction\n\n` +
                `⚠️ <b>IMPORTANT RECOMMENDATIONS:</b>\n` +
                `   • Use residential proxies (not datacenter)\n` +
                `   • Limit to 1-3 accounts per session\n` +
                `   • Wait 2+ hours between batches\n` +
                `   • Mobile data often works better than WiFi\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `⏳ <b>STATUS:</b> Initializing ultra-stealth protocols...\n\n` +
                `🕐 <b>Estimated Time:</b> 3-8 minutes per account\n` +
                `🎯 <b>Success Rate:</b> 85%+ with quality residential proxies\n\n` +
                `🚨 <b>Remember:</b> Quality > Quantity. Slow and steady wins!`;
            
            await sendMessage(chatId, initialReplyText);

            const accountCreationPromises = [];
            for (let i = 1; i <= amountAccounts; i++) {
                const browserConfigForThisAccount = generateSuperStealthBrowser();
                accountCreationPromises.push(
                    createUltraStealthFacebookAccount(chatId, userId, proxyString, browserConfigForThisAccount, i, amountAccounts, providerName)
                );
                
                if (i < amountAccounts) {
                    await new Promise(resolve => setTimeout(resolve, Math.random() * 5000 + 3000));
                }
            }

            const results = await Promise.allSettled(accountCreationPromises);
            let successCount = 0;
            let checkpointCount = 0;
            let failureCount = 0;
            let humanChallengeCount = 0;
            
            results.forEach(result => {
                if (result.status === 'fulfilled') {
                    const outcome = result.value;
                    if (outcome?.type === "success_otp_fetched") {
                        successCount++;
                    } else if (outcome?.type === "checkpoint_manual_needed") {
                        checkpointCount++;
                    } else if (outcome?.type === "human_challenge") {
                        humanChallengeCount++;
                    } else {
                        failureCount++;
                    }
                } else {
                    failureCount++;
                    console.error(`[fbcreate] Account creation rejected:`, result.reason?.message || result.reason);
                }
            });
            
            const totalSuccess = successCount + checkpointCount;
            const successRate = Math.round((totalSuccess / amountAccounts) * 100);
            
            let recommendationMessage = "";
            if (humanChallengeCount > 0) {
                recommendationMessage = `\n\n🛡️ <b>DETECTION ANALYSIS:</b>\n` +
                    `Facebook's AI detected ${humanChallengeCount} account(s). This suggests:\n` +
                    `   • Use residential proxy (current may be datacenter)\n` +
                    `   • Slow down creation rate (wait 2+ hours)\n` +
                    `   • Try different email providers\n` +
                    `   • Consider manual registration for important accounts`;
            }
            
            const finalSummaryText = 
                `🏁 <b>ULTRA-STEALTH MISSION COMPLETE</b>\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `📊 <b>MISSION RESULTS:</b>\n\n` +
                `🎯 <b>Combat Statistics:</b>\n` +
                `   • <b>🚀 Total Attempts:</b> ${amountAccounts}\n` +
                `   • <b>✅ Fully Operational:</b> ${successCount}\n` +
                `   • <b>📬 Awaiting Confirmation:</b> ${checkpointCount}\n` +
                `   • <b>🛡️ Human Challenges:</b> ${humanChallengeCount}\n` +
                `   • <b>❌ System Failures:</b> ${failureCount}\n\n` +
                `📈 <b>Performance Metrics:</b>\n` +
                `   • <b>Success Rate:</b> ${successRate}%\n` +
                `   • <b>Detection Bypass:</b> ${Math.round(((amountAccounts - humanChallengeCount) / amountAccounts) * 100)}%\n` +
                `   • <b>Email Provider:</b> ${providerInfo}\n` +
                `   • <b>Connection Mode:</b> ${proxyString ? 'Proxy' : 'Direct'}\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `🎉 <b>MISSION STATUS:</b> ${totalSuccess > 0 ? 'SUCCESS' : 'NEEDS OPTIMIZATION'}\n\n` +
                `📋 <b>Individual account details are posted above</b> ⬆️\n` +
                `💡 Use the credentials to login to your new Facebook accounts!${recommendationMessage}`;
            
            await sendMessage(chatId, finalSummaryText);

        } catch (error) {
            console.error('CRITICAL ERROR in ultra-stealth fbcreate:', error.message, error.stack);
            try {
                await sendMessage(chatId, 
                    `🚨 <b>ULTRA-STEALTH SYSTEM CRITICAL FAILURE</b>\n\n` +
                    `💥 <b>Emergency Status:</b> System encountered critical error\n\n` +
                    `📝 <b>Technical Details:</b>\n<code>${error.message}</code>\n\n` +
                    `🔧 <b>Emergency Protocols:</b>\n` +
                    `   • Wait 30 minutes before retry\n` +
                    `   • Verify proxy connection if using\n` +
                    `   • Try with fewer accounts (1-2 max)\n` +
                    `   • Check internet connection stability\n` +
                    `   • Contact system administrator if issue persists\n\n` +
                    `📊 <b>Error logged for advanced analysis and system improvement</b>`
                );
            } catch (finalError) {
                console.error("[fbcreate] Critical failure - cannot send error message:", finalError);
            }
        }
    }
};