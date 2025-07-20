
import { config } from 'dotenv';
config();

import '@/ai/flows/interpret-voice-command.ts';
// The tools are now imported by interpret-voice-command.ts
// so these explicit imports are no longer needed here.
// import '@/ai/flows/get-weather-information.ts';
// import '@/ai/flows/compose-email.ts';
import '@/ai/flows/text-to-speech.ts';
