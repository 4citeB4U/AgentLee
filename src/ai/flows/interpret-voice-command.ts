'use server';

/**
 * @fileOverview Interprets voice commands using Google Gemini.
 *
 * - interpretVoiceCommand - A function that interprets voice commands.
 * - InterpretVoiceCommandInput - The input type for the interpretVoiceCommand function.
 * - InterpretVoiceCommandOutput - The return type for the interpretVoiceCommand function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const InterpretVoiceCommandInputSchema = z.object({
  voiceCommand: z.string().describe('The voice command to interpret.'),
});
export type InterpretVoiceCommandInput = z.infer<typeof InterpretVoiceCommandInputSchema>;

const InterpretVoiceCommandOutputSchema = z.object({
  intent: z.string().describe('The intent of the voice command.'),
  action: z.string().describe('The action to take based on the voice command.'),
});
export type InterpretVoiceCommandOutput = z.infer<typeof InterpretVoiceCommandOutputSchema>;

export async function interpretVoiceCommand(input: InterpretVoiceCommandInput): Promise<InterpretVoiceCommandOutput> {
  return interpretVoiceCommandFlow(input);
}

const prompt = ai.definePrompt({
  name: 'interpretVoiceCommandPrompt',
  input: {schema: InterpretVoiceCommandInputSchema},
  output: {schema: InterpretVoiceCommandOutputSchema},
  prompt: `You are Agent Lee, a helpful AI assistant.  Please interpret the following voice command and determine the intent and action to take.\n\nVoice Command: {{{voiceCommand}}}`,
});

const interpretVoiceCommandFlow = ai.defineFlow(
  {
    name: 'interpretVoiceCommandFlow',
    inputSchema: InterpretVoiceCommandInputSchema,
    outputSchema: InterpretVoiceCommandOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
