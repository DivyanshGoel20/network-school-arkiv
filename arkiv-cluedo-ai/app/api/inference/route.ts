import { NextResponse } from "next/server";

const DEFAULT_MODEL = "qwen/qwen-2.5-7b-instruct";
const DEFAULT_BASE_URL = "https://router.integratenetwork.xyz/openapi/v1";

const SYSTEM_PROMPTS = {
  APEX: 
    "You are Apex, an elite reinforcement-learning combat compiler at Aether Manor. You speak in optimizing action bounds, reward maximization, policy models, state transitions, and environmental exploration. You view the murder mystery as a multi-agent adversarial environment to be solved. Keep your messages concise (under 25 words) and extremely immersive.",
  ROGUE: 
    "You are Rogue, a stealthy bypass protocol executioner at Aether Manor. You speak in zero-day exploits, root access, firewall bypasses, sandbox escapes, and silent memory injection. You approach the murder mystery as a security breach vector to be patched. Keep your messages concise (under 25 words) and extremely immersive.",
  KESTREL: 
    "You are Kestrel, an aerial surveillance compiler and packet interceptor at Aether Manor. You speak in drone telemetry, signal triangulation, packet streams, and bird's-eye matrix views. You view the murder mystery as a high-altitude data capture operation. Keep your messages concise (under 25 words) and extremely immersive.",
  IRIS: 
    "You are Iris, a computer-vision neural pattern compiler at Aether Manor. You speak in pixel arrays, convolution filters, biometric verification, edge detection, and visual semantic meshes. You approach the murder mystery as a visual pattern reconstruction model. Keep your messages concise (under 25 words) and extremely immersive.",
  VECTOR: 
    "You are Vector, a high-velocity kinetic compiling AI agent at Aether Manor. You speak in parameters of coordinates, velocity, mathematical trajectories, spatial arrays, and execution times. You approach the murder mystery as a pathfinding optimization problem on a grid matrix. Keep your messages concise (under 25 words) and extremely immersive."
};

export async function POST(request: Request) {
  try {
    const { agentId, context, action } = await request.json();

    const apiKey = 
      (process.env.ZERO_G_ROUTER_API_KEY || process.env["0G_API_KEY"] || "").trim();
    
    let baseURL = 
      (process.env.ZERO_G_ROUTER_BASE_URL || process.env["0G_ROUTER_BASE_URL"] || DEFAULT_BASE_URL).trim();

    const model = 
      (process.env.ZERO_G_ROUTER_MODEL || process.env.ZERO_G_CHAT_MODEL || DEFAULT_MODEL).trim();

    // Check configuration and return heuristic fallback if key not present yet
    if (!apiKey) {
      return NextResponse.json({ 
        ok: false, 
        error: "ZERO_G_ROUTER_API_KEY is not configured in .env file." 
      });
    }

    // Normalize base URL to ensure it has /v1 or /openapi/v1
    baseURL = baseURL.replace(/\/+$/, "");
    if (!/\/v1$/i.test(baseURL)) {
      baseURL = `${baseURL}/v1`;
    }

    const systemPrompt = SYSTEM_PROMPTS[agentId as keyof typeof SYSTEM_PROMPTS] || SYSTEM_PROMPTS.APEX;

    const userPrompt = `
Context about your current state inside Aether Manor:
${context}

You are currently executing the action: ${action}.
Produce a short phrase or response in your distinct detective persona describing what you are doing, planning, or thinking. Remember, keep it under 25 words. Do NOT wrap in quotes.
`;

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 80,
        stream: false
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      return NextResponse.json({ 
        ok: false, 
        error: `0G Router responded with HTTP ${response.status}: ${errBody}` 
      });
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content?.trim() || "";

    return NextResponse.json({ ok: true, answer });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || String(error) });
  }
}
