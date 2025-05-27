# 🔥 Instagram Multi-Purpose Scraper

A comprehensive Instagram scraper supporting multiple data extraction modes. Built with Apify and Crawlee for reliable, scalable Instagram data collection.

## ✨ Features

- **👤 Profile Scraper**: Extract complete profile information including followers, posts, bio, and recent content
- **📷 Post Scraper**: Collect posts from specific users with engagement metrics
- **#️⃣ Hashtag Scraper**: Discover posts and stats for any hashtag
- **🎞️ Reel Scraper**: Extract Instagram reels content and metadata  
- **💬 Comments Scraper**: Gather comments from specific posts
- **👥 Followers Count Scraper**: Track follower/following counts
- **🏷️ Mentions Scraper**: Find mentions of your brand or keywords
- **✅ Quick Posts Checker**: Fast overview of account activity
- **📊 Hashtag Stats**: Analyze hashtag performance metrics

## 🚀 Quick Start

1. **Select a scraping mode** from the dropdown
2. **Enter your targets** (usernames, hashtags, or URLs depending on mode)
3. **Configure limits** (max posts, comments, etc.)
4. **Click Start** and wait for results

### Example: Profile Scraping
```json
{
  "scrapeType": "profile",
  "usernames": ["google", "instagram"],
  "maxPosts": 20,
  "includeMedia": true
}
```

### Example: Hashtag Analysis
```json
{
  "scrapeType": "hashtag",
  "hashtags": ["travel", "photography"],
  "maxPosts": 100,
  "sortBy": "recent"
}
```

## 📊 Output Data

### Profile Data
```json
{
  "type": "profile",
  "username": "example_user",
  "fullName": "Example User",
  "biography": "This is a bio...",
  "followersCount": 1500,
  "followingCount": 800,
  "postsCount": 250,
  "profilePicUrl": "https://...",
  "isVerified": false,
  "isPrivate": false,
  "recentPosts": [...],
  "scrapedAt": "2025-01-15T10:30:00Z"
}
```

### Post Data
```json
{
  "type": "post",
  "id": "post_id",
  "shortcode": "ABC123",
  "url": "https://instagram.com/p/ABC123/",
  "caption": "Post caption text...",
  "likesCount": 150,
  "commentsCount": 25,
  "timestamp": "2025-01-15T08:00:00Z",
  "mediaType": "GraphImage",
  "displayUrl": "https://...",
  "owner": "username"
}
```

### Hashtag Data
```json
{
  "type": "hashtag",
  "hashtag": "#travel",
  "name": "travel",
  "mediaCount": 500000000,
  "posts": [...],
  "scrapedAt": "2025-01-15T10:30:00Z"
}
```

## ⚙️ Configuration Options

### Scraping Modes

| Mode | Description | Required Input |
|------|-------------|----------------|
| `profile` | Complete profile information | `usernames` |
| `posts` | User posts with engagement | `usernames` |
| `hashtag` | Posts from hashtag pages | `hashtags` |
| `reels` | Instagram reels content | `usernames` |
| `comments` | Comments from specific posts | `postUrls` |
| `followers` | Follower count tracking | `usernames` |
| `mentions` | Brand/keyword mentions | `searchTerms` |
| `quickCheck` | Fast account overview | `usernames` |
| `hashtagStats` | Hashtag performance metrics | `hashtags` |

### Limits & Performance

- **maxItems**: Overall item limit (1-10,000)
- **maxPosts**: Posts per profile/hashtag (0-1,000)  
- **maxReels**: Reels per profile (0-500)
- **maxComments**: Comments per post (0-1,000)
- **maxFollowers**: Followers to extract (0-5,000)
- **maxResults**: Search results for mentions (0-500)

### Advanced Options

- **includeComments**: Extract comment data with posts
- **includeMedia**: Include image/video URLs
- **includeStories**: Include story data (when available)
- **includeHighlights**: Include highlight reels
- **includeReplies**: Include comment replies
- **includeFollowerDetails**: Detailed follower profiles
- **sortBy**: Sort hashtag posts by "recent" or "top"

## 🛡️ Rate Limiting & Best Practices

This scraper implements several anti-detection measures:

- **Residential Proxies**: Automatic IP rotation
- **Session Management**: Smart session handling  
- **Request Delays**: Human-like timing patterns
- **Browser Fingerprinting**: Realistic browser signatures
- **Error Handling**: Robust retry mechanisms

## 📈 Use Cases

### Marketing & Analytics
- Track competitor activity and engagement
- Analyze hashtag performance for campaigns
- Monitor brand mentions and sentiment
- Identify influencers in your niche

### Research & Insights  
- Social media trend analysis
- Content performance research
- Audience behavior studies
- Market research data collection

### Business Intelligence
- Lead generation from targeted profiles
- Customer sentiment analysis from comments
- Competitor benchmarking
- Influencer outreach list building

## 🚨 Compliance & Ethics

This scraper only extracts **publicly available data** that Instagram shows to non-logged-in users. It respects:

- Instagram's rate limits
- Public data accessibility rules
- GDPR compliance for EU data
- Ethical scraping practices

**Important**: Always review and comply with Instagram's Terms of Service and applicable data protection laws in your jurisdiction.

## 🔧 Technical Details

### Built With
- **Apify SDK 3.x**: Actor framework and data management
- **Crawlee 3.x**: Web crawling and browser automation
- **Playwright**: Headless browser automation
- **Node.js 20+**: Runtime environment

### Infrastructure
- Automatic proxy rotation
- Cloud-based execution
- Scalable compute resources
- Built-in data storage

### Error Handling
- Comprehensive error logging
- Automatic retry mechanisms
- Graceful failure handling
- Detailed error reporting

## 📞 Support

- **Issues**: Report bugs via the Actor's Issues tab
- **Documentation**: Full API docs available
- **Community**: Join the Apify Discord community
- **Custom Solutions**: Contact for enterprise needs

## 🏷️ Tags

`instagram` `social-media` `scraper` `data-extraction` `marketing` `analytics` `apify` `crawlee`

---

**Version**: 1.0.0  
**Last Updated**: January 2025  
**Compatibility**: Instagram Web (2025)

## 🔄 Changelog

### v1.0.0 (January 2025)
- Initial release with 9 scraping modes
- Comprehensive input validation
- Advanced anti-detection features
- Full error handling and logging
- Optimized performance and reliability