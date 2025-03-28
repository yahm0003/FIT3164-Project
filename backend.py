from flask import Flask, jsonify
from flask_cors import CORS
import sqlite3
import pandas as pd

app = Flask(__name__)
CORS(app)  # Allow frontend to access API

# Connect to SQLite and fetch weather data
@app.route("/weather/<latitude>/<longitude>")
def get_weather(latitude, longitude):
    conn = sqlite3.connect("weather.db")
    query = """
        SELECT date, temperature_2m_mean, precipitation_sum, sunshine_duration 
        FROM weather_data 
        WHERE latitude = ? AND longitude = ?
        ORDER BY date
    """
    df = pd.read_sql(query, conn, params=(latitude, longitude))
    conn.close()
    return jsonify(df.to_dict(orient="records"))

if __name__ == "__main__":
    app.run(debug=True)