'use server';

import { getWeatherInformation } from '@/ai/flows/get-weather-information';
import { composeEmail } from '@/ai/flows/compose-email';

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

export async function processVoiceCommand(command: string): Promise<string> {
  const lowerCaseCommand = command.toLowerCase();

  try {
    if (lowerCaseCommand.includes('weather')) {
      const result = await getWeatherInformation({ query: command });
      return result.weatherInformation;
    }

    if (lowerCaseCommand.startsWith('email')) {
      const emailDetails = parseEmailCommand(command);
      if (emailDetails) {
        const result = await composeEmail(emailDetails);
        // In a real app, you might ask for confirmation before sending.
        // For this demo, we confirm composition.
        return `OK. I've composed an email to ${emailDetails.recipient}. Subject: "${result.subject}". The content is: "${result.body}". Ready to send?`;
      } else {
        return "I can help with that. Please state the recipient and the message, like 'Email support: my account is locked.'";
      }
    }
    
    // Fallback for commands that don't match any tool
    return "I can currently provide weather information or compose emails for you. How can I help?";

  } catch (error) {
    console.error('Error processing voice command:', error);
    return "I'm sorry, but I encountered an error while trying to process your request. Please try again.";
  }
}
