import { Actor } from 'apify';
import { PlaywrightCrawler, RequestQueue } from 'crawlee';
// routes.js - Request routing and handling
import { createPlaywrightRouter } from 'crawlee';

export const router = createPlaywrightRouter();

// Profile scraping handler
router.addHandler('profile', async ({ page, request, log }) => {
    const { username, maxPosts, includeStories, includeHighlights } = request.userData;
    
    try {
        // Wait for page to load and get initial data
        await page.waitForSelector('main', { timeout: 30000 });
        
        // Extract profile data from page
        const profileData = await page.evaluate(() => {
            // Look for JSON data in script tags
            const scripts = Array.from(document.querySelectorAll('script'));
            for (const script of scripts) {
                if (script.textContent?.includes('window._sharedData')) {
                    const match = script.textContent.match(/window\._sharedData\s*=\s*({.+?});/);
                    if (match) {
                        return JSON.parse(match[1]);
                    }
                }
            }
            return null;
        });
        
        if (!profileData) {
            throw new Error('Could not extract profile data');
        }
        
        const user = profileData.entry_data?.ProfilePage?.[0]?.graphql?.user;
        
        if (!user) {
            throw new Error('User data not found in page');
        }
        
        const result = {
            type: 'profile',
            username: user.username,
            fullName: user.full_name,
            biography: user.biography,
            followersCount: user.edge_followed_by?.count || 0,
            followingCount: user.edge_follow?.count || 0,
            postsCount: user.edge_owner_to_timeline_media?.count || 0,
            profilePicUrl: user.profile_pic_url_hd || user.profile_pic_url,
            isVerified: user.is_verified,
            isPrivate: user.is_private,
            externalUrl: user.external_url,
            businessCategory: user.business_category_name,
            scrapedAt: new Date().toISOString(),
        };
        
        // Add recent posts if requested
        if (maxPosts > 0 && user.edge_owner_to_timeline_media?.edges) {
            result.recentPosts = user.edge_owner_to_timeline_media.edges
                .slice(0, maxPosts)
                .map(edge => ({
                    id: edge.node.id,
                    shortcode: edge.node.shortcode,
                    url: `https://www.instagram.com/p/${edge.node.shortcode}/`,
                    caption: edge.node.edge_media_to_caption?.edges?.[0]?.node?.text || '',
                    likesCount: edge.node.edge_liked_by?.count || 0,
                    commentsCount: edge.node.edge_media_to_comment?.count || 0,
                    timestamp: new Date(edge.node.taken_at_timestamp * 1000).toISOString(),
                    mediaType: edge.node.__typename,
                    displayUrl: edge.node.display_url,
                }));
        }
        
        await Actor.pushData(result);
        log.info(`Profile data extracted for ${username}`);
        
    } catch (error) {
        log.error(`Error scraping profile ${username}: ${error.message}`);
        await Actor.pushData({
            type: 'error',
            username,
            error: error.message,
            scrapedAt: new Date().toISOString(),
        });
    }
});

