from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
import pandas as pd

app = Flask(__name__)
CORS(app)  # Allows frontend to access API (CORS policy)

DB_PATH = "weather.db"

# Coordinates for the 4 cities
CITIES = {
    "Melbourne": (-37.785587, 144.939758),
    "Brisbane": (-27.451670, 153.020142),
    "Sydney": (-33.848858, 151.195511),
    "Perth": (-31.950790, 115.807236),
    "Adelaide": (-34.903339, 138.540604),
    "Canberra": (-35.254833, 149.080460)
}

# Route to get raw weather data for multiple cities
@app.route("/weather/raw", methods=["GET"])
def get_raw_weather():
    city_names = request.args.getlist("city")  # Accepts multiple city names as query parameters
    if not city_names:
        return jsonify({"error": "Please provide at least one city."}), 400

    # Ensure valid city names are requested
    invalid_cities = [city for city in city_names if city not in CITIES]
    if invalid_cities:
        return jsonify({"error": f"Invalid city names: {', '.join(invalid_cities)}"}), 400

    data = {}
    for city in city_names:
        lat, lon = CITIES[city]
        print(f"Fetching data for {city} (Lat: {lat}, Lon: {lon})")

        conn = sqlite3.connect(DB_PATH)
        query = """
            SELECT date, latitude, longitude, weather_code, 
                   temperature_2m_max, temperature_2m_min, temperature_2m_mean,
                   apparent_temperature_max, apparent_temperature_min, apparent_temperature_mean,
                   sunrise, sunset, daylight_duration, sunshine_duration,
                   precipitation_sum, rain_sum, snowfall_sum, precipitation_hours
            FROM weather_data 
            WHERE ROUND(latitude, 3) = ROUND(?, 3) AND ROUND(longitude, 3) = ROUND(?, 3)
            ORDER BY date
        """
        
        # Run query for the city
        df = pd.read_sql(query, conn, params=(lat, lon))
        conn.close()

        data[city] = df.to_dict(orient="records")

    return jsonify(data)

# Health check route
@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "Weather API is running!"})

if __name__ == "__main__":
    app.run(debug=True)



