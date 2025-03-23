import pandas as pd
import sqlite3

# Load the CSV file
csv_file = "all_locations_daily_weather_data.csv"
df = pd.read_csv(csv_file)

# Convert date column to a clean format (YYYY-MM-DD HH:MM:SS)
df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d %H:%M:%S")

# Connect to database
conn = sqlite3.connect("weather.db")

# Insert data into SQLite table
df.to_sql("weather_data", conn, if_exists="replace", index=False)

# Commit and close
conn.commit()
conn.close()
print("CSV data inserted into SQLite successfully!")