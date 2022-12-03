import os
import requests
import json
import subprocess
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

if __name__ == "__main__":
    app.run()