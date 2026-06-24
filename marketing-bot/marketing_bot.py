# Pabandi Marketing Bot
# Automated Twitter + Instagram content publishing and engagement
# Usage: python3 marketing_bot.py --platform twitter --action post --file ../docs/Twitter-90Day-Calendar.md

import os
import sys
import json
import re
import argparse
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Optional

# Try importing optional dependencies
try:
    import tweepy
    TWEEPY_AVAILABLE = True
except ImportError:
    TWEEPY_AVAILABLE = False

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False


class ContentParser:
    """Parse markdown content files for scheduled posts"""
    
    @staticmethod
    def parse_markdown_posts(filepath: str) -> List[Dict]:
        posts = []
        path = Path(filepath)
        if not path.exists():
            print(f"Error: File not found: {filepath}")
            return posts
        
        content = path.read_text()
        
        # Extract code blocks (tweets wrapped in ```)
        code_blocks = re.findall(r'```(?:\w+\n)?(.*?)```', content, re.DOTALL)
        
        for block in code_blocks:
            lines = [l.strip() for l in block.split('\n') if l.strip()]
            # Filter out bash/curl commands, JSON objects, and code syntax
            if lines and not any(x in lines[0] for x in ['curl', '{', 'import', 'const', '//', 'http']):
                tweet_text = '\n'.join(lines)
                # Remove markdown artifacts
                tweet_text = re.sub(r'\[.*?\]\(.*?\)', '', tweet_text)  # Remove links
                tweet_text = re.sub(r'#{1,6}\s', '', tweet_text)  # Remove headers
                tweet_text = re.sub(r'\*\*.*?\*\*', lambda m: m.group(0).replace('**', ''), tweet_text)  # Remove bold
                tweet_text = tweet_text.strip()
                
                if tweet_text and len(tweet_text) > 10 and len(tweet_text) <= 280:
                    posts.append({
                        'text': tweet_text,
                        'file': filepath,
                        'parsed_at': datetime.now().isoformat()
                    })
        
        # Also extract bullet point lines as potential tweets
        bullet_tweets = re.findall(r'^[-•]\s+(.+)$', content, re.MULTILINE)
        for tweet in bullet_tweets:
            tweet = tweet.strip()
            # Remove markdown formatting
            tweet = re.sub(r'\*\*(.+?)\*\*', r'\1', tweet)
            tweet = re.sub(r'\[(.+?)\]\(.+?\)', r'\1', tweet)
            if 50 < len(tweet) <= 280:
                posts.append({
                    'text': tweet,
                    'file': filepath,
                    'parsed_at': datetime.now().isoformat()
                })
        
        return posts

    @staticmethod
    def parse_thread_sequence(filepath: str) -> List[Dict]:
        """Parse a threaded document into sequence of tweets"""
        threads = []
        path = Path(filepath)
        if not path.exists():
            return threads
        
        content = path.read_text()
        
        # Split by ## THREAD headers
        thread_sections = re.split(r'##\s+THREAD\s+\d+', content)
        
        for i, section in enumerate(thread_sections[1:], 1):  # Skip first empty
            tweets = []
            # Extract tweet blocks
            tweet_blocks = re.findall(r'\*\*Tweet \d+.*?\*\*\n```(?:\w+\n)?(.*?)```', section, re.DOTALL)
            
            for block in tweet_blocks:
                lines = [l.strip() for l in block.split('\n') if l.strip()]
                if lines:
                    tweet_text = '\n'.join(lines)
                    tweet_text = re.sub(r'\[.*?\]\(.*?\)', '', tweet_text)
                    tweet_text = tweet_text.strip()
                    if 10 < len(tweet_text) <= 280:
                        tweets.append(tweet_text)
            
            if tweets:
                threads.append({
                    'thread_id': i,
                    'tweets': tweets,
                    'file': filepath
                })
        
        return threads


