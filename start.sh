#! /bin/bash
# flask settings
export FLASK_APP="os.path.dirname(__file__)/wrapped-fm.py"
export FLASK_DEBUG=0

echo "Starting Flask server..."
echo "   "
python3 -m flask run --host=$1 --port=$2
