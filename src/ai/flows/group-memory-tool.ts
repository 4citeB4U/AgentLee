
'use server';

/**
 * @fileOverview A tool for managing group conversation memory using Firestore.
 * This translates the logic from the user's Python script into TypeScript.
 *
 * - saveMessage - Saves a message to the group transcript and updates speaker memory.
 * - buildGroupPrompt - Builds a prompt with recent conversation history for the agent.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, setDoc, serverTimestamp, query, orderBy, limit, getDocs } from 'firebase/firestore';

// Initialize Firebase Admin SDK for server-side operations
// Note: This uses a simpler client-side initialization for demonstration.
// In a production environment, you would use firebase-admin.
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const store = getFirestore(app);

const GROUPS = 'groups';
const TRANSCRIPTS = 'transcript';
const MEMBERS = 'members';

const SaveMessageInputSchema = z.object({
    groupId: z.string().describe("The ID of the group conversation."),
    userId: z.string().describe("The unique ID of the user speaking."),
    speakerName: z.string().describe("The name of the speaker."),
    messageText: z.string().describe("The text of the message spoken."),
});
export type SaveMessageInput = z.infer<typeof SaveMessageInputSchema>;


export const saveMessage = ai.defineTool({
    name: 'saveMessageToGroupMemory',
    description: "Saves a single message to a group's conversation transcript and updates the speaker's memory in Firestore.",
    inputSchema: SaveMessageInputSchema,
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
}, async (input) => {
    const { groupId, userId, speakerName, messageText } = input;
    const groupRef = doc(store, GROUPS, groupId);
    
    // 1. Save to group transcript
    const transcriptRef = collection(groupRef, TRANSCRIPTS);
    await addDoc(transcriptRef, {
        timestamp: serverTimestamp(),
        speaker: speakerName,
        text: messageText,
    });

    // 2. Save/update speaker-specific memory
    const memberRef = doc(groupRef, MEMBERS, userId);
    await setDoc(memberRef, {
        name: speakerName,
        last_spoke: serverTimestamp(),
        last_question: messageText,
    }, { merge: true });

    return { success: true, message: `Message from ${speakerName} saved.` };
});

const BuildGroupPromptInputSchema = z.object({
    groupId: z.string().describe("The ID of the group conversation to build the prompt for."),
});
export type BuildGroupPromptInput = z.infer<typeof BuildGroupPromptInputSchema>;


export const buildGroupTranscript = ai.defineTool({
    name: 'buildGroupTranscript',
    description: 'Retrieves the recent transcript for a group conversation.',
    inputSchema: BuildGroupPromptInputSchema,
    outputSchema: z.string().describe("The recent conversation history as a formatted string."),
}, async ({ groupId }) => {
    const groupRef = doc(store, GROUPS, groupId);
    const transcriptQuery = query(collection(groupRef, TRANSCRIPTS), orderBy("timestamp", "desc"), limit(15));
    
    const snapshot = await getDocs(transcriptQuery);
    const transcript = snapshot.docs.map(doc => doc.data() as { speaker: string, text: string });

    if (transcript.length === 0) {
        return "The conversation has just started.";
    }

    let history = "Conversation History:\n";
    for (const entry of transcript.reverse()) { // reverse to show oldest first
        history += `${entry.speaker}: ${entry.text}\n`;
    }
    
    return history;
});
