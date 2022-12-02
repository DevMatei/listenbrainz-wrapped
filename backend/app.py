import os
import requests
from flask import Flask

api_file = open(os.getcwd() + "/key", "r")
key = api_file.readline()
print(key)
api_file.close()
app = Flask(__name__)

@app.route("/<name>")
def get_top_albums(name):
    payload = {'user': name, 'api_key': key, 'peroid': '12month', 'format': 'json'}
    r = requests.get('https://ws.audioscrobbler.com/2.0/?method=user.gettopalbums', params=payload)
    print(r.url)
    return r.text