class TwitterBot:
    """Twitter automation via Tweepy"""
    
    def __init__(self):
        self.api = None
        self.client = None
        self.v1_api = None
        
    def setup(self, api_key: str, api_secret: str, 
              access_token: str, access_secret: str,
              bearer_token: str = None):
        """Initialize Twitter API clients"""
        if not TWEEPY_AVAILABLE:
            print("Error: tweepy not installed. Run: pip install tweepy")
            return False
        
        try:
            # API v1.1 for posting
            auth = tweepy.OAuth1UserHandler(api_key, api_secret, access_token, access_secret)
            self.api = tweepy.API(auth)
            self.v1_api = self.api
            
            # API v2 for newer features
            if bearer_token:
                self.client = tweepy.Client(bearer_token=bearer_token,
                                           consumer_key=api_key,
                                           consumer_secret=api_secret,
                                           access_token=access_token,
                                           access_token_secret=access_secret)
            else:
                self.client = tweepy.Client(consumer_key=api_key,
                                           consumer_secret=api_secret,
                                           access_token=access_token,
                                           access_token_secret=access_secret)
            
            # Verify credentials
            user = self.api.verify_credentials()
            print(f"✓ Connected to Twitter as @{user.screen_name}")
            return True
        except Exception as e:
            print(f"✗ Twitter auth failed: {e}")
            return False
    
    def post_tweet(self, text: str, reply_to: str = None) -> Optional[str]:
        """Post a single tweet"""
        try:
            if len(text) > 280:
                print(f"⚠ Tweet too long ({len(text)} chars), truncating to 280")
                text = text[:277] + "..."
            
            response = self.client.create_tweet(text=text, in_reply_to_tweet_id=reply_to)
            tweet_id = response.data['id']
            tweet_url = f"https://x.com/PabandiGlobal/status/{tweet_id}"
            print(f"✓ Posted: {tweet_url}")
            return tweet_id
        except Exception as e:
            print(f"✗ Failed to post: {e}")
            return None
    
    def post_thread(self, tweets: List[str]) -> List[str]:
        """Post a thread of tweets"""
        posted_ids = []
        reply_to = None
        
        for tweet_text in tweets:
            tweet_id = self.post_tweet(tweet_text, reply_to)
            if tweet_id:
                posted_ids.append(tweet_id)
                reply_to = tweet_id
            else:
                print("✗ Thread interrupted due to posting failure")
                break
        
        return posted_ids
    
    def like_tweet(self, tweet_id: str) -> bool:
        """Like a tweet"""
        try:
            self.client.like(tweet_id)
            print(f"✓ Liked tweet {tweet_id}")
            return True
        except Exception as e:
            print(f"✗ Failed to like: {e}")
            return False
    
    def retweet(self, tweet_id: str) -> bool:
        """Retweet"""
        try:
            self.client.retweet(tweet_id)
            print(f"✓ Retweeted {tweet_id}")
            return True
        except Exception as e:
            print(f"✗ Failed to retweet: {e}")
            return False
    
    def search_tweets(self, query: str, max_results: int = 10) -> List[Dict]:
        """Search for tweets to engage with"""
        try:
            tweets = self.client.search_recent_tweets(query=query, max_results=max_results, 
                                                       tweet_fields=['author_id', 'created_at'])
            return [t.data for t in tweets.data] if tweets.data else []
        except Exception as e:
            print(f"✗ Search failed: {e}")
            return []


class InstagramBot:
    """Instagram automation via Graph API (placeholder)"""
    
    def __init__(self):
        self.access_token = None
        self.page_id = None
        self.ig_user_id = None
        
    def setup(self, access_token: str, page_id: str, ig_user_id: str):
        """Initialize Instagram Graph API"""
        if not REQUESTS_AVAILABLE:
            print("Error: requests not installed")
            return False
        
        self.access_token = access_token
        self.page_id = page_id
        self.ig_user_id = ig_user_id
        print(f"✓ Instagram configured for user {ig_user_id}")
        return True
    
    def post_carousel(self, image_urls: List[str], caption: str) -> Optional[str]:
        """Post carousel (multiple images)"""
        # Placeholder - requires Instagram Graph API implementation
        print("⚠ Instagram posting not yet implemented — add your Graph API credentials")
        return None
    
    def post_reel(self, video_url: str, caption: str) -> Optional[str]:
        """Post a Reel"""
        # Placeholder
        print("⚠ Instagram posting not yet implemented")
        return None


