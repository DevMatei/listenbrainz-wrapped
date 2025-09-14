import os
import requests
import json
import subprocess
import time
from flask import Flask
from bs4 import BeautifulSoup
from statistics import mode
from multiprocessing import Pool

api_file = open(os.getcwd() + "/key", "r")
key = api_file.readline()
api_file.close()
app = Flask(__name__, static_url_path='')

# redirect so /index.html instead of /static/index.html :/
@app.route('/')
def root():
    return app.send_static_file('index.html')

# returns the top albums given a username
@app.route("/top/albums/<name>/<number>")
def get_top_albums(name, number):
    payload = {'user': name, 'api_key': key, 'period': '12month', 'limit': 'number', 'format': 'json'}
    r = requests.get('https://ws.audioscrobbler.com/2.0/?method=user.gettopalbums', params=payload)
    output = ''
    for i in r.json()['topalbums']['album']:
       output += f"{i['@attr']['rank']} {i['name']}<br>"
    return output

# returns the top artists given a username
@app.route("/top/artists/<name>/<number>")
def get_top_artists(name, number):
    payload = {'user': name, 'api_key': key, 'period': '12month', 'limit': number, 'format': 'json'}
    r = requests.get('https://ws.audioscrobbler.com/2.0/?method=user.gettopartists', params=payload)

    output = []
    for i in r.json()['topartists']['artist']:
       output.append(i['name'])
    return output

# returns the top artists formatted in 1 name\n 2 name\n ....
@app.route("/top/artists/<name>/<number>/formatted")
def get_top_artists_formatted(name, number):
    artists = get_top_artists(name, number)
    output = ""
    for n in range(0, int(number)):
        output += f"{str(n+1)} {artists[n]}<br>"
    return output


# returns the top artist image as a proxied image (to avoid CORS issues)
from flask import Response
@app.route("/top/img/<name>")
def get_top_artist_img(name):
    payload = {'user': name, 'api_key': key, 'period': '12month', 'limit': '1', 'format': 'json'}
    r = requests.get('https://ws.audioscrobbler.com/2.0/?method=user.gettopartists', params=payload)
    topname = r.json()['topartists']['artist'][0]['name']
    topname = topname.replace(" ", "+")
    artist_content = requests.get(f"https://www.last.fm/music/{topname}/+images").content
    soup = BeautifulSoup(artist_content, "html.parser")
    img_url = soup.find(class_="header-new-background-image").attrs.get("content")
    # Proxy the image with CORS header
    img_resp = requests.get(img_url)
    content_type = img_resp.headers.get('Content-Type', 'image/jpeg')
    response = Response(img_resp.content, content_type=content_type)
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response

# returns the top tracks given a username
@app.route("/top/tracks/<name>/<number>")
def get_top_tracks(name, number):
    payload = {'user': name, 'api_key': key, 'period': '12month', 'limit': number, 'format': 'json'}
    r = requests.get('https://ws.audioscrobbler.com/2.0/?method=user.gettoptracks', params=payload)
    output = []
    for i in r.json()['toptracks']['track']:
       output.append(i['name'])
    return output

# returns the top tracks formatted in 1 name\n 2 name\n ....
@app.route("/top/tracks/<name>/<number>/formatted")
def get_top_tracks_formatted(name, number):
    tracks = get_top_tracks(name, number)
    output = ""
    for n in range(0, int(number)):
        output += f"{str(n+1)} {tracks[n]}<br>"
    return output


# returns the total listening time given a username
@app.route("/time/total/<name>")
def get_listen_time(name):
    rightnow = int(time.time())
    yearago = rightnow - 31557600 # year in seconds
    payload = {'user': name, 'api_key': key, 'from': yearago, 'to': rightnow, 'format':'json'}
    r = requests.get('http://ws.audioscrobbler.com/2.0/?method=user.getweeklytrackchart', params=payload)
    tracks = r.json()['weeklytrackchart']['track']
    tracktimes = []
    total = 0
    with Pool(6) as pool:
        tracktimes = pool.map(get_total_track_time, tracks)
    for i in tracktimes:
        total += int(i)
    return ("{:,}".format(int(total/60000)))

# returns the total track time (playcount * runtime) for a track
def get_total_track_time(track):
    playcount = int(track['playcount'])
    tracktime = get_track_time(track['artist']['#text'], track['name']) 
    return playcount * int(tracktime)

# returns the length for a track given an artist and track name
@app.route("/time/total_ta/<artist>/<track>")
def get_track_time(artist, track):
    payload = {'artist': artist, 'track': track, 'api_key': key, 'format': 'json'}
    r = requests.get('http://ws.audioscrobbler.com/2.0/?method=track.getInfo', params=payload)
    try:
        output = r.json()['track']['duration']
    except:
        output = "180000" # 3 minutes is roughly the average song length, good enough if it doesn't find a track duration
    return output

# returns the top genre for this user
@app.route("/top/genre/user/<name>")
def get_top_genre_user(name):
    genres = []
    artists = get_top_artists(name, 15)
    for artist in artists:
        genres.append(get_top_genre_artist(artist))
    return mode(genres)
    

# returns the top tag (genre) for an artist
@app.route("/top/genre/artist/<artist>")
def get_top_genre_artist(artist):
    payload = {'artist': artist, 'api_key': key, 'format': 'json'}
    r = requests.get('http://ws.audioscrobbler.com/2.0/?method=artist.gettoptags', params=payload)
    try:
        output = r.json()['toptags']['tag'][0]['name']
        index = 0
        while output == "seen live": # have a list of prohibited tags? mainstream genre list to check against? idk
            index += 1
            output = r.json()['toptags']['tag'][index]['name']
    except:
        output = "no genre"
    return output

if __name__ == "__main__":
    app.run()