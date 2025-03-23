import sqlite3


# Connect to (or create) the database
conn = sqlite3.connect("weather.db")
cursor = conn.cursor()

# Create a table with correct columns
cursor.execute('''
    CREATE TABLE IF NOT EXISTS weather_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        latitude REAL,
        longitude REAL,
        weather_code INTEGER,
        temperature_2m_max REAL,
        temperature_2m_min REAL,
        temperature_2m_mean REAL,
        apparent_temperature_max REAL,
        apparent_temperature_min REAL,
        apparent_temperature_mean REAL,
        sunrise TEXT,
        sunset TEXT,
        daylight_duration REAL,
        sunshine_duration REAL,
        precipitation_sum REAL,
        rain_sum REAL,
        snowfall_sum REAL,
        precipitation_hours REAL
    )
''')

# Commit and close connection
conn.commit()
conn.close()
print("Database and table created successfully!")