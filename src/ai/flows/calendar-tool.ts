
'use server';

/**
 * @fileOverview An AI tool for managing a simple calendar.
 *
 * This file defines tools for listing and creating calendar events.
 * It uses a simple in-memory array to store events for demonstration purposes.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Simple in-memory storage for calendar events for this demo.
// In a real app, this would be a database or a third-party calendar service.
type CalendarEvent = {
  title: string;
  time: string; // e.g., "Tomorrow at 10 AM", "2024-12-25 18:00"
  description?: string;
};

const calendar: CalendarEvent[] = [
    { title: "Team Sync", time: "Today at 11:00 AM", description: "Weekly team synchronization meeting." },
    { title: "Project Phoenix Demo", time: "Tomorrow at 2:00 PM", description: "Final demo for the project." },
];

export const listCalendarEvents = ai.defineTool({
    name: 'listCalendarEvents',
    description: 'Lists all upcoming events from the calendar.',
    inputSchema: z.object({}),
    outputSchema: z.array(z.object({
        title: z.string(),
        time: z.string(),
        description: z.string().optional(),
    })),
}, async () => {
    console.log("Tool: listCalendarEvents invoked.");
    // In a real app, you would fetch this from a database or calendar API.
    return calendar;
});


export const createCalendarEvent = ai.defineTool({
    name: 'createCalendarEvent',
    description: 'Creates a new event and adds it to the calendar.',
    inputSchema: z.object({
        title: z.string().describe("The title of the event."),
        time: z.string().describe("The date and time of the event, e.g., 'Tomorrow at 10 AM', 'Friday at 5pm'."),
        description: z.string().optional().describe("A brief description of the event."),
    }),
    outputSchema: z.object({
        success: z.boolean(),
        message: z.string(),
    }),
}, async (input) => {
    console.log(`Tool: createCalendarEvent invoked with:`, input);
    
    // Add the new event to our in-memory calendar
    calendar.push({
        title: input.title,
        time: input.time,
        description: input.description,
    });
    
    console.log("Current calendar state:", calendar);
    
    return {
        success: true,
        message: `Successfully scheduled "${input.title}" for ${input.time}.`,
    };
});
