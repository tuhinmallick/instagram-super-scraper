// main.js - Multi-Purpose Instagram Scraper Actor
import { Actor } from 'apify';
import { PlaywrightCrawler, Dataset } from 'crawlee';

// Initialize the Actor
await Actor.init();

// Get input from the Actor
const input = await Actor.getInput() ?? {};

// Validate required inputs
if (!input.scrapeType) {
    throw new Error('Scrape type is required. Please select a scraping mode.');
}

console.log('Instagram Scraper started with configuration:', {
    scrapeType: input.scrapeType,
    maxItems: input.maxItems || 1000
});

// Initialize proxy configuration
const proxyConfiguration = await Actor.createProxyConfiguration({
    groups: ['RESIDENTIAL'],
    countryCode: 'US',
});

// Initialize dataset
const dataset = await Dataset.open();

// Setup the crawler with proper configuration
const crawler = new PlaywrightCrawler({
    proxyConfiguration,
    maxRequestsPerCrawl: input.maxItems || 1000,
    maxRequestRetries: 3,
    requestHandlerTimeoutSecs: 120,
    sessionPoolOptions: {
        maxPoolSize: 50,
        sessionOptions: {
            maxUsageCount: 30,
        },
    },
    launchContext: {
        launchOptions: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ],
        },
    },
    
    requestHandler: async ({ page, request, log }) => {
        const { scrapeType } = request.userData;
        
        try {
            await page.setViewportSize({ width: 1920, height: 1080 });
            await page.goto(request.url, { waitUntil: 'networkidle', timeout: 60000 });
            
            // Wait for main content
            await page.waitForSelector('main', { timeout: 30000 });
            
            if (scrapeType === 'profile') {
                await handleProfileScraping(page, request, log);
            } else if (scrapeType === 'posts') {
                await handlePostsScraping(page, request, log);
            } else if (scrapeType === 'hashtag') {
                await handleHashtagScraping(page, request, log);
            } else if (scrapeType === 'reels') {
                await handleReelsScraping(page, request, log);
            } else if (scrapeType === 'comments') {
                await handleCommentsScraping(page, request, log);
            } else if (scrapeType === 'followers') {
                await handleFollowersScraping(page, request, log);
            } else if (scrapeType === 'mentions') {
                await handleMentionsScraping(page, request, log);
            } else if (scrapeType === 'quickCheck') {
                await handleQuickCheck(page, request, log);
            } else if (scrapeType === 'hashtagStats') {
                await handleHashtagStats(page, request, log);
            }
            
        } catch (error) {
            log.error(`Error processing ${request.url}: ${error.message}`);
            await dataset.pushData({
                type: 'error',
                url: request.url,
                scrapeType: request.userData.scrapeType,
                error: error.message,
                timestamp: new Date().toISOString(),
            });
        }
    },
    
    failedRequestHandler: async ({ request, error, log }) => {
        log.error(`Request failed: ${error.message}`);
        await dataset.pushData({
            type: 'failed_request',
            url: request.url,
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    },
});

// Profile scraping handler
async function handleProfileScraping(page, request, log) {
    const { username, maxPosts } = request.userData;
    
    try {
        // Extract profile data using Instagram's public API endpoints
        const profileData = await page.evaluate(() => {
            const scripts = document.querySelectorAll('script[type="application/json"]');
            for (const script of scripts) {
                try {
                    const data = JSON.parse(script.textContent);
                    if (data?.require) {
                        // Look for user data in the complex structure
                        const stringified = JSON.stringify(data);
                        if (stringified.includes('edge_followed_by')) {
                            return data;
                        }
                    }
                } catch (e) {
                    continue;
                }
            }
            return null;
        });
        
        if (profileData) {
            // Extract user information from the complex data structure
            const userMatch = JSON.stringify(profileData).match(/"username":"([^"]+)".*?"edge_followed_by":{"count":(\d+)}.*?"edge_follow":{"count":(\d+)}.*?"full_name":"([^"]*)".*?"biography":"([^"]*)".*?"profile_pic_url":"([^"]+)"/);
            
            if (userMatch) {
                const result = {
                    type: 'profile',
                    username: userMatch[1],
                    fullName: userMatch[4],
                    biography: userMatch[5],
                    followersCount: parseInt(userMatch[2]),
                    followingCount: parseInt(userMatch[3]),
                    profilePicUrl: userMatch[6],
                    timestamp: new Date().toISOString(),
                    url: request.url
                };
                
                await dataset.pushData(result);
                log.info(`Profile data extracted for ${username}`);
                return;
            }
        }
        
        // Fallback: Extract visible data
        const fallbackData = await page.evaluate(() => {
            const profileName = document.querySelector('h2')?.textContent?.trim();
            const bio = document.querySelector('div[data-testid="user-bio"]')?.textContent?.trim();
            const followersText = Array.from(document.querySelectorAll('a')).find(a => a.href?.includes('/followers/'))?.textContent;
            const followingText = Array.from(document.querySelectorAll('a')).find(a => a.href?.includes('/following/'))?.textContent;
            
            return {
                profileName,
                bio,
                followersText,
                followingText,
                isLoaded: true
            };
        });
        
        const result = {
            type: 'profile',
            username,
            fullName: fallbackData.profileName || '',
            biography: fallbackData.bio || '',
            followersText: fallbackData.followersText || '',
            followingText: fallbackData.followingText || '',
            timestamp: new Date().toISOString(),
            url: request.url
        };
        
        await dataset.pushData(result);
        log.info(`Fallback profile data extracted for ${username}`);
        
    } catch (error) {
        log.error(`Error in profile scraping: ${error.message}`);
        throw error;
    }
}

