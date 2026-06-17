from flask import Flask, render_template, jsonify, request
import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
import time
import re

app = Flask(__name__)

# Cache for the release notes
FEED_CACHE = {
    "data": None,
    "last_updated": 0
}
CACHE_DURATION = 600  # 10 minutes cache

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def clean_html_content(content_html):
    """
    Cleans up absolute links or style issues in the HTML if any.
    Ensures all links open in a new tab.
    """
    if not content_html:
        return ""
    soup = BeautifulSoup(content_html, 'html.parser')
    for a in soup.find_all('a'):
        a['target'] = '_blank'
        a['rel'] = 'noopener noreferrer'
    return str(soup)

def parse_release_notes():
    try:
        response = requests.get(FEED_URL, timeout=15)
        response.raise_for_status()
    except Exception as e:
        # If the feed fails and we have cached data, return it
        if FEED_CACHE["data"]:
            return FEED_CACHE["data"], True
        raise e

    # Parse Atom XML
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    root = ET.fromstring(response.content)
    
    entries = []
    for entry in root.findall('atom:entry', ns):
        title_el = entry.find('atom:title', ns)
        date_str = title_el.text if title_el is not None else "Unknown Date"
        
        id_el = entry.find('atom:id', ns)
        entry_id = id_el.text if id_el is not None else ""
        
        updated_el = entry.find('atom:updated', ns)
        updated_date = updated_el.text if updated_el is not None else ""
        
        link_el = entry.find('atom:link[@rel="alternate"]', ns)
        if link_el is None:
            link_el = entry.find('atom:link', ns)
        link = link_el.attrib.get('href', '') if link_el is not None else ""
        
        content_el = entry.find('atom:content', ns)
        content_html = content_el.text if content_el is not None else ""
        
        # Parse content HTML to extract individual updates
        soup = BeautifulSoup(content_html, 'html.parser')
        
        updates = []
        current_type = "General"
        current_html_parts = []
        
        for child in soup.contents:
            if child.name in ['h3', 'h4']:
                # Save previous update if exists
                if current_html_parts:
                    content_text = "".join(str(c) for c in current_html_parts).strip()
                    content_clean = clean_html_content(content_text)
                    tweet_soup = BeautifulSoup(content_text, 'html.parser')
                    plain_text = tweet_soup.get_text()
                    # Clean double/triple spaces and excess newlines
                    plain_text = re.sub(r'\n+', '\n', plain_text).strip()
                    
                    updates.append({
                        'type': current_type,
                        'content_html': content_clean,
                        'plain_text': plain_text
                    })
                    current_html_parts = []
                current_type = child.get_text().strip()
            else:
                if str(child).strip():
                    current_html_parts.append(child)
                    
        # Add the last update
        if current_html_parts:
            content_text = "".join(str(c) for c in current_html_parts).strip()
            content_clean = clean_html_content(content_text)
            tweet_soup = BeautifulSoup(content_text, 'html.parser')
            plain_text = tweet_soup.get_text()
            plain_text = re.sub(r'\n+', '\n', plain_text).strip()
            
            updates.append({
                'type': current_type,
                'content_html': content_clean,
                'plain_text': plain_text
            })
            
        # Fallback if no updates were parsed
        if not updates and content_html.strip():
            content_clean = clean_html_content(content_html)
            plain_text = soup.get_text()
            plain_text = re.sub(r'\n+', '\n', plain_text).strip()
            updates.append({
                'type': 'General',
                'content_html': content_clean,
                'plain_text': plain_text
            })
            
        entries.append({
            'date': date_str,
            'id': entry_id,
            'updated': updated_date,
            'link': link,
            'updates': updates
        })
        
    FEED_CACHE["data"] = entries
    FEED_CACHE["last_updated"] = time.time()
    return entries, False

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    current_time = time.time()
    
    # Check if we should use cache
    if not force_refresh and FEED_CACHE["data"] and (current_time - FEED_CACHE["last_updated"] < CACHE_DURATION):
        return jsonify({
            "status": "success",
            "source": "cache",
            "last_updated": FEED_CACHE["last_updated"],
            "data": FEED_CACHE["data"]
        })
        
    try:
        data, used_stale_cache = parse_release_notes()
        return jsonify({
            "status": "success",
            "source": "stale_cache" if used_stale_cache else "network",
            "last_updated": FEED_CACHE["last_updated"],
            "data": data
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
