'use server';

/**
 * @fileOverview An AI agent for retrieving weather information.
 *
 * - getWeatherInformation - A function that retrieves weather information based on a user query.
 * - GetWeatherInformationInput - The input type for the getWeatherInformation function.
 * - GetWeatherInformationOutput - The return type for the getWeatherInformation function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GetWeatherInformationInputSchema = z.object({
  query: z.string().describe('The query for weather information, e.g., \'weather in Milwaukee\''),
});
export type GetWeatherInformationInput = z.infer<typeof GetWeatherInformationInputSchema>;

const GetWeatherInformationOutputSchema = z.object({
  weatherInformation: z.string().describe('The weather information retrieved from the weather API.'),
});
export type GetWeatherInformationOutput = z.infer<typeof GetWeatherInformationOutputSchema>;

export async function getWeatherInformation(input: GetWeatherInformationInput): Promise<GetWeatherInformationOutput> {
  return getWeatherInformationFlow(input);
}

const getWeather = ai.defineTool({
  name: 'getWeather',
  description: 'Retrieves weather information for a given location.',
  inputSchema: z.object({
    location: z.string().describe('The location to retrieve weather information for, e.g., \'Milwaukee\''),
  }),
  outputSchema: z.string(),
},
async (input) => {
    // Use wttr.in as the weather API
    const response = await fetch(`https://wttr.in/${input.location}?format=%l+%t+%w`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const weatherData = await response.text();
    return weatherData;
  }
);

const getWeatherInformationPrompt = ai.definePrompt({
  name: 'getWeatherInformationPrompt',
  tools: [getWeather],
  input: {schema: GetWeatherInformationInputSchema},
  output: {schema: GetWeatherInformationOutputSchema},
  prompt: `You are Agent Lee, a helpful assistant. The user is asking for weather information. Use the getWeather tool to retrieve the weather information and respond to the user in a natural language.

User query: {{{query}}}`,
});

const getWeatherInformationFlow = ai.defineFlow(
  {
    name: 'getWeatherInformationFlow',
    inputSchema: GetWeatherInformationInputSchema,
    outputSchema: GetWeatherInformationOutputSchema,
  },
  async input => {
    const {output} = await getWeatherInformationPrompt(input);
    return output!;
  }
);