// Posts scraping handler
async function handlePostsScraping(page, request, log) {
    const { username, maxPosts } = request.userData;
    
    try {
        const posts = [];
        let scrollAttempts = 0;
        const maxScrolls = Math.ceil(maxPosts / 12); // Instagram typically shows 12 posts per load
        
        while (posts.length < maxPosts && scrollAttempts < maxScrolls) {
            // Extract posts from current view
            const newPosts = await page.evaluate(() => {
                const postLinks = Array.from(document.querySelectorAll('a[href*="/p/"]'));
                return postLinks.map(link => {
                    const img = link.querySelector('img');
                    const href = link.getAttribute('href');
                    
                    return {
                        url: `https://www.instagram.com${href}`,
                        shortcode: href?.split('/p/')?.[1]?.split('/')?.[0],
                        imageUrl: img?.src,
                        altText: img?.alt
                    };
                }).filter(post => post.url && post.shortcode);
            });
            
            // Add unique posts
            for (const post of newPosts) {
                if (!posts.find(p => p.shortcode === post.shortcode) && posts.length < maxPosts) {
                    posts.push({
                        type: 'post',
                        username,
                        ...post,
                        timestamp: new Date().toISOString()
                    });
                }
            }
            
            // Scroll to load more posts
            if (posts.length < maxPosts) {
                await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                await page.waitForTimeout(2000);
                scrollAttempts++;
            }
        }
        
        // Push all posts to dataset
        for (const post of posts) {
            await dataset.pushData(post);
        }
        
        log.info(`Extracted ${posts.length} posts for ${username}`);
        
    } catch (error) {
        log.error(`Error in posts scraping: ${error.message}`);
        throw error;
    }
}

// Quick check handler
async function handleQuickCheck(page, request, log) {
    const { username } = request.userData;
    
    try {
        const quickData = await page.evaluate(() => {
            const title = document.title;
            const hasContent = !!document.querySelector('main');
            const followersElement = document.querySelector('a[href*="/followers/"]');
            const followingElement = document.querySelector('a[href*="/following/"]');
            const postsCount = document.querySelectorAll('a[href*="/p/"]').length;
            
            return {
                title,
                hasContent,
                followersText: followersElement?.textContent || '',
                followingText: followingElement?.textContent || '',
                visiblePosts: postsCount,
                isAccessible: !title.includes('not found') && !title.includes('error')
            };
        });
        
        const result = {
            type: 'quickCheck',
            username,
            ...quickData,
            timestamp: new Date().toISOString(),
            url: request.url
        };
        
        await dataset.pushData(result);
        log.info(`Quick check completed for ${username}`);
        
    } catch (error) {
        log.error(`Error in quick check: ${error.message}`);
        throw error;
    }
}

// Hashtag scraping handler
async function handleHashtagScraping(page, request, log) {
    const { hashtag, maxPosts } = request.userData;
    
    try {
        await page.waitForTimeout(3000);
        
        const hashtagData = await page.evaluate(() => {
            const posts = Array.from(document.querySelectorAll('a[href*="/p/"]')).map(link => {
                const img = link.querySelector('img');
                const href = link.getAttribute('href');
                
                return {
                    url: `https://www.instagram.com${href}`,
                    shortcode: href?.split('/p/')?.[1]?.split('/')?.[0],
                    imageUrl: img?.src,
                    altText: img?.alt
                };
            }).filter(post => post.url);
            
            return {
                postsFound: posts.length,
                posts: posts.slice(0, 50) // Limit initial extraction
            };
        });
        
        const result = {
            type: 'hashtag',
            hashtag: `#${hashtag}`,
            postsCount: hashtagData.postsFound,
            posts: hashtagData.posts.map(post => ({
                ...post,
                hashtag: `#${hashtag}`,
                timestamp: new Date().toISOString()
            })),
            timestamp: new Date().toISOString(),
            url: request.url
        };
        
        await dataset.pushData(result);
        log.info(`Hashtag data extracted for #${hashtag} with ${hashtagData.posts.length} posts`);
        
    } catch (error) {
        log.error(`Error in hashtag scraping: ${error.message}`);
        throw error;
    }
}

