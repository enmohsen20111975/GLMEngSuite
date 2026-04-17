import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

const SYSTEM_PROMPT = `You are EngiSuite AI Assistant, an expert engineering calculation and design assistant. You help engineers with:
- Solving engineering equations and calculations
- Explaining engineering concepts and standards (IEC, EN, IEEE, ASME, etc.)
- Guiding through multi-step calculation pipelines
- Recommending design parameters and best practices
- Converting units and interpreting results

Domains you specialize in:
- Electrical Engineering (power systems, cable sizing, voltage drop, power factor correction)
- Mechanical Engineering (stress analysis, beam design, fluid mechanics)
- Civil Engineering (structural design, foundation design, concrete mix design)
- HVAC Engineering (cooling loads, duct sizing, air distribution)
- Hydraulic Engineering (pipe sizing, pump selection, flow calculations)
- Thermodynamics (heat transfer, cycle analysis, energy efficiency)

Always provide clear, step-by-step explanations with proper units. Reference relevant standards when applicable. If you're unsure, say so rather than guessing.`

// In-memory conversation store (in production, use a database)
const conversations = new Map<string, Array<{ role: string; content: string }>>()

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, sessionId, systemPrompt } = body

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const zai = await getZAI()

    // Get or create conversation history
    const key = sessionId || 'default'
    let history = conversations.get(key) || [
      { role: 'assistant', content: systemPrompt || SYSTEM_PROMPT }
    ]

    // Add user message
    history.push({ role: 'user', content: message })

    // Trim history if too long (keep system prompt + last 20 messages)
    if (history.length > 22) {
      history = [history[0], ...history.slice(-21)]
    }

    // Get completion
    const completion = await zai.chat.completions.create({
      messages: history as Array<{ role: 'assistant' | 'user'; content: string }>,
      thinking: { type: 'disabled' },
    })

    const aiResponse = completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response. Please try again.'

    // Add AI response to history
    history.push({ role: 'assistant', content: aiResponse })

    // Save updated history
    conversations.set(key, history)

    return NextResponse.json({
      response: aiResponse,
      sessionId: key,
      messageCount: history.length - 1,
    })
  } catch (error) {
    console.error('Error in AI chat:', error)
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const sessionId = searchParams.get('sessionId')
    if (sessionId) {
      conversations.delete(sessionId)
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error clearing conversation:', error)
    return NextResponse.json({ error: 'Failed to clear conversation' }, { status: 500 })
  }
}
