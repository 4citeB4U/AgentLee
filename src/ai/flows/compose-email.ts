// src/ai/flows/compose-email.ts
'use server';

/**
 * @fileOverview An email composition AI agent.
 *
 * - composeEmail - A function that handles the email composition process.
 * - ComposeEmailInput - The input type for the composeEmail function.
 * - ComposeEmailOutput - The return type for the composeEmail function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ComposeEmailInputSchema = z.object({
  instructions: z.string().describe('Instructions for composing the email.'),
  recipient: z.string().describe('The recipient email address.'),
});
export type ComposeEmailInput = z.infer<typeof ComposeEmailInputSchema>;

const ComposeEmailOutputSchema = z.object({
  subject: z.string().describe('The subject of the email.'),
  body: z.string().describe('The body of the email.'),
});
export type ComposeEmailOutput = z.infer<typeof ComposeEmailOutputSchema>;

export async function composeEmail(input: ComposeEmailInput): Promise<ComposeEmailOutput> {
  return composeEmailFlow(input);
}

const prompt = ai.definePrompt({
  name: 'composeEmailPrompt',
  input: {schema: ComposeEmailInputSchema},
  output: {schema: ComposeEmailOutputSchema},
  prompt: `You are an AI email assistant.  Please compose an email based on the
following instructions, and return the subject and body.  The email should be
sent to {{recipient}}.

Instructions: {{{instructions}}}`,
});

const composeEmailFlow = ai.defineFlow(
  {
    name: 'composeEmailFlow',
    inputSchema: ComposeEmailInputSchema,
    outputSchema: ComposeEmailOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
