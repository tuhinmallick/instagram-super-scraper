# 🚀 Instagram Multi-Scraper Apify Actor

A comprehensive Instagram scraper that supports 9 different scraping modes in a single actor. The UI dynamically changes based on your selection, providing a clean and intuitive experience.

## 🎯 Features

### Supported Scraper Types:

- **👤 Instagram Profile Scraper** - Extract complete profile information
- **🎞️ Instagram Reel Scraper** - Scrape user's reels and videos  
- **#️⃣ Instagram Hashtag Scraper** - Get posts from any hashtag
- **📷 Instagram Post Scraper** - Extract detailed post information
- **💬 Instagram Comments Scraper** - Get comments from posts/reels
- **🏷️ Instagram Mentions Scraper** - Find posts mentioning specific users
- **✅ Quick Instagram Posts Checker** - Fast overview of recent posts
- **👥 Instagram Followers Count Scraper** - Bulk follower count checking
- **📊 Instagram Hashtag Stats** - Get hashtag statistics and metrics

## 🛠️ Setup Instructions

### 1. Create New Actor on Apify

1. Go to [Apify Console](https://console.apify.com/)
2. Click "Create New" → "Actor"
3. Choose "Web Scraper" template or start from scratch

### 2. Upload Files

Copy these files to your Apify actor:

- `main.js` - Main scraper logic
- `package.json` - Dependencies
- `Dockerfile` - Container configuration  
- `INPUT_SCHEMA.json` - Dynamic UI configuration

### 3. Configure Input Schema

The `INPUT_SCHEMA.json` provides the dynamic UI that changes based on scraper selection:

```json
{
  "title": "Instagram Multi-Scraper Input",
  "type": "object", 
  "properties": {
    "scraperType": {
      "title": "Scraper Type",
      "type": "string",
      "enum": ["profile", "reels", "hashtag", "post", "comments", "mentions", "quick-posts", "followers-count", "hashtag-stats"]
    }
  }
}
```

## 📊 Usage Examples

### Profile Scraper
```json
{
  "scraperType": "profile",
  "profileUrl": "cristiano"
}
```

**Output:**
```json
{
  "username": "cristiano",
  "displayName": "Cristiano Ronaldo", 
  "bio": "Professional footballer",
  "posts": 3401,
  "followers": 617000000,
  "following": 578,
  "isVerified": true,
  "isPrivate": false,
  "profilePicture": "https://...",
  "externalUrl": "https://...",
  "category": "Athlete"
}
```

### Hashtag Scraper
```json
{
  "scraperType": "hashtag",
  "hashtag": "travel",
  "limit": 50
}
```

**Output:**
```json
{
  "hashtag": "travel",
  "postsCount": 500000000,
  "description": "Explore the world...",
  "posts": [
    {
      "url": "https://instagram.com/p/ABC123/",
      "thumbnail": "https://...",
      "shortcode": "ABC123", 
      "type": "post"
    }
  ]
}
```

### Comments Scraper
```json
{
  "scraperType": "comments",
  "postUrl": "https://instagram.com/p/ABC123/",
  "limit": 100
}
```

**Output:**
```json
[
  {
    "username": "user123",
    "comment": "Amazing post!",
    "timestamp": "2024-01-01T12:00:00Z",
    "likes": 45
  }
]
```

## 🔧 Configuration Options

### Input Fields (Dynamic based on scraper type):

| Field | Type | Description | Required For |
|-------|------|-------------|-------------|
| `scraperType` | String | Type of scraper to use | All |
| `profileUrl` | String | Instagram profile URL or username | Profile, Reels, Mentions, Quick Posts |
| `hashtag` | String | Hashtag name (without #) | Hashtag, Hashtag Stats |
| `postUrl` | String | Full Instagram post/reel URL | Post, Comments |
| `usernames` | Array | List of usernames for bulk checking | Followers Count |
| `limit` | Integer | Maximum items to scrape (1-1000) | Most scrapers |
| `proxyConfiguration` | Object | Proxy settings | Optional |

### Proxy Configuration

Recommende