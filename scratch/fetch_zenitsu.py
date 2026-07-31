import urllib.request
import os

img_url = 'https://images.hdqwalls.com/wallpapers/zenitsu-agatsuma-he-left-the-village-to-save-it-fm.jpg'
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Referer': 'https://hdqwalls.com/',
}

try:
    print('DOWNLOADING EXACT WALLPAPER:', img_url)
    img_req = urllib.request.Request(img_url, headers=headers)
    with urllib.request.urlopen(img_req) as img_resp, open('public/zenitsu-hero.jpg', 'wb') as f:
        f.write(img_resp.read())
    size = os.path.getsize('public/zenitsu-hero.jpg')
    print('SUCCESSFULLY SAVED public/zenitsu-hero.jpg! Size:', size, 'bytes')
except Exception as e:
    print('ERROR:', e)
