// main.js - Instagram Multi-Scraper Apify Actor
const Apify = require('apify');
const { PlaywrightCrawler } = require('@crawlee/playwright');

// Utility functions
const utils = {
    // Wait for random time to avoid detection
    randomWait: (min = 1000, max = 3000) => 
        new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min)),
    
    // Clean Instagram URL
    cleanInstagramUrl: (url) => {
        if (!url.includes('instagram.com')) {
            return `https://www.instagram.com/${url.replace('@', '')}/`;
        }
        return url;
    },
    
    // Extract username from URL
    extractUsername: (url) => {
        const match = url.match(/instagram\.com\/([^\/\?]+)/);
        return match ? match[1] : null;
    },
    
    // Wait for element with retry
    waitForElement: async (page, selector, timeout = 10000) => {
        try {
            await page.waitForSelector(selector, { timeout });
            return true;
        } catch (error) {
            console.log(`Element ${selector} not found within ${timeout}ms`);
            return false;
        }
    }
};

// Instagram scrapers
const scrapers = {
    // Profile Scraper
    async scrapeProfile(page, username) {
        console.log(`Scraping profile: ${username}`);
        
        const profileUrl = `https://www.instagram.com/${username}/`;
        await page.goto(profileUrl, { waitUntil: 'networkidle' });
        await utils.randomWait();
        
        // Wait for profile data to load
        await utils.waitForElement(page, 'header section');
        
        const profileData = await page.evaluate(() => {
            const getTextContent = (selector) => {
                const element = document.querySelector(selector);
                return element ? element.textContent.trim() : '';
            };
            
            const getMetaContent = (property) => {
                const meta = document.querySelector(`meta[property="${property}"]`);
                return meta ? meta.getAttribute('content') : '';
            };
            
            // Extract follower/following counts
            const statsElements = document.querySelectorAll('header section ul li');
            let posts = 0, followers = 0, following = 0;
            
            statsElements.forEach((li, index) => {
                const text = li.textContent.trim();
                const number = parseInt(text.replace(/[,\s]/g, '').match(/\d+/)?.[0] || '0');
                
                if (index === 0) posts = number;
                else if (index === 1) followers = number;
                else if (index === 2) following = number;
            });
            
            return {
                username: window.location.pathname.split('/')[1],
                displayName: getTextContent('header section h2') || getTextContent('header section h1'),
                bio: getTextContent('header section div span') || getMetaContent('og:description'),
                posts,
                followers,
                following,
                isVerified: !!document.querySelector('header section svg[title*="Verified"]'),
                isPrivate: !!document.querySelector('article h2'),
                profilePicture: getMetaContent('og:image'),
                externalUrl: getTextContent('header section a[href^="http"]'),
                category: getTextContent('header section div:last-child span')
            };
        });
        
        return profileData;
    },
    
    // Reel Scraper
    async scrapeReels(page, username, limit = 12) {
        console.log(`Scraping reels for: ${username}`);
        
        const reelsUrl = `https://www.instagram.com/${username}/reels/`;
        await page.goto(reelsUrl, { waitUntil: 'networkidle' });
        await utils.randomWait();
        
        const reels = [];
        let scrollAttempts = 0;
        const maxScrollAttempts = Math.ceil(limit / 12);
        
        while (reels.length < limit && scrollAttempts < maxScrollAttempts) {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await utils.randomWait(2000, 4000);
            
            const newReels = await page.evaluate(() => {
                const reelElements = document.querySelectorAll('article div div div a[href*="/reel/"]');
                return Array.from(reelElements).map(link => {
                    const img = link.querySelector('img');
                    const videoIcon = link.querySelector('svg');
                    
                    return {
                        url: link.href,
                        thumbnail: img ? img.src : '',
                        shortcode: link.href.split('/reel/')[1]?.split('/')[0],
                        isVideo: !!videoIcon
                    };
                });
            });
            
            // Merge new reels, avoiding duplicates
            newReels.forEach(reel => {
                if (!reels.find(r => r.shortcode === reel.shortcode)) {
                    reels.push(reel);
                }
            });
            
            scrollAttempts++;
        }
        
        return reels.slice(0, limit);
    },
    
    // Hashtag Scraper
    async scrapeHashtag(page, hashtag, limit = 20) {
        console.log(`Scraping hashtag: #${hashtag}`);
        
        const hashtagUrl = `https://www.instagram.com/explore/tags/${hashtag}/`;
        await page.goto(hashtagUrl, { waitUntil: 'networkidle' });
        await utils.randomWait();
        
        // Get hashtag stats
        const hashtagStats = await page.evaluate(() => {
            const statsText = document.querySelector('header div span')?.textContent || '';
            const postsCount = parseInt(statsText.replace(/[,\s]/g, '').match(/\d+/)?.[0] || '0');
            
            return {
                hashtag: window.location.pathname.split('/tags/')[1]?.split('/')[0],
                postsCount,
                description: document.querySelector('header div div span')?.textContent || ''
            };
        });
        
        const posts = [];
        let scrollAttempts = 0;
        const maxScrollAttempts = Math.ceil(limit / 12);
        
        while (posts.length < limit && scrollAttempts < maxScrollAttempts) {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await utils.randomWait(2000, 4000);
            
            const newPosts = await page.evaluate(() => {
                const postElements = document.querySelectorAll('article div div div a[href*="/p/"], article div div div a[href*="/reel/"]');
                return Array.from(postElements).map(link => {
                    const img = link.querySelector('img');
                    const isReel = link.href.includes('/reel/');
                    
                    return {
                        url: link.href,
                        thumbnail: img ? img.src : '',
                        shortcode: link.href.split(isReel ? '/reel/' : '/p/')[1]?.split('/')[0],
                        type: isReel ? 'reel' : 'post'
                    };
                });
            });
            
            newPosts.forEach(post => {
                if (!posts.find(p => p.shortcode === post.shortcode)) {
                    posts.push(post);
                }
            });
            
            scrollAttempts++;
        }
        
        return {
            ...hashtagStats,
            posts: posts.slice(0, limit)
        };
    },
    
    // Post Scraper
    async scrapePost(page, postUrl) {
        console.log(`Scraping post: ${postUrl}`);
        
        await page.goto(postUrl, { waitUntil: 'networkidle' });
        await utils.randomWait();
        
        const postData = await page.evaluate(() => {
            const getTextContent = (selector) => {
                const element = document.querySelector(selector);
                return element ? element.textContent.trim() : '';
            };
            
            const getMetaContent = (property) => {
                const meta = document.querySelector(`meta[property="${property}"]`);
                return meta ? meta.getAttribute('content') : '';
            };
            
            // Extract post details
            const captionElement = document.querySelector('article div div div div span[dir="auto"]');
            const caption = captionElement ? captionElement.textContent : getMetaContent('og:description');
            
            // Extract hashtags from caption
            const hashtags = (caption.match(/#[\w]+/g) || []).map(tag => tag.slice(1));
            
            // Extract mentions from caption
            const mentions = (caption.match(/@[\w.]+/g) || []).map(mention => mention.slice(1));
            
            // Get engagement metrics
            const likesElement = document.querySelector('section span[role="button"] span');
            const likes = likesElement ? parseInt(likesElement.textContent.replace(/[,\s]/g, '')) : 0;
            
            return {
                shortcode: window.location.pathname.split('/p/')[1]?.split('/')[0] || 
                          window.location.pathname.split('/reel/')[1]?.split('/')[0],
                caption,
                hashtags,
                mentions,
                likes,
                author: document.querySelector('header a')?.textContent || '',
                timestamp: document.querySelector('time')?.getAttribute('datetime') || '',
                images: Array.from(document.querySelectorAll('article img')).map(img => img.src),
                isVideo: !!document.querySelector('video'),
                location: getTextContent('header div div a') || null
            };
        });
        
        return postData;
    },
    
    // Comments Scraper
    async scrapeComments(page, postUrl, limit = 50) {
        console.log(`Scraping comments for: ${postUrl}`);
        
        await page.goto(postUrl, { waitUntil: 'networkidle' });
        await utils.randomWait();
        
        // Click "View all comments" if available
        const viewAllButton = await page.$('button span:has-text("View all")');
        if (viewAllButton) {
            await viewAllButton.click();
            await utils.randomWait();
        }
        
        const comments = [];
        let scrollAttempts = 0;
        const maxScrollAttempts = Math.ceil(limit / 20);
        
        while (comments.length < limit && scrollAttempts < maxScrollAttempts) {
            const newComments = await page.evaluate(() => {
                const commentElements = document.querySelectorAll('article div div div div div ul li');
                return Array.from(commentElements).map(li => {
                    const usernameElement = li.querySelector('a[role="link"]');
                    const commentElement = li.querySelector('span[dir="auto"]');
                    const timeElement = li.querySelector('time');
                    const likesElement = li.querySelector('button span');
                    
                    return {
                        username: usernameElement ? usernameElement.textContent : '',
                        comment: commentElement ? commentElement.textContent : '',
                        timestamp: timeElement ? timeElement.getAttribute('datetime') : '',
                        likes: likesElement ? parseInt(likesElement.textContent.replace(/\D/g, '')) || 0 : 0
                    };
                }).filter(comment => comment.username && comment.comment);
            });
            
            newComments.forEach(comment => {
                if (!comments.find(c => c.username === comment.username && c.comment === comment.comment)) {
                    comments.push(comment);
                }
            });
            
            // Scroll to load more comments
            await page.evaluate(() => {
                const commentsSection = document.querySelector('article div div div div div ul');
                if (commentsSection) {
                    commentsSection.scrollTop = commentsSection.scrollHeight;
                }
            });
            
            await utils.randomWait(2000, 3000);
            scrollAttempts++;
        }
        
        return comments.slice(0, limit);
    },
    
    // Followers Count Scraper (Quick check)
    async scrapeFollowersCount(page, usernames) {
        console.log(`Scraping followers count for multiple users`);
        
        const results = [];
        
        for (const username of usernames) {
            try {
                const profileUrl = `https://www.instagram.com/${username}/`;
                await page.goto(profileUrl, { waitUntil: 'networkidle' });
                await utils.randomWait(1000, 2000);
                
                const data = await page.evaluate(() => {
                    const statsElements = document.querySelectorAll('header section ul li');
                    let followers = 0;
                    
                    if (statsElements.length >= 2) {
                        const followersText = statsElements[1].textContent.trim();
                        const numberMatch = followersText.match(/[\d,]+/);
                        if (numberMatch) {
                            followers = parseInt(numberMatch[0].replace(/,/g, ''));
                        }
                    }
                    
                    return {
                        username: window.location.pathname.split('/')[1],
                        followers,
                        isPrivate: !!document.querySelector('article h2'),
                        timestamp: new Date().toISOString()
                    };
                });
                
                results.push(data);
            } catch (error) {
                console.log(`Error scraping ${username}:`, error.message);
                results.push({
                    username,
                    followers: null,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        }
        
        return results;
    }
};

// Main actor function
Apify.main(async () => {
    const input = await Apify.getInput();
    console.log('Input:', input);
    
    const {
        scraperType,
        profileUrl,
        hashtag,
        postUrl,
        usernames,
        limit = 20,
        proxyConfiguration
    } = input;
    
    // Initialize dataset
    const dataset = await Apify.openDataset();
    
    // Setup proxy configuration
    const proxyConfig = await Apify.createProxyConfiguration(proxyConfiguration);
    
    // Create crawler
    const crawler = new PlaywrightCrawler({
        proxyConfiguration: proxyConfig,
        headless: true,
        launchOptions: {
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        },
        browserPoolOptions: {
            useFingerprints: true,
        },
        requestHandler: async ({ page, request }) => {
            console.log(`Processing: ${request.url}`);
            
            // Set user agent and headers
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            });
            
            let results = [];
            
            try {
                switch (scraperType) {
                    case 'profile':
                        const username = utils.extractUsername(profileUrl);
                        if (username) {
                            const profileData = await scrapers.scrapeProfile(page, username);
                            results.push(profileData);
                        }
                        break;
                        
                    case 'reels':
                        const reelsUsername = utils.extractUsername(profileUrl);
                        if (reelsUsername) {
                            const reelsData = await scrapers.scrapeReels(page, reelsUsername, limit);
                            results = reelsData;
                        }
                        break;
                        
                    case 'hashtag':
                        const hashtagData = await scrapers.scrapeHashtag(page, hashtag, limit);
                        results.push(hashtagData);
                        break;
                        
                    case 'post':
                        const postData = await scrapers.scrapePost(page, postUrl);
                        results.push(postData);
                        break;
                        
                    case 'comments':
                        const commentsData = await scrapers.scrapeComments(page, postUrl, limit);
                        results = commentsData;
                        break;
                        
                    case 'followers-count':
                        const followersData = await scrapers.scrapeFollowersCount(page, usernames);
                        results = followersData;
                        break;
                        
                    case 'mentions':
                        // Search for mentions using hashtag scraper with mention query
                        const mentionQuery = profileUrl.replace('@', '');
                        const mentionsData = await scrapers.scrapeHashtag(page, mentionQuery, limit);
                        results.push(mentionsData);
                        break;
                        
                    case 'hashtag-stats':
                        const statsData = await scrapers.scrapeHashtag(page, hashtag, 1);
                        results.push({
                            hashtag: statsData.hashtag,
                            postsCount: statsData.postsCount,
                            description: statsData.description,
                            timestamp: new Date().toISOString()
                        });
                        break;
                        
                    case 'quick-posts':
                        const quickUsername = utils.extractUsername(profileUrl);
                        if (quickUsername) {
                            const quickReels = await scrapers.scrapeReels(page, quickUsername, limit);
                            results = quickReels;
                        }
                        break;
                        
                    default:
                        throw new Error(`Unknown scraper type: ${scraperType}`);
                }
                
                // Save results to dataset
                if (results.length > 0) {
                    if (Array.isArray(results)) {
                        for (const result of results) {
                            await dataset.pushData({
                                ...result,
                                scraperType,
                                scrapedAt: new Date().toISOString()
                            });
                        }
                    } else {
                        await dataset.pushData({
                            ...results,
                            scraperType,
                            scrapedAt: new Date().toISOString()
                        });
                    }
                }
                
                console.log(`Successfully scraped ${results.length} items with ${scraperType} scraper`);
                
            } catch (error) {
                console.error(`Error in ${scraperType} scraper:`, error);
                await dataset.pushData({
                    error: error.message,
                    scraperType,
                    input: request.url,
                    scrapedAt: new Date().toISOString()
                });
            }
        },
        
        failedRequestHandler: async ({ request, error }) => {
            console.error(`Request ${request.url} failed:`, error);
        },
        
        maxRequestsPerCrawl: 1,
        requestHandlerTimeoutSecs: 300,
    });
    
    // Add the initial request
    await crawler.addRequests([{
        url: 'https://www.instagram.com/',
        userData: { scraperType }
    }]);
    
    // Run the crawler
    await crawler.run();
    
    console.log('Crawler finished.');
});