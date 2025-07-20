
'use server';

/**
 * @fileOverview An AI tool for analyzing an image from the camera feed.
 *
 * This file defines the 'analyzeCameraFeed' tool, which allows the agent to "see"
 * and answer questions about an image snapshot, or simply describe what it sees.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

export const analyzeCameraFeed = ai.defineTool({
  name: 'analyzeCameraFeed',
  description: 'Analyzes a provided image and returns a one-sentence description of what is in it. This tool provides visual context to the agent.',
  inputSchema: z.object({
    photoDataUri: z
      .string()
      .describe(
        "A photo from the camera, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
      ),
    question: z.string().optional().describe('An optional user question about the image. The tool will provide a general description regardless of the question, but the question provides context for what is important to describe.'),
  }),
  outputSchema: z.string().describe("A single, concise sentence describing the main subject and setting of the image."),
},
async (input) => {
    const { photoDataUri, question } = input;

    const promptText = question
      ? `You are looking at an image from a user's camera. The user's question is: "${question}". Based on their question, provide a one-sentence summary of the image that would be most helpful to answer it.`
      : `You are looking at an image from a user's camera. Briefly describe the main subject and setting in a single, concise sentence.`;

    const llmResponse = await ai.generate({
        prompt: [
            { text: promptText },
            { media: { url: photoDataUri } },
        ],
        model: 'googleai/gemini-2.0-flash'
    });

    return llmResponse.text;
});
