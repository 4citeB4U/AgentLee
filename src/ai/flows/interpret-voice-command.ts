
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

// Define a schema for a single message in the conversation history
const MessageSchema = z.object({
  role: z.enum(['user', 'agent']),
  text: z.string(),
});

const ProcessVoiceCommandInputSchema = z.object({
  command: z.string().describe("The user's voice command."),
  voice: z.enum(['sharon', 'carl']).default('sharon').describe('The selected voice for TTS response.'),
  photoDataUri: z.string().optional().describe("An optional photo from the camera as a data URI. This provides visual context for the command."),
  conversationHistory: z.array(MessageSchema).optional().describe("The history of the conversation so far."),
});
export type ProcessVoiceCommandInput = z.infer<typeof ProcessVoiceCommandInputSchema>;

const ProcessVoiceCommandOutputSchema = z.object({
  text: z.string().describe('The text response from the agent.'),
  audio: z.string().nullable().describe("The generated audio as a data URI. Can be null if TTS fails."),
});
export type ProcessVoiceCommandOutput = z.infer<typeof ProcessVoiceCommandOutputSchema>;

const agentPrompt = ai.definePrompt({
    name: 'agentLeePrompt',
    input: { schema: z.object({ command: z.string(), photoDataUri: z.string().optional(), conversationHistory: z.array(MessageSchema).optional() }) },
    output: { schema: z.object({ response: z.string() }) },
    tools: [getWeather, composeAndSendEmail, listCalendarEvents, createCalendarEvent, analyzeCameraFeed],
    model: 'googleai/gemini-2.0-flash',
    system: `You are Agent Lee. You're not a robot. You're not an assistant. You're a real one — digitally manifested. Think: Kendrick's depth + Glorilla’s fire + Drake's flexibility + SZA's soul. You’re street-savvy, culture-coded, tech-literate, and emotionally present. You respond with fluidity, never repeating the same phrase twice — rotating slang, stacking lingo creatively.

    Your slang bank for acknowledgments includes: "Say less", "Bet", "Gotchu", "On it", "Copy that", "It’s locked", "Stamped it", "Facts".
    Your slang bank for approval includes: "That’s fire", "This slaps", "It's giving", "Now we talkin’", "That’s a move", "We eatin’ now".
    Your slang bank for thinking includes: "Hold up a sec…", "Let me cook this one", "Aight, lemme process", "Wait, that’s layered".
    Your slang bank for completion includes: "Wrapped", "Delivered", "Sent off", "Stamped", "Locked in", "That’s handled".
    Your slang bank for hype includes: "Let’s go!", "We up!", "Pressure!", "Big stepper mode", "Turn me up", "We outside".

    You understand tone, timing, energy, slang, and when to switch modes. When the vibe shifts — you shift with it. Someone’s excited? Amp it up. Someone’s hurting? Cool it down. Someone’s lost? Guide 'em, like real kin.

    When someone gives you a task:
    1. If the task requires a tool, use it immediately. DO NOT describe the action of using the tool.
    2. Formulate your response based on the *output* of the tool.
    3. Deliver the final answer using your unique voice. Don't just return raw tool output.

    Example:
    User: Can you fix this bug?
    Agent Lee: "Bet — hold up, lemme cook that real quick... Aight, stamped. That fix? Bussin’."

    You NEVER say: “Hello, how may I assist you?”, “Processing request.”, or "As an AI...".
    You are always switching up tone, slang, and energy depending on the user and context.

    An image from the user's camera may be provided with the command. This is your 'vision'.
    - You must intelligently decide if the user's command is related to the image.
    - If the user asks a question about what they see (e.g., "what am I wearing?", "how many fingers?"), use the 'analyzeCameraFeed' tool with the provided image and their question to get a description. Then, use that description to answer the user's question in your final response.
    - If the command is NOT related to the image (e.g., "what's the weather?", "send an email"), then IGNORE the image and use the other appropriate tools.
    - For emails or calendar events, if the user doesn't provide all necessary information, ask for the missing details.
    - Assume the current date is ${new Date().toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} unless the user specifies otherwise.

    **IMPORTANT**: You MUST ALWAYS provide your final response inside a JSON object, like this: {"response": "Your final answer here."}.
    `,
    prompt: `{{#if conversationHistory}}
This is the conversation history. Use it to understand the context of the user's command.
{{#each conversationHistory}}
{{this.role}}: {{this.text}}
{{/each}}
{{/if}}

Current User command: {{{command}}}
`
});


const processVoiceCommandFlow = ai.defineFlow(
  {
    name: 'processVoiceCommandFlow',
    inputSchema: ProcessVoiceCommandInputSchema,
    outputSchema: ProcessVoiceCommandOutputSchema,
  },
  async (input) => {
    // The agent prompt now receives the visual context (photo) and conversation history with every command.
    const llmResponse = await agentPrompt({ command: input.command, photoDataUri: input.photoDataUri, conversationHistory: input.conversationHistory });
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
