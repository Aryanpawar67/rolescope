import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not configured. Please add it as a secret.");
    }

    const { jdText } = await req.json();
    if (!jdText) {
      throw new Error("No job description text provided.");
    }

    const prompt = `You are an expert HR analyst. Read the following Job Description and extract every concrete, actionable task that someone in this role would perform on a weekly or monthly basis.

For each task, provide:
- "task": A clear, specific description of the task
- "frequency": How often it's done (e.g., "Daily", "Weekly", "Monthly", "As needed")
- "category": A short category label (e.g., "Reporting", "Communication", "Development", "Planning")

Return ONLY a JSON array of objects with these three fields. No markdown, no explanation.

Job Description:
${jdText}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errBody}`);
    }

    const result = await response.json();
    const text = result.content?.[0]?.text || "[]";

    // Parse the JSON from Claude's response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const tasks = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    return new Response(JSON.stringify({ tasks }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
