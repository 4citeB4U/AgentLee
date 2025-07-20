
'use server';

import { getWeatherInformation } from '@/ai/flows/get-weather-information';
import { composeEmail } from '@/ai/flows/compose-email';
import { textToSpeech } from '@/ai/flows/text-to-speech';

function parseEmailCommand(command: string): { recipient: string; instructions: string } | null {
  const emailRegex = /email\s+(?:to\s+)?([^:]+):\s*(.*)/i;
  const match = command.match(emailRegex);

  if (match && match[1] && match[2]) {
    let recipient = match[1].trim();
    const instructions = match[2].trim();
    
    // Simple logic to handle named recipients vs. email addresses
    if (recipient.toLowerCase() === 'dispatch') {
        recipient = 'dispatch@example.com';
    } else if (!recipient.includes('@')) {
        // For demonstration, we'll format names into a mock email.
        recipient = `${recipient.toLowerCase().replace(/\s+/g, '.')}@example.com`;
    }

    return { recipient, instructions };
  }
  return null;
}

type CommandResponse = {
  text: string;
  audio: string | null;
};

async function generateResponse(text: string): Promise<CommandResponse> {
  try {
    const ttsResult = await textToSpeech({ textToSpeak: text });
    return {
      text,
      audio: ttsResult.audioDataUri,
    };
  } catch (ttsError) {
    console.error('Error generating speech:', ttsError);
    // Return text response even if TTS fails
    return {
      text,
      audio: null,
    };
  }
}

export async function processVoiceCommand(command: string): Promise<CommandResponse> {
  const lowerCaseCommand = command.toLowerCase();

  try {
    if (lowerCaseCommand.includes('weather')) {
      const result = await getWeatherInformation({ query: command });
      return generateResponse(result.weatherInformation);
    }

    if (lowerCaseCommand.startsWith('email')) {
      const emailDetails = parseEmailCommand(command);
      if (emailDetails) {
        const result = await composeEmail(emailDetails);
        const responseText = `OK. I've composed an email to ${emailDetails.recipient}. Subject: "${result.subject}". The content is: "${result.body}". Ready to send?`;
        return generateResponse(responseText);
      } else {
        const responseText = "I can help with that. Please state the recipient and the message, like 'Email support: my account is locked.'";
        return generateResponse(responseText);
      }
    }
    
    const fallbackText = "I can currently provide weather information or compose emails for you. How can I help?";
    return generateResponse(fallbackText);

  } catch (error) {
    console.error('Error processing voice command:', error);
    const errorText = "I'm sorry, but I encountered an error while trying to process your request. Please try again.";
    // Still try to generate TTS for the error message
    return generateResponse(errorText);
  }
}

    