// Posts scraping handler
router.addHandler('posts', async ({ page, request, log }) => {
    const { username, maxPosts, includeComments, includeMedia } = request.userData;
    
    try {
        await page.waitForSelector('main', { timeout: 30000 });
        
        // Scroll to load more posts
        let loadedPosts = 0;
        const posts = [];
        
        while (loadedPosts < maxPosts) {
            // Extract posts from current view
            const newPosts = await page.evaluate(() => {
                const articles = Array.from(document.querySelectorAll('article'));
                return articles.map(article => {
                    const timeElement = article.querySelector('time');
                    const linkElement = article.querySelector('a[href*="/p/"]');
                    const imgElement = article.querySelector('img');
                    const likesElement = article.querySelector('[aria-label*="like"]');
                    
                    return {
                        url: linkElement ? `https://www.instagram.com${linkElement.getAttribute('href')}` : null,
                        timestamp: timeElement ? timeElement.getAttribute('datetime') : null,
                        imageUrl: imgElement ? imgElement.src : null,
                        altText: imgElement ? imgElement.alt : null,
                        likes: likesElement ? likesElement.textContent : null,
                    };
                }).filter(post => post.url);
            });
            
            // Add new posts to collection
            for (const post of newPosts) {
                if (!posts.find(p => p.url === post.url)) {
                    posts.push({
                        ...post,
                        type: 'post',
                        username,
                        scrapedAt: new Date().toISOString(),
                    });
                    loadedPosts++;
                    
                    if (loadedPosts >= maxPosts) break;
                }
            }
            
            // Scroll down to load more
            if (loadedPosts < maxPosts) {
                await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                await page.waitForTimeout(2000);
            }
        }
        
        // Push posts data
        for (const post of posts) {
            await Actor.pushData(post);
        }
        
        log.info(`Extracted ${posts.length} posts for ${username}`);
        
    } catch (error) {
        log.error(`Error scraping posts for ${username}: ${error.message}`);
        await Actor.pushData({
            type: 'error',
            username,
            error: error.message,
            scrapedAt: new Date().toISOString(),
        });
    }
});

// Hashtag scraping handler
router.addHandler('hashtag', async ({ page, request, log }) => {
    const { hashtag, maxPosts, sortBy } = request.userData;
    
    try {
        await page.waitForSelector('main', { timeout: 30000 });
        
        // Extract hashtag stats and posts
        const hashtagData = await page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script'));
            for (const script of scripts) {
                if (script.textContent?.includes('window._sharedData')) {
                    const match = script.textContent.match(/window\._sharedData\s*=\s*({.+?});/);
                    if (match) {
                        return JSON.parse(match[1]);
                    }
                }
            }
            return null;
        });
        
        if (hashtagData?.entry_data?.TagPage?.[0]?.graphql?.hashtag) {
            const hashtagInfo = hashtagData.entry_data.TagPage[0].graphql.hashtag;
            
            const result = {
                type: 'hashtag',
                hashtag: `#${hashtag}`,
                name: hashtagInfo.name,
                mediaCount: hashtagInfo.edge_hashtag_to_media?.count || 0,
                scrapedAt: new Date().toISOString(),
                posts: [],
            };
            
            // Extract recent posts
            if (hashtagInfo.edge_hashtag_to_media?.edges) {
                result.posts = hashtagInfo.edge_hashtag_to_media.edges
                    .slice(0, maxPosts)
                    .map(edge => ({
                        id: edge.node.id,
                        shortcode: edge.node.shortcode,
                        url: `https://www.instagram.com/p/${edge.node.shortcode}/`,
                        caption: edge.node.edge_media_to_caption?.edges?.[0]?.node?.text || '',
                        likesCount: edge.node.edge_liked_by?.count || 0,
                        commentsCount: edge.node.edge_media_to_comment?.count || 0,
                        timestamp: new Date(edge.node.taken_at_timestamp * 1000).toISOString(),
                        displayUrl: edge.node.display_url,
                        owner: edge.node.owner?.username,
                    }));
            }
            
            await Actor.pushData(result);
            log.info(`Hashtag data extracted for #${hashtag} with ${result.posts.length} posts`);
        }
        
    } catch (error) {
        log.error(`Error scraping hashtag #${hashtag}: ${error.message}`);
        await Actor.pushData({
            type: 'error',
            hashtag: `#${hashtag}`,
            error: error.message,
            scrapedAt: new Date().toISOString(),
        });
    }
});

