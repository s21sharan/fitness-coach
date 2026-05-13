import { z } from "zod";
import { tool } from "ai";

export function promptCheckinTool() {
  return tool({
    description:
      "Trigger a physique check-in card in the chat. Use when you've determined it's time for the user to do a progress photo check-in. The card will appear with upload slots for front, side, and back photos.",
    inputSchema: z.object({
      message: z
        .string()
        .describe("A brief motivating message to show with the check-in prompt"),
    }),
    execute: async ({ message }) => {
      return {
        type: "checkin_prompt",
        date: new Date().toISOString().slice(0, 10),
        message,
      };
    },
  });
}
