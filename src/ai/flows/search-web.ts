
'use server';

/**
 * @fileOverview An AI tool for searching the web.
 *
 * This file defines the 'searchWeb' tool, which can be used by a Genkit
 * flow to fetch information from the internet.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const searchWeb = ai.defineTool({
  name: 'searchWeb',
  description: 'Searches the web for information on a given topic. Use this to find current events, product information, or general knowledge.',
  inputSchema: z.object({
    query: z.string().describe("The search query."),
  }),
  outputSchema: z.string(),
},
async (input) => {
    try {
      // Using a simple DuckDuckGo proxy for demonstration.
      // In a real app, you might use a more robust search API like Google Custom Search or Tavily.
      const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(input.query)}&format=json&pretty=1&no_html=1&skip_disambig=1`);
      if (!response.ok) {
        return `Error searching web: ${response.statusText}`;
      }
      const searchData = await response.json();

      if (searchData.AbstractText) {
          return `Search Result for "${input.query}": ${searchData.AbstractText}`;
      }
      
      if (searchData.RelatedTopics && searchData.RelatedTopics.length > 0) {
        const topResult = searchData.RelatedTopics[0];
        if (topResult.Text) {
             return `Search Result for "${input.query}": ${topResult.Text}`;
        }
      }

      return `Couldn't find a direct answer for "${input.query}". Try rephrasing the question.`;
    } catch (error) {
      console.error('Error in searchWeb tool:', error);
      return 'An unexpected error occurred while searching the web.';
    }
  }
);
