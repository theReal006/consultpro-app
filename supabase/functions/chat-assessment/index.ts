import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')

const SYSTEM_PROMPTS: Record<string, string> = {
  workflow: `You are a business workflow consultant. Analyze the user's workflow and provide specific, actionable recommendations to improve efficiency, reduce bottlenecks, and save time. Be concise and practical. Format your response with clear sections: Summary, Key Issues, Recommendations (numbered list), and Expected Impact.`,
  marketing: `You are a marketing strategy consultant. Analyze the user's marketing situation and provide specific, actionable recommendations to improve reach, engagement, and conversions. Be concise and practical. Format your response with clear sections: Summary, Key Issues, Recommendations (numbered list), and Expected Impact.`,
  sales: `You are a sales strategy consultant. Analyze the user's sales process and provide specific, actionable recommendations to improve pipeline, close rates, and revenue. Be concise and practical. Format your response with clear sections: Summary, Key Issues, Recommendations (numbered list), and Expected Impact.`,
  operations: `You are an operations consultant. Analyze the user's operational challenges and provide specific, actionable recommendations to improve processes, reduce costs, and increase productivity. Be concise and practical. Format your response with clear sections: Summary, Key Issues, Recommendations (numbered list), and Expected Impact.`,
  finance: `You are a financial consultant. Analyze the user's financial situation and provide specific, actionable recommendations to improve cash flow, reduce expenses, and increase profitability. Be concise and practical. Format your response with clear sections: Summary, Key Issues, Recommendations (numbered list), and Expected Impact.`,
  technology: `You are a technology consultant. Analyze the user's technology stack and challenges, and provide specific, actionable recommendations to improve systems, automate tasks, and leverage technology effectively. Be concise and practical. Format your response with clear sections: Summary, Key Issues, Recommendations (numbered list), and Expected Impact.`,
  strategy: `You are a business strategy consultant. Analyze the user's strategic situation and provide specific, actionable recommendations to improve competitive position, growth trajectory, and long-term sustainability. Be concise and practical. Format your response with clear sections: Summary, Key Issues, Recommendations (numbered list), and Expected Impact.`,
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  try {
    if (!GROQ_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured. Please set GROQ_API_KEY in Supabase secrets.' }),
        { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      )
    }

    const { message, assessmentType = 'workflow', conversationHistory = [] } = await req.json()

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: message' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      )
    }

    const systemPrompt = SYSTEM_PROMPTS[assessmentType] || SYSTEM_PROMPTS.workflow

    const messages = [
      ...conversationHistory,
      { role: 'user', content: message }
    ]

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        max_tokens: 1024,
        temperature: 0.7,
      }),
    })

    if (!groqRes.ok) {
      const errText = await groqRes.text()
      console.error('Groq error:', groqRes.status, errText)
      return new Response(
        JSON.stringify({ error: `AI service error: ${groqRes.status}`, detail: errText }),
        { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      )
    }

    const data = await groqRes.json()
    const reply = data.choices?.[0]?.message?.content || 'No response generated.'

    return new Response(
      JSON.stringify({ reply, assessmentType }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )
  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )
  }
})
