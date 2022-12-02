#! /bin/bash
# flask settings
export FLASK_APP="~/app.py"
export FLASK_DEBUG=0

python3 -m flask run --host=$1 --port=$2
