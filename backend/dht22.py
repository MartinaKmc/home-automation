import paho.mqtt.client as mqtt
import sqlite3
import json
from flask import Flask, jsonify
from flask_cors import CORS
import threading

# Flask setup
app = Flask(__name__)
CORS(app)

# Database setup
db_conn = sqlite3.connect('sensor_data.db', check_same_thread=False)
mqtt_cursor = db_conn.cursor()  # Cursor for MQTT updates
flask_cursor = db_conn.cursor()  # Cursor for Flask API calls

# Create a thread lock for safe access to the database
db_lock = threading.Lock()

# Create table if it doesn't exist
with db_lock:
    mqtt_cursor.execute('''CREATE TABLE IF NOT EXISTS sensor_data (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            temperature REAL,
                            humidity REAL,
                            heat_index REAL,
                            timestamp INTEGER)''')
    db_conn.commit()

# MQTT setup
MQTT_BROKER = ""  
MQTT_PORT = 1883
MQTT_TOPIC = "dht22" 


# Callback when connecting to the broker
def on_connect(client, userdata, flags, rc):
    print(f"Connected with result code {rc}")
    client.subscribe(MQTT_TOPIC)


# Callback when a message is received
def on_message(client, userdata, msg):
    try:
        data = json.loads(msg.payload.decode('utf-8'))
        temperature = data.get("temperature")
        humidity = data.get("humidity")
        heat_index = data.get("heatIndex")
        timestamp = data.get("timestamp")

        # Insert the data into the database using the MQTT cursor
        with db_lock:
            mqtt_cursor.execute('''INSERT INTO sensor_data (temperature, humidity, heat_index, timestamp)
                                   VALUES (?, ?, ?, ?)''', (temperature, humidity, heat_index, timestamp))
            db_conn.commit()

        print(f"Data inserted: {data}")

    except json.JSONDecodeError as e:
        print(f"Error decoding JSON: {e}")


# Setup MQTT client
client = mqtt.Client()
client.on_connect = on_connect
client.on_message = on_message

# Connect to the broker and start listening for messages
client.connect(MQTT_BROKER, MQTT_PORT, 60)


# Flask route to get the latest temperature and humidity
@app.route('/latest', methods=['GET'])
def get_latest_data():
    with db_lock:
        flask_cursor.execute('''SELECT temperature, humidity, timestamp FROM sensor_data
                                ORDER BY id DESC LIMIT 1''')
        result = flask_cursor.fetchone()
    if result:
        data = {
            "temperature": result[0],
            "humidity": result[1],
            "timestamp": result[2]
        }
        return jsonify(data)
    else:
        return jsonify({"error": "No data available"}), 404


# Flask route to get the last 100 historical data points
@app.route('/history', methods=['GET'])
def get_history():
    with db_lock:
        flask_cursor.execute('''SELECT temperature, humidity, timestamp FROM sensor_data
                                ORDER BY id DESC LIMIT 100''')
        result = flask_cursor.fetchall()
    data = [
        {"temperature": row[0], "humidity": row[1], "timestamp": row[2]}
        for row in result
    ]
    return jsonify(data)


# Start Flask app and MQTT client in separate threads
if __name__ == '__main__':
    from threading import Thread

    # Start MQTT loop in a separate thread
    mqtt_thread = Thread(target=lambda: client.loop_forever())
    mqtt_thread.start()

    # Run Flask app
    app.run(host='0.0.0.0', port=5000)

    # Close database connection on exit
    db_conn.close()
