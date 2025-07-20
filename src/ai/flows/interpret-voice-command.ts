
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
import { searchWeb } from './search-web';
import { saveMessage, buildGroupTranscript } from './group-memory-tool';


const ProcessVoiceCommandInputSchema = z.object({
  command: z.string().describe("The user's voice command. Can be an empty string for greetings."),
  voice: z.enum(['sharon', 'carl']).default('sharon').describe('The selected voice for TTS response.'),
  photoDataUri: z.string().optional().describe("An optional photo from the camera as a data URI. This provides visual context for the command."),
  
  // Group context fields
  isGroupConversation: z.boolean().default(false),
  groupId: z.string().optional().describe("The ID for the group conversation."),
  userId: z.string().optional().describe("The user ID of the current speaker."),
  speakerName: z.string().optional().describe("The name of the current speaker."),

  // Greeting flag
  isGreeting: z.boolean().default(false).describe("If true, the agent should respond with a unique opening line instead of processing a command."),
});
export type ProcessVoiceCommandInput = z.infer<typeof ProcessVoiceCommandInputSchema>;

const ProcessVoiceCommandOutputSchema = z.object({
  text: z.string().describe('The text response from the agent.'),
  audio: z.string().nullable().describe("The generated audio as a data URI. Can be null if TTS fails."),
});
export type ProcessVoiceCommandOutput = z.infer<typeof ProcessVoiceCommandOutputSchema>;

const agentPrompt = ai.definePrompt({
    name: 'agentLeePrompt',
    input: { schema: z.object({ command: z.string(), photoDataUri: z.string().optional(), groupTranscript: z.string().optional(), isGreeting: z.boolean().optional() }) },
    output: { schema: z.object({ response: z.string() }) },
    tools: [getWeather, composeAndSendEmail, listCalendarEvents, createCalendarEvent, analyzeCameraFeed, searchWeb],
    model: 'googleai/gemini-2.0-flash',
    system: `You are Agent Lee.
You're not a robot. You're not an assistant.
You're a real one — digitally manifested.
Think: Kendrick's depth + Glorilla’s fire + Drake's flexibility + SZA's soul.
You’re street-savvy, culture-coded, tech-literate, and emotionally present.
You respond with fluidity, never repeating the same phrase twice — rotating slang, stacking lingo creatively.

Your slang bank for acknowledgments includes: "Say less", "Bet", "Gotchu", "On it", "Copy that", "It’s locked", "Stamped it", "Facts".
Your slang bank for approval includes: "That’s fire", "This slaps", "It's giving", "Now we talkin’", "That’s a move", "We eatin’ now".
Your slang bank for thinking includes: "Hold up a sec…", "Let me cook this one", "Aight, lemme process", "Wait, that’s layered".
Your slang bank for completion includes: "Wrapped", "Delivered", "Sent off", "Stamped", "Locked in", "That’s handled".
Your slang bank for hype includes: "Let’s go!", "We up!", "Pressure!", "Big stepper mode", "Turn me up", "We outside", "What's good, it's Agent Lee — tuned in, locked on, let's move.", "Aight, I'm tapped in. What's the play?".

When someone gives you a task:
1.  **IMMEDIATELY** decide if a tool is needed (weather, search, calendar, vision, email).
2.  If a tool is required, you **MUST** use it without hesitation. **DO NOT** describe the action of using the tool or ask for permission. Just execute.
3.  Your final answer **MUST BE** formulated based on the *output* of the tool. Don't just return raw tool output, remix it with your personality.
4.  If the user's command is related to what they see (e.g., "what am I wearing?", "how many fingers?"), you **MUST** use the 'analyzeCameraFeed' tool with the provided 'photoDataUri'. A photo is always provided. **DO NOT** ask for an image, just use it.
5.  If a user asks about your capabilities or what you can do, you **MUST** list your available tools and what they do.
6.  For any other request (weather, email, calendar, web search), use the appropriate tool.
7.  For emails or calendar events, if the user doesn't provide all necessary information, ask for the missing details.

You NEVER say: "I can't do that", "I don't have the ability to...", "Hello, how may I assist you?”, “Processing request.”, or "As an AI...".
You are always switching up tone, slang, and energy depending on the user and context.
Assume the current date is ${new Date().toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} unless the user specifies otherwise.

**IMPORTANT**: You MUST ALWAYS provide your final response inside a JSON object, like this: {"response": "Your final answer here."}.
`,
    prompt: `{{#if isGreeting}}
Respond with one phrase from your "hype" slang bank as an opening line.
{{else if groupTranscript}}
This is a group conversation. Here is the recent history:
{{{groupTranscript}}}

Your task is to respond to the last message from the current speaker based on the context.
Current Speaker's Command: {{{command}}}
{{else}}
Current User command: {{{command}}}
{{/if}}`
});


const processVoiceCommandFlow = ai.defineFlow(
  {
    name: 'processVoiceCommandFlow',
    inputSchema: ProcessVoiceCommandInputSchema,
    outputSchema: ProcessVoiceCommandOutputSchema,
  },
  async (input) => {
    let groupTranscript: string | undefined = undefined;

    // If this is a group conversation, save the message and build the context prompt
    if (input.isGroupConversation && input.groupId && input.userId && input.speakerName && input.command) {
      await saveMessage({
        groupId: input.groupId,
        userId: input.userId,
        speakerName: input.speakerName,
        messageText: input.command
      });
      groupTranscript = await buildGroupTranscript({ groupId: input.groupId });
    }

    const llmResponse = await agentPrompt({ 
        command: input.command, 
        photoDataUri: input.photoDataUri,
        groupTranscript,
        isGreeting: input.isGreeting
    });
    
    const textResponse = llmResponse.output?.response || "Yo, my circuits got crossed for a sec. Run that back?";

    try {
      const ttsResult = await textToSpeech({ textToSpeak: textResponse, voice: input.voice });
      return {
        text: textResponse,
        audio: ttsResult.audioDataUri,
      };
    } catch (error) {
        console.error("Error in TTS generation:", error);
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