// Quick check handler (minimal data extraction)
router.addHandler('quickCheck', async ({ page, request, log }) => {
    const { username } = request.userData;
    
    try {
        await page.waitForSelector('main', { timeout: 30000 });
        
        const quickData = await page.evaluate(() => {
            // Extract basic visible data without complex parsing
            const followersText = document.querySelector('[href*="/followers/"]')?.textContent;
            const followingText = document.querySelector('[href*="/following/"]')?.textContent;
            const postsText = document.querySelector('main')?.textContent;
            
            return {
                followersVisible: followersText || '',
                followingVisible: followingText || '',
                hasContent: !!postsText,
                isLoaded: true,
            };
        });
        
        const result = {
            type: 'quickCheck',
            username,
            ...quickData,
            scrapedAt: new Date().toISOString(),
        };
        
        await Actor.pushData(result);
        log.info(`Quick check completed for ${username}`);
        
    } catch (error) {
        log.error(`Error in quick check for ${username}: ${error.message}`);
        await Actor.pushData({
            type: 'error',
            username,
            error: error.message,
            scrapedAt: new Date().toISOString(),
        });
    }
});

// Default handler for unmatched routes
router.addDefaultHandler(async ({ page, request, log }) => {
    const { scrapeType } = request.userData;
    
    try {
        await page.waitForSelector('body', { timeout: 30000 });
        
        const result = {
            type: scrapeType,
            url: request.url,
            status: 'completed',
            message: `Handler for ${scrapeType} executed successfully`,
            scrapedAt: new Date().toISOString(),
        };
        
        await Actor.pushData(result);
        log.info(`Default handler executed for ${scrapeType}`);
        
    } catch (error) {
        log.error(`Error in default handler: ${error.message}`);
        await Actor.pushData({
            type: 'error',
            scrapeType,
            url: request.url,
            error: error.message,
            scrapedAt: new Date().toISOString(),
        });
    }
});

// Initialize the Actor
await Actor.init();

// Get input from the Actor
const input = await Actor.getInput() ?? {};

// Validate required inputs
if (!input.scrapeType) {
    throw new Error('Scrape type is required. Please select a scraping mode.');
}

// Initialize data stores
const proxyConfiguration = await Actor.createProxyConfiguration({
    groups: ['RESIDENTIAL'],
    countryCode: 'US',
});

// Initialize request queue
const requestQueue = await RequestQueue.open();

// Setup the crawler with proper configuration
const crawler = new PlaywrightCrawler({
    proxyConfiguration,
    requestQueue,
    requestHandler: router,
    maxRequestsPerCrawl: input.maxItems || 1000,
    maxRequestRetries: 3,
    requestHandlerTimeoutSecs: 60,
    sessionPoolOptions: {
        maxPoolSize: 100,
        sessionOptions: {
            maxUsageCount: 50,
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
            ],
        },
    },
    failedRequestHandler: async ({ request, error }) => {
        await Actor.pushData({
            error: `Request failed: ${error.message}`,
            url: request.url,
            userData: request.userData,
        });
    },
});

