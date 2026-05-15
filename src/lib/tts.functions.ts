import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Schema = z.object({
  text: z.string().min(1).max(5000),
  voiceId: z.string().min(1).max(100).optional(),
});

export const synthesizeSpeech = createServerFn({ method: "POST" })
  .inputValidator((input) => Schema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return { error: "ELEVENLABS_API_KEY not configured", audio: null as string | null };
    }
    const voiceId = data.voiceId ?? "JBFqnCBsd6RMkjVDRZzb"; // George
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: data.text,
          model_id: "eleven_turbo_v2_5",
        }),
      },
    );
    if (!res.ok) {
      const err = await res.text();
      return { error: `TTS failed [${res.status}]: ${err.slice(0, 200)}`, audio: null as string | null };
    }
    const buf = await res.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");
    return { error: null as string | null, audio: base64 };
  });