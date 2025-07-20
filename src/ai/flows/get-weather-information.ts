'use server';

/**
 * @fileOverview An AI tool for retrieving weather information.
 *
 * This file defines the 'getWeather' tool, which can be used by a Genkit
 * flow to fetch current weather data for a specified location.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const getWeather = ai.defineTool({
  name: 'getWeather',
  description: 'Retrieves current weather information for a given location using the wttr.in service.',
  inputSchema: z.object({
    location: z.string().describe("The city and state, e.g., San Francisco, CA, for which to get the weather."),
  }),
  outputSchema: z.string(),
},
async (input) => {
    try {
      // Use wttr.in as the weather API
      const response = await fetch(`https://wttr.in/${input.location}?format=%l:+%t+%w`);
      if (!response.ok) {
        return `Error fetching weather: ${response.statusText}`;
      }
      const weatherData = await response.text();
      return weatherData;
    } catch (error) {
      console.error('Error in getWeather tool:', error);
      return 'An unexpected error occurred while fetching weather data.';
    }
  }
);
