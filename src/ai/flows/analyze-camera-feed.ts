
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
  description: 'Analyzes a provided image and answers a question about it, or provides a general description if no question is asked. Use this tool when the user provides an image and asks a question about what is in it, or to understand the visual context.',
  inputSchema: z.object({
    photoDataUri: z
      .string()
      .describe(
        "A photo from the camera, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
      ),
    question: z.string().describe('The user\'s question about the image. If empty, a general description should be returned.'),
  }),
  outputSchema: z.string().describe("A descriptive answer to the user's question about the image, or a general description of the scene."),
},
async (input) => {
    const { photoDataUri, question } = input;

    const promptText = question
      ? `You are looking at an image from a user's camera. The user's question is: "${question}". Provide a direct, conversational answer.`
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
