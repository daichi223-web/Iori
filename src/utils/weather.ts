export interface WeatherData {
  latitude: number;
  longitude: number;
  current_weather: {
    temperature: number;
    windspeed: number;
    winddirection: number;
    weathercode: number;
    time: string;
  };
}

export async function getWeather(
  latitude: number,
  longitude: number
): Promise<WeatherData> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json() as WeatherData;
    
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch weather data: ${error.message}`);
    }
    throw new Error('Failed to fetch weather data: Unknown error');
  }
}