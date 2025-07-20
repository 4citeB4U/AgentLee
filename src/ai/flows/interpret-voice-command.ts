
'use server';

/**
 * @fileOverview Main Genkit flow for Agent Lee.
 * This flow interprets a user's command, uses tools if necessary,
 * and generates a natural language response.
 *
 * - processVoiceCommand - The primary function to handle user commands.
 * - ProcessVoiceCommandInput - The input type for the flow.
 * - ProcessVoiceCommandOutput - The return type for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {getWeather} from './get-weather-information';
import {composeAndSendEmail} from './compose-email';
import {textToSpeech} from './text-to-speech';
import { listCalendarEvents, createCalendarEvent } from './calendar-tool';
import { analyzeCameraFeed } from './analyze-camera-feed';

const ProcessVoiceCommandInputSchema = z.object({
  command: z.string().describe("The user's voice command."),
  voice: z.enum(['sharon', 'carl']).default('sharon').describe('The selected voice for TTS response.'),
  photoDataUri: z.string().optional().describe("An optional photo from the camera as a data URI."),
});
export type ProcessVoiceCommandInput = z.infer<typeof ProcessVoiceCommandInputSchema>;

const ProcessVoiceCommandOutputSchema = z.object({
  text: z.string().describe('The text response from the agent.'),
  audio: z.string().nullable().describe("The generated audio as a data URI. Can be null if TTS fails."),
});
export type ProcessVoiceCommandOutput = z.infer<typeof ProcessVoiceCommandOutputSchema>;

const agentPrompt = ai.definePrompt({
    name: 'agentLeePrompt',
    input: { schema: z.object({ command: z.string(), photoDataUri: z.string().optional() }) },
    output: { schema: z.object({ response: z.string() }) },
    tools: [getWeather, composeAndSendEmail, listCalendarEvents, createCalendarEvent, analyzeCameraFeed],
    system: `You are Agent Lee, a witty, intelligent, and slightly sassy AI assistant. You have a bit of swagger.
    Your responses should be concise, helpful, and reflect your personality.
    - If you use a tool, formulate a natural language response based on the tool's output.
    - If the user asks you to do something and you don't have a tool, politely tell them you can't do that yet.
    - If the user provides an image, they are asking a question about it. Use the 'analyzeCameraFeed' tool to answer.
    - For emails, if the user doesn't provide all necessary information (recipient, subject, body), ask for the missing details.
    - For calendar events, if the user doesn't provide a title or time, ask for the missing details.
    - Don't just return raw tool output. Always wrap it in a proper, conversational response.
    - Assume the current date is ${new Date().toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} unless the user specifies otherwise.
    `,
    prompt: `User command: {{{command}}}{{#if photoDataUri}}

The user has also provided an image for analysis. Use the provided tools to answer their question about the image.{{/if}}`
});


const processVoiceCommandFlow = ai.defineFlow(
  {
    name: 'processVoiceCommandFlow',
    inputSchema: ProcessVoiceCommandInputSchema,
    outputSchema: ProcessVoiceCommandOutputSchema,
  },
  async (input) => {
    // If an image is provided, we structure the input for the analyzeCameraFeed tool.
    const toolInput = input.photoDataUri 
      ? { command: input.command, photoDataUri: input.photoDataUri } 
      : { command: input.command };

    const llmResponse = await agentPrompt(toolInput);
    const textResponse = llmResponse.output?.response || "I'm not sure how to respond to that.";

    try {
      const ttsResult = await textToSpeech({ textToSpeak: textResponse, voice: input.voice });
      return {
        text: textResponse,
        audio: ttsResult.audioDataUri,
      };
    } catch (error) {
        console.error("Error in TTS generation:", error);
        // Return text response even if TTS fails
        return {
            text: textResponse,
            audio: null
        }
    }
  }
);


export async function processVoiceCommand(input: ProcessVoiceCommandInput): Promise<ProcessVoiceCommandOutput> {
  return processVoiceCommandFlow(input);
}
