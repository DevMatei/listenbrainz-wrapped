import os
import requests
import json
import subprocess
import time
from flask import Flask
from bs4 import BeautifulSoup

api_file = open(os.getcwd() + "/key", "r")
key = api_file.readline()
api_file.close()
app = Flask(__name__, static_url_path='')

# redirect so /index.html instead of /static/index.html :/
@app.route('/')
def root():
    return app.send_static_file('index.html')

# returns the top albums given a username
@app.route("/top/albums/<name>")
def get_top_albums(name):
    payload = {'user': name, 'api_key': key, 'period': '12month', 'limit': '5', 'format': 'json'}
    r = requests.get('https://ws.audioscrobbler.com/2.0/?method=user.gettopalbums', params=payload)
    output = ''
    for i in r.json()['topalbums']['album']:
       output += f"{i['@attr']['rank']} {i['name']}<br>"
    return output

# returns the top artists given a username
@app.route("/top/artists/<name>")
def get_top_artists(name):
    payload = {'user': name, 'api_key': key, 'period': '12month', 'limit': '5', 'format': 'json'}
    r = requests.get('https://ws.audioscrobbler.com/2.0/?method=user.gettopartists', params=payload)

    output = ""
    for i in r.json()['topartists']['artist']:
       output += f"{i['@attr']['rank']} {i['name']}<br>"
    return output

# returns the top artist url
@app.route("/top/img/<name>")
def get_top_artist_img(name):
    payload = {'user': name, 'api_key': key, 'period': '12month', 'limit': '5', 'format': 'json'}
    r = requests.get('https://ws.audioscrobbler.com/2.0/?method=user.gettopartists', params=payload)

    topname = r.json()['topartists']['artist'][0]['name']
    topname.replace(" ", "+")
    artist_content = requests.get(f"https://www.last.fm/music/{topname}/+images").content
    soup = BeautifulSoup(artist_content, "html.parser")
    img_url = soup.find(class_="header-new-background-image").attrs.get("content")
    return img_url

# returns the top tracks given a username
@app.route("/top/tracks/<name>")
def get_top_tracks(name):
    payload = {'user': name, 'api_key': key, 'period': '12month', 'limit': '5', 'format': 'json'}
    r = requests.get('https://ws.audioscrobbler.com/2.0/?method=user.gettoptracks', params=payload)
    output = ''
    for i in r.json()['toptracks']['track']:
       output += f"{i['@attr']['rank']} {i['name']}<br>"
    return output

# returns the total listening time given a username
@app.route("/time/total/<name>")
def get_listen_time(name):
    rightnow = int(time.time())
    yearago = rightnow - 31557600 # year in seconds
    payload = {'user': name, 'api_key': key, 'from': yearago, 'to': rightnow, 'format':'json'}
    r = requests.get('http://ws.audioscrobbler.com/2.0/?method=user.getweeklytrackchart', params=payload)
    total = 0
    for i in r.json()['weeklytrackchart']['track']:
        playcount = int(i['playcount'])
        tracktime = get_track_time(i['artist']['#text'], i['name']) 
        total += playcount * int(get_track_time(i['artist']['#text'], i['name']))
    return ("{:,}".format(int(total/60000)))

# returns the length for a track given an mbid
@app.route("/time/total_ta/<artist>/<track>")
def get_track_time(artist, track):
    payload = {'artist': artist, 'track': track, 'api_key': key, 'format': 'json'}
    r = requests.get('http://ws.audioscrobbler.com/2.0/?method=track.getInfo', params=payload)
    try:
        output = r.json()['track']['duration']
    except:
        output = "180000" # 3 minutes is roughly the average song length, good enough if it doesn't find a track duration
    return output


if __name__ == "__main__":
    app.run()