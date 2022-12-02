import os
import requests
import json
from flask import Flask

api_file = open(os.getcwd() + "/key", "r")
key = api_file.readline()
print(key)
api_file.close()
app = Flask(__name__)


# returns the top albums given a username
@app.route("/top/albums/<name>")
def get_top_albums(name):
    payload = {'user': name, 'api_key': key, 'peroid': '12month', 'limit': '5', 'format': 'json'}
    r = requests.get('https://ws.audioscrobbler.com/2.0/?method=user.gettopalbums', params=payload)
    output = ''
    for i in r.json()['topalbums']['album']:
       output += f"{i['@attr']['rank']} {i['name']}<br>"
    return output

# returns the top artists given a username
@app.route("/top/artists/<name>")
def get_top_artists(name):
    payload = {'user': name, 'api_key': key, 'peroid': '12month', 'limit': '5', 'format': 'json'}
    r = requests.get('https://ws.audioscrobbler.com/2.0/?method=user.gettopartists', params=payload)
    output = ''
    for i in r.json()['topartists']['artist']:
       output += f"{i['@attr']['rank']} {i['name']}<br>"
    return output

# returns the top tracks given a username
@app.route("/top/tracks/<name>")
def get_top_tracks(name):
    payload = {'user': name, 'api_key': key, 'peroid': '12month', 'limit': '5', 'format': 'json'}
    r = requests.get('https://ws.audioscrobbler.com/2.0/?method=user.gettoptracks', params=payload)
    output = ''
    for i in r.json()['toptracks']['track']:
       output += f"{i['@attr']['rank']} {i['name']}<br>"
    return output