class ContentQueue:
    """Manage scheduled content calendar"""
    
    def __init__(self, calendar_dir: str = "../docs"):
        self.calendar_dir = Path(calendar_dir)
        self.queue_file = Path("content_queue.json")
        self.queue = self._load_queue()
    
    def _load_queue(self) -> Dict:
        if self.queue_file.exists():
            return json.loads(self.queue_file.read_text())
        return {'scheduled': [], 'posted': [], 'engagement': []}
    
    def _save_queue(self):
        self.queue_file.write_text(json.dumps(self.queue, indent=2))
    
    def add_tweet(self, text: str, platform: str = 'twitter', 
                  schedule_time: str = None, tags: List[str] = None):
        """Add a tweet to the queue"""
        if schedule_time is None:
            schedule_time = (datetime.now() + timedelta(hours=2)).isoformat()
        
        self.queue['scheduled'].append({
            'id': len(self.queue['scheduled']) + 1,
            'platform': platform,
            'text': text,
            'schedule_time': schedule_time,
            'tags': tags or [],
            'status': 'pending',
            'created_at': datetime.now().isoformat()
        })
        self._save_queue()
        print(f"✓ Added to queue: {text[:50]}...")
    
    def add_thread(self, tweets: List[str], platform: str = 'twitter',
                   schedule_time: str = None):
        """Add a thread to the queue"""
        if schedule_time is None:
            schedule_time = (datetime.now() + timedelta(hours=2)).isoformat()
        
        thread_id = len(self.queue['scheduled']) + 1
        for i, tweet in enumerate(tweets):
            self.queue['scheduled'].append({
                'id': thread_id,
                'platform': platform,
                'text': tweet,
                'thread_part': i + 1,
                'total_threads': len(tweets),
                'schedule_time': schedule_time,
                'tags': ['thread'],
                'status': 'pending',
                'created_at': datetime.now().isoformat()
            })
        self._save_queue()
        print(f"✓ Added thread ({len(tweets)} tweets) to queue")
    
    def get_next_due(self) -> List[Dict]:
        """Get posts due for publishing"""
        now = datetime.now()
        return [p for p in self.queue['scheduled'] 
                if p['status'] == 'pending' and 
                datetime.fromisoformat(p['schedule_time']) <= now]
    
    def mark_posted(self, post_id: int, post_url: str):
        """Mark a post as published"""
        for post in self.queue['scheduled']:
            if post['id'] == post_id:
                post['status'] = 'posted'
                post['posted_at'] = datetime.now().isoformat()
                post['post_url'] = post_url
                self.queue['posted'].append(post)
                break
        self._save_queue()
    
    def import_from_markdown(self, filepath: str, platform: str = 'twitter'):
        """Import posts from markdown file"""
        posts = ContentParser.parse_markdown_posts(filepath)
        threads = ContentParser.parse_thread_sequence(filepath)
        
        # Add individual posts
        for post in posts:
            self.add_tweet(post['text'], platform)
        
        # Add threads
        for thread in threads:
            self.add_thread(thread['tweets'], platform)
        
        print(f"✓ Imported {len(posts)} posts + {len(threads)} threads from {filepath}")


class EngagementBot:
    """Auto-engagement: likes, retweets, replies"""
    
    def __init__(self, twitter_bot: TwitterBot):
        self.twitter = twitter_bot
        self.targets_file = Path("engagement_targets.json")
        self.targets = self._load_targets()
    
    def _load_targets(self) -> List[str]:
        if self.targets_file.exists():
            return json.loads(self.targets_file.read_text()).get('handles', [])
        return []
    
    def save_targets(self, handles: List[str]):
        self.targets_file.write_text(json.dumps({'handles': handles}, indent=2))
    
    def engage_with_user(self, username: str, action: str = 'like') -> bool:
        """Engage with recent tweets from a user"""
        if not self.twitter.client:
            print("✗ Twitter not connected")
            return False
        
        try:
            # Get user ID
            user = self.twitter.client.get_user(username=username)
            if not user.data:
                print(f"✗ User @{username} not found")
                return False
            
            user_id = user.data.id
            
            # Get recent tweets
            tweets = self.twitter.client.get_users_tweets(id=user_id, max_results=5)
            if not tweets.data:
                print(f"⚠ No recent tweets from @{username}")
                return False
            
            # Engage with most recent tweet
            recent = tweets.data[0]
            if action == 'like':
                return self.twitter.like_tweet(recent.id)
            elif action == 'retweet':
                return self.twitter.retweet(recent.id)
            return False
            
        except Exception as e:
            print(f"✗ Engagement failed: {e}")
            return False
    
    def daily_engagement_round(self, handles: List[str] = None):
        """Run engagement on target list"""
        if handles is None:
            handles = self.targets
        
        print(f"\n📊 Starting daily engagement round for {len(handles)} accounts...")
        for handle in handles[:5]:  # Limit to 5 per session
            print(f"\n→ Engaging with @{handle}")
            self.engage_with_user(handle, 'like')
        
        print("\n✓ Engagement round complete")