// Generate requests based on scrape type
const generateRequests = async () => {
    const { scrapeType } = input;
    
    switch (scrapeType) {
        case 'profile': {
            if (!input.usernames?.length) {
                throw new Error('Usernames are required for profile scraping');
            }
            
            for (const username of input.usernames) {
                await requestQueue.addRequest({
                    url: `https://www.instagram.com/${username}/`,
                    userData: {
                        scrapeType: 'profile',
                        username: username.replace('@', ''),
                        maxPosts: input.maxPosts || 50,
                        includeStories: input.includeStories || false,
                        includeHighlights: input.includeHighlights || false,
                    },
                });
            }
            break;
        }
        
        case 'posts': {
            if (!input.usernames?.length) {
                throw new Error('Usernames are required for post scraping');
            }
            
            for (const username of input.usernames) {
                await requestQueue.addRequest({
                    url: `https://www.instagram.com/${username}/`,
                    userData: {
                        scrapeType: 'posts',
                        username: username.replace('@', ''),
                        maxPosts: input.maxPosts || 50,
                        includeComments: input.includeComments || false,
                        includeMedia: input.includeMedia || true,
                    },
                });
            }
            break;
        }
        
        case 'hashtag': {
            if (!input.hashtags?.length) {
                throw new Error('Hashtags are required for hashtag scraping');
            }
            
            for (const hashtag of input.hashtags) {
                await requestQueue.addRequest({
                    url: `https://www.instagram.com/explore/tags/${hashtag.replace('#', '')}/`,
                    userData: {
                        scrapeType: 'hashtag',
                        hashtag: hashtag.replace('#', ''),
                        maxPosts: input.maxPosts || 100,
                        sortBy: input.sortBy || 'recent',
                    },
                });
            }
            break;
        }
        
        case 'reels': {
            if (!input.usernames?.length) {
                throw new Error('Usernames are required for reels scraping');
            }
            
            for (const username of input.usernames) {
                await requestQueue.addRequest({
                    url: `https://www.instagram.com/${username}/reels/`,
                    userData: {
                        scrapeType: 'reels',
                        username: username.replace('@', ''),
                        maxReels: input.maxReels || 50,
                        includeComments: input.includeComments || false,
                    },
                });
            }
            break;
        }
        
        case 'comments': {
            if (!input.postUrls?.length) {
                throw new Error('Post URLs are required for comment scraping');
            }
            
            for (const postUrl of input.postUrls) {
                await requestQueue.addRequest({
                    url: postUrl,
                    userData: {
                        scrapeType: 'comments',
                        maxComments: input.maxComments || 100,
                        includeReplies: input.includeReplies || false,
                    },
                });
            }
            break;
        }
        
        case 'followers': {
            if (!input.usernames?.length) {
                throw new Error('Usernames are required for follower scraping');
            }
            
            for (const username of input.usernames) {
                await requestQueue.addRequest({
                    url: `https://www.instagram.com/${username}/followers/`,
                    userData: {
                        scrapeType: 'followers',
                        username: username.replace('@', ''),
                        maxFollowers: input.maxFollowers || 1000,
                        includeFollowerDetails: input.includeFollowerDetails || false,
                    },
                });
            }
            break;
        }
        
        case 'mentions': {
            if (!input.searchTerms?.length) {
                throw new Error('Search terms are required for mention scraping');
            }
            
            for (const term of input.searchTerms) {
                await requestQueue.addRequest({
                    url: `https://www.instagram.com/web/search/topsearch/?query=${encodeURIComponent(term)}`,
                    userData: {
                        scrapeType: 'mentions',
                        searchTerm: term,
                        maxResults: input.maxResults || 100,
                    },
                });
            }
            break;
        }
        
        case 'quickCheck': {
            if (!input.usernames?.length) {
                throw new Error('Usernames are required for quick check');
            }
            
            for (const username of input.usernames) {
                await requestQueue.addRequest({
                    url: `https://www.instagram.com/${username}/`,
                    userData: {
                        scrapeType: 'quickCheck',
                        username: username.replace('@', ''),
                    },
                });
            }
            break;
        }
        
        case 'hashtagStats': {
            if (!input.hashtags?.length) {
                throw new Error('Hashtags are required for hashtag stats');
            }
            
            for (const hashtag of input.hashtags) {
                await requestQueue.addRequest({
                    url: `https://www.instagram.com/explore/tags/${hashtag.replace('#', '')}/`,
                    userData: {
                        scrapeType: 'hashtagStats',
                        hashtag: hashtag.replace('#', ''),
                    },
                });
            }
            break;
        }
        
        default:
            throw new Error(`Unknown scrape type: ${scrapeType}`);
    }
};

// Generate and enqueue requests
await generateRequests();

// Log the start of the crawl
console.log(`Starting ${input.scrapeType} scraping...`);
await Actor.setValue('SCRAPE_TYPE', input.scrapeType);

// Run the crawler
await crawler.run();

// Log completion
console.log(`${input.scrapeType} scraping completed successfully!`);

// Exit the Actor
await Actor.exit();