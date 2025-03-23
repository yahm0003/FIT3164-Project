import sqlite3
import pandas as pd


# Connect to the database
conn = sqlite3.connect("weather.db")

# Query temperature data for a specific latitude/longitude
query = """
    SELECT date, temperature_2m_mean FROM weather_data 
    WHERE latitude = -37.785587310791016 AND longitude = 144.93975830078125
    ORDER BY date
"""
df_trend = pd.read_sql(query, conn)
conn.close()

# Display results
print(df_trend.head(10))