class MarketingBot:
    """Main bot controller"""
    
    def __init__(self, config_file: str = "bot_config.json"):
        self.config = self._load_config(config_file)
        self.twitter = TwitterBot()
        self.instagram = InstagramBot()
        self.queue = ContentQueue()
        self.engagement = EngagementBot(self.twitter)
    
    def _load_config(self, filepath: str) -> Dict:
        if Path(filepath).exists():
            return json.loads(Path(filepath).read_text())
        return {}
    
    def setup_platforms(self):
        """Setup all platforms from config"""
        # Twitter setup
        if 'twitter' in self.config:
            tw = self.config['twitter']
            self.twitter.setup(
                api_key=tw.get('api_key', ''),
                api_secret=tw.get('api_secret', ''),
                access_token=tw.get('access_token', ''),
                access_secret=tw.get('access_secret', ''),
                bearer_token=tw.get('bearer_token', '')
            )
        
        # Instagram setup
        if 'instagram' in self.config:
            ig = self.config['instagram']
            self.instagram.setup(
                access_token=ig.get('access_token', ''),
                page_id=ig.get('page_id', ''),
                ig_user_id=ig.get('ig_user_id', '')
            )
    
    def run_scheduled_posts(self):
        """Check and post anything due now"""
        due_posts = self.queue.get_next_due()
        if not due_posts:
            print("✓ No posts due right now")
            return
        
        print(f"📬 Found {len(due_posts)} posts due for publishing")
        for post in due_posts:
            if post['platform'] == 'twitter' and self.twitter.client:
                tweet_id = self.twitter.post_tweet(post['text'])
                if tweet_id:
                    self.queue.mark_posted(post['id'], f"https://x.com/PabandiGlobal/status/{tweet_id}")
            elif post['platform'] == 'instagram' and self.instagram.access_token:
                print(f"⚠ Instagram posting: {post['text'][:50]}...")
            else:
                print(f"⚠ Skipped post {post['id']} — platform not configured")
    
    def import_content(self, filepath: str):
        """Import markdown content into queue"""
        self.queue.import_from_markdown(filepath)
    
    def load_calendar(self):
        """Load all markdown content files from docs/"""
        docs_dir = Path("../docs")
        if not docs_dir.exists():
            print(f"⚠ Docs directory not found: {docs_dir}")
            return
        
        for md_file in docs_dir.glob("*.md"):
            if any(skip in md_file.name for skip in ['README', 'CHANGELOG']):
                continue
            print(f"📄 Importing: {md_file.name}")
            self.import_content(str(md_file))
    
    def show_queue(self):
        """Display current content queue"""
        scheduled = [p for p in self.queue.queue['scheduled'] if p['status'] == 'pending']
        posted = self.queue.queue['posted']
        
        print(f"\n📋 CONTENT QUEUE STATUS")
        print(f"{'='*60}")
        print(f"Scheduled (pending): {len(scheduled)}")
        print(f"Already posted:      {len(posted)}")
        print(f"\n{'='*60}")
        
        if scheduled:
            print("\n📅 UPCOMING POSTS:")
            for post in sorted(scheduled, key=lambda x: x['schedule_time'])[:10]:
                time_str = post['schedule_time'][:16].replace('T', ' ')
                preview = post['text'][:60] + ("..." if len(post['text']) > 60 else "")
                print(f"  [{post['id']}] {time_str} | {preview}")
        
        if posted:
            print(f"\n✅ RECENTLY POSTED:")
            for post in posted[-5:]:
                time_str = post.get('posted_at', '?')[:16]
                print(f"  {time_str} | {post['text'][:60]}...")


def main():
    parser = argparse.ArgumentParser(description='Pabandi Marketing Bot')
    parser.add_argument('--action', choices=['post', 'queue', 'import', 'engage', 'setup'], 
                       default='queue', help='Action to perform')
    parser.add_argument('--platform', choices=['twitter', 'instagram', 'all'], 
                       default='twitter')
    parser.add_argument('--file', help='Markdown file to import')
    parser.add_argument('--text', help='Tweet text to post directly')
    parser.add_argument('--config', default='bot_config.json', help='Config file path')
    
    args = parser.parse_args()
    
    bot = MarketingBot(args.config)
    
    print(f"\n🤖 PABANDI MARKETING BOT")
    print(f"{'='*60}")
    
    if args.action == 'setup':
        bot.setup_platforms()
        if bot.twitter.client:
            print("✓ Twitter connected")
        if bot.instagram.access_token:
            print("✓ Instagram connected")
    
    elif args.action == 'import':
        if args.file:
            bot.import_content(args.file)
        else:
            bot.load_calendar()
        bot.show_queue()
    
    elif args.action == 'queue':
        bot.load_calendar()
        bot.show_queue()
    
    elif args.action == 'post':
        bot.setup_platforms()
        if args.text:
            bot.twitter.post_tweet(args.text)
        else:
            bot.run_scheduled_posts()
    
    elif args.action == 'engage':
        bot.setup_platforms()
        bot.engagement.daily_engagement_round()


if __name__ == '__main__':
    main()
