import urllib.request
import re
import os

url = 'https://hdqwalls.com/anime-creature-fighting-wallpaper'
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
}

try:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        html = resp.read().decode('utf-8', errors='ignore')
        matches = re.findall(r'https://images\.hdqwalls\.com/wallpapers/[^\s\"\']+\.jpg', html)
        print('FOUND MATCHES:', set(matches))

        # Find full wallpaper matching path (not bthumb)
        full_matches = [m for m in set(matches) if '/bthumb/' not in m]
        if full_matches:
            img_url = full_matches[0]
            print('DOWNLOADING FULL WALLPAPER:', img_url)
            img_req = urllib.request.Request(img_url, headers=headers)
            with urllib.request.urlopen(img_req) as img_resp, open('public/roadmap-bg.jpg', 'wb') as f:
                f.write(img_resp.read())
            print('SUCCESSFULLY SAVED public/roadmap-bg.jpg! Size:', os.path.getsize('public/roadmap-bg.jpg'))
        else:
            print('NO FULL WALLPAPER MATCH FOUND!')
except Exception as e:
    print('ERROR:', e)
