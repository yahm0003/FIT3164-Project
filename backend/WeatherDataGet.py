import openmeteo_requests
import requests_cache
import pandas as pd
from retry_requests import retry


#Setup the Open-Meteo API client with cache and retry on error
cache_session = requests_cache.CachedSession('.cache', expire_after=-1)
retry_session = retry(cache_session, retries=5, backoff_factor=0.2)
openmeteo = openmeteo_requests.Client(session=retry_session)


# Define the API URL and parameters
url = "https://archive-api.open-meteo.com/v1/archive"
params = {
    "latitude": [-37.814, -33.8678, -35.2835, -27.4679, -34.9287, -31.9522],
    "longitude": [144.9633, 151.2073, 149.1281, 153.0281, 138.5986, 115.8614],
    "start_date": "2000-01-01",
    "end_date": "2025-02-25",
    "daily": ["weather_code", "temperature_2m_max", "temperature_2m_min", "temperature_2m_mean", "apparent_temperature_max", "apparent_temperature_min", "apparent_temperature_mean", "sunrise","sunset",
              "daylight_duration","sunshine_duration", "precipitation_sum", "rain_sum", "snowfall_sum","precipitation_hours"],
    "timezone": "Australia/Sydney"
}
responses = openmeteo.weather_api(url, params=params)


# Initialize an empty list to store data from all locations
all_daily_data = []


# Loop through all responses (for each location)
for response in responses:
    latitude = response.Latitude()
    longitude = response.Longitude()


    # Process daily data for each location
    daily = response.Daily()
    daily_data = {
        "date": pd.date_range(
            start=pd.to_datetime(daily.Time(), unit="s", utc=True),
            end=pd.to_datetime(daily.TimeEnd(), unit="s", utc=True),
            freq=pd.Timedelta(seconds=daily.Interval()),
            inclusive="left"
        ),
        "latitude": [latitude] * len(daily.Variables(0).ValuesAsNumpy()),
        "longitude": [longitude] * len(daily.Variables(0).ValuesAsNumpy()),
        "weather_code": daily.Variables(0).ValuesAsNumpy(),
        "temperature_2m_max": daily.Variables(1).ValuesAsNumpy(),
        "temperature_2m_min": daily.Variables(2).ValuesAsNumpy(),
        "temperature_2m_mean": daily.Variables(3).ValuesAsNumpy(),
        "apparent_temperature_max": daily.Variables(4).ValuesAsNumpy(),
        "apparent_temperature_min": daily.Variables(5).ValuesAsNumpy(),
        "apparent_temperature_mean": daily.Variables(6).ValuesAsNumpy(),
        "sunrise": daily.Variables(7).ValuesAsNumpy(),
        "sunset": daily.Variables(8).ValuesAsNumpy(),
        "daylight_duration": daily.Variables(9).ValuesAsNumpy(),
        "sunshine_duration": daily.Variables(10).ValuesAsNumpy(),
        "precipitation_sum": daily.Variables(11).ValuesAsNumpy(),
        "rain_sum": daily.Variables(12).ValuesAsNumpy(),
        "snowfall_sum": daily.Variables(13).ValuesAsNumpy(),
        "precipitation_hours": daily.Variables(14).ValuesAsNumpy()
    }


    # Append daily data for each location to the list
    all_daily_data.append(pd.DataFrame(daily_data))


# Concatenate data from all locations into a single DataFrame
final_dataframe = pd.concat(all_daily_data, ignore_index=True)


# Save the final DataFrame to a CSV file
final_dataframe.to_csv('all_locations_daily_weather_data.csv', index=False)


print("Data has been saved to 'all_locations_daily_weather_data.csv'")

# 9.6 R Code for Data Cleaning
# # Load necessary libraries
# library(dplyr)
#
#
# # Load the dataset
# data <- read.csv("data.csv")
#
#
# # Handle missing values
# data <- data %>%
#   filter(!is.na(column_name))  # remove rows with missing values in "column_name"
#
#
# # Normalise and standardise data
# data$normalized_column <- (data$column - min(data$column)) / (max(data$column) - min(data$column))
#
#
# # Select relevant columns
# cleaned_data <- data %>%
#   select(timestamp, normalized_column, other_relevant_column)
#
#
# # Save the cleaned dataset
# write.csv(cleaned_data, "cleaned_data.csv", row.names = FALSE)FALSE