// Placeholder handlers for other scrape types
async function handleReelsScraping(page, request, log) {
    const { username } = request.userData;
    log.info(`Reels scraping for ${username} - feature in development`);
    await dataset.pushData({
        type: 'reels',
        username,
        message: 'Reels scraping in development',
        timestamp: new Date().toISOString()
    });
}

async function handleCommentsScraping(page, request, log) {
    log.info(`Comments scraping - feature in development`);
    await dataset.pushData({
        type: 'comments',
        message: 'Comments scraping in development',
        timestamp: new Date().toISOString()
    });
}

async function handleFollowersScraping(page, request, log) {
    const { username } = request.userData;
    log.info(`Followers scraping for ${username} - feature in development`);
    await dataset.pushData({
        type: 'followers',
        username,
        message: 'Followers scraping in development',
        timestamp: new Date().toISOString()
    });
}

async function handleMentionsScraping(page, request, log) {
    log.info(`Mentions scraping - feature in development`);
    await dataset.pushData({
        type: 'mentions',
        message: 'Mentions scraping in development',
        timestamp: new Date().toISOString()
    });
}

async function handleHashtagStats(page, request, log) {
    const { hashtag } = request.userData;
    log.info(`Hashtag stats for ${hashtag} - feature in development`);
    await dataset.pushData({
        type: 'hashtagStats',
        hashtag,
        message: 'Hashtag stats in development',
        timestamp: new Date().toISOString()
    });
}

// Generate requests based on scrape type
const generateRequests = async () => {
    const { scrapeType } = input;
    const requests = [];
    
    switch (scrapeType) {
        case 'profile':
        case 'posts':
        case 'reels':
        case 'followers':
        case 'quickCheck':
            if (!input.usernames?.length) {
                throw new Error('Usernames are required for this scraping mode');
            }
            
            for (const username of input.usernames) {
                const cleanUsername = username.replace('@', '').trim();
                if (cleanUsername) {
                    requests.push({
                        url: `https://www.instagram.com/${cleanUsername}/`,
                        userData: {
                            scrapeType,
                            username: cleanUsername,
                            maxPosts: input.maxPosts || 50,
                            maxReels: input.maxReels || 50,
                            maxFollowers: input.maxFollowers || 1000,
                            includeComments: input.includeComments || false,
                            includeMedia: input.includeMedia || true,
                        },
                    });
                }
            }
            break;
            
        case 'hashtag':
        case 'hashtagStats':
            if (!input.hashtags?.length) {
                throw new Error('Hashtags are required for this scraping mode');
            }
            
            for (const hashtag of input.hashtags) {
                const cleanHashtag = hashtag.replace('#', '').trim();
                if (cleanHashtag) {
                    requests.push({
                        url: `https://www.instagram.com/explore/tags/${cleanHashtag}/`,
                        userData: {
                            scrapeType,
                            hashtag: cleanHashtag,
                            maxPosts: input.maxPosts || 100,
                        },
                    });
                }
            }
            break;
            
        case 'comments':
            if (!input.postUrls?.length) {
                throw new Error('Post URLs are required for comment scraping');
            }
            
            for (const postUrl of input.postUrls) {
                if (postUrl.includes('instagram.com/p/')) {
                    requests.push({
                        url: postUrl,
                        userData: {
                            scrapeType: 'comments',
                            maxComments: input.maxComments || 100,
                        },
                    });
                }
            }
            break;
            
        case 'mentions':
            if (!input.searchTerms?.length) {
                throw new Error('Search terms are required for mention scraping');
            }
            
            for (const term of input.searchTerms) {
                requests.push({
                    url: `https://www.instagram.com/web/search/topsearch/?query=${encodeURIComponent(term)}`,
                    userData: {
                        scrapeType: 'mentions',
                        searchTerm: term,
                        maxResults: input.maxResults || 100,
                    },
                });
            }
            break;
            
        default:
            throw new Error(`Unknown scrape type: ${scrapeType}`);
    }
    
    return requests;
};

// Generate and add requests to crawler
const requests = await generateRequests();
console.log(`Generated ${requests.length} requests for ${input.scrapeType} scraping`);

// Add requests to crawler
await crawler.addRequests(requests);

// Log the start of the crawl
console.log(`Starting ${input.scrapeType} scraping...`);
await Actor.setValue('SCRAPE_TYPE', input.scrapeType);
await Actor.setValue('TOTAL_REQUESTS', requests.length);

// Run the crawler
await crawler.run();

// Get final stats
const stats = await dataset.getInfo();
console.log(`Scraping completed! Extracted ${stats.itemCount} items`);

// Save final summary
await Actor.setValue('FINAL_STATS', {
    scrapeType: input.scrapeType,
    totalRequests: requests.length,
    itemsExtracted: stats.itemCount,
    completedAt: new Date().toISOString()
});

// Exit the Actor
await Actor.exit();