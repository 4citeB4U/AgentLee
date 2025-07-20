'use server';

/**
 * @fileOverview An AI tool for composing and "sending" emails.
 *
 * This file defines the 'composeAndSendEmail' tool, which can be used by a
 * Genkit flow to draft an email to a recipient with a given subject and body.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const composeAndSendEmail = ai.defineTool({
    name: 'composeAndSendEmail',
    description: 'Composes and sends an email. The user must provide the recipient, subject, and body.',
    inputSchema: z.object({
        recipient: z.string().describe("The recipient's email address."),
        subject: z.string().describe('The subject of the email.'),
        body: z.string().describe('The content of the email body.'),
    }),
    outputSchema: z.string(),
},
async (input) => {
    // In a real application, this would integrate with an email service (e.g., SendGrid, Nodemailer).
    // For this demo, we'll just log the action and return a success message.
    console.log(`Composing email to: ${input.recipient}`);
    console.log(`Subject: ${input.subject}`);
    console.log(`Body: ${input.body}`);
    
    return `Successfully composed an email to ${input.recipient} with the subject "${input.subject}".`;
});
