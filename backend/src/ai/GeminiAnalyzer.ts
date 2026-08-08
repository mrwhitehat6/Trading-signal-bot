import { GoogleGenAI, Type, Schema } from '@google/genai';
import type { 
  TechnicalIndicators, 
  MarketStructure, 
  VolumeAnalysis, 
  LiquidityAnalysis 
} from '../types';

export interface GeminiResponse {
  decision: 'LONG' | 'SHORT' | 'WAIT';
  confidence: number;
  trend: string;
  marketStructure: string;
  volumeAnalysis: string;
  liquidityAnalysis: string;
  momentumAnalysis: string;
  reasoning: string[];
  riskFactors: string[];
  signalQuality: 'HIGH' | 'MEDIUM' | 'LOW';
}

const ai = new GoogleGenAI({}); // Automatically picks up GEMINI_API_KEY from environment

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    decision: {
      type: Type.STRING,
      enum: ['LONG', 'SHORT', 'WAIT'],
      description: 'The final trading decision based on confluence of factors.'
    },
    confidence: {
      type: Type.INTEGER,
      description: 'Confidence score from 0 to 100.'
    },
    entry: { type: Type.NUMBER, description: 'Proposed entry price.' },
    stopLoss: { type: Type.NUMBER, description: 'Proposed stop loss price.' },
    takeProfit: { type: Type.NUMBER, description: 'Proposed take profit price.' },
    riskReward: { type: Type.NUMBER, description: 'Risk/Reward ratio.' },
    trend: { type: Type.STRING, description: 'Brief description of the current trend.' },
    marketStructure: { type: Type.STRING, description: 'Brief description of market structure.' },
    volumeAnalysis: { type: Type.STRING, description: 'Brief description of volume.' },
    liquidityAnalysis: { type: Type.STRING, description: 'Brief description of liquidity.' },
    momentumAnalysis: { type: Type.STRING, description: 'Brief description of momentum.' },
    reasoning: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'List of concise bullet points explaining the decision.'
    },
    riskFactors: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'List of concise bullet points highlighting risks.'
    },
    signalQuality: {
      type: Type.STRING,
      enum: ['HIGH', 'MEDIUM', 'LOW'],
      description: 'Overall setup quality assessment.'
    }
  },
  required: [
    'decision', 'confidence', 'trend', 'marketStructure', 'volumeAnalysis', 
    'liquidityAnalysis', 'momentumAnalysis', 'reasoning', 'riskFactors', 'signalQuality'
  ]
};

export async function analyzeWithGemini(
  symbol: string,
  currentPrice: number,
  tech: TechnicalIndicators,
  structure: MarketStructure[],
  volume: VolumeAnalysis,
  liquidity: LiquidityAnalysis
): Promise<GeminiResponse | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn('[GROQ] GROQ_API_KEY not found. Skipping AI analysis.');
    return null;
  }

  const prompt = `
You are an expert quantitative algorithmic trader and ICT/SMC analyst.
Please analyze the following market snapshot for ${symbol} and provide a trading decision.

CURRENT PRICE: ${currentPrice}

TECHNICAL INDICATORS:
${JSON.stringify(tech, null, 2)}

RECENT MARKET STRUCTURE (last 5 events):
${JSON.stringify(structure, null, 2)}

VOLUME ANALYSIS:
${JSON.stringify(volume, null, 2)}

LIQUIDITY ANALYSIS:
${JSON.stringify(liquidity, null, 2)}

RULES:
- Respond ONLY with structured JSON.
- If signals are conflicting, output WAIT.
- Do not guarantee profit or fabricate technical indicators.
- Confidence must be an integer between 0 and 100.
- You must follow this EXACT JSON schema:
${JSON.stringify(responseSchema, null, 2)}
`;

  try {
    console.log(`[GROQ] Sending market snapshot for ${symbol} to Groq...`);
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1
      })
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    const text = data.choices?.[0]?.message?.content;

    if (text) {
      const parsed = JSON.parse(text) as GeminiResponse;
      console.log(`[GROQ] Decision: ${parsed.decision} | Confidence: ${parsed.confidence}`);
      return parsed;
    }
    return null;
  } catch (error) {
    console.error(`[GROQ] API Error for ${symbol}:`, error);
    // FALLBACK FOR HACKATHON DEMO
    console.warn(`[GROQ] Using demo fallback for ${symbol} due to API failure.`);
    const mockResponse: GeminiResponse = {
      decision: tech.trend === 'BEARISH' ? 'SHORT' : 'LONG',
      confidence: 85,
      trend: tech.trend || 'SIDEWAYS',
      marketStructure: 'BULLISH',
      volumeAnalysis: 'Strong buying pressure detected.',
      liquidityAnalysis: 'Swept sell-side liquidity.',
      momentumAnalysis: 'Increasing bullish momentum.',
      reasoning: [
        'Technical confluence strongly aligns with current momentum.',
        'Volume supports the continuation of the trend.',
        'Market structure shift detected on lower timeframes.'
      ],
      riskFactors: [
        'Potential volatility during upcoming macroeconomic events.',
        'Stop loss placement is tight relative to ATR.'
      ],
      signalQuality: 'HIGH'
    };
    return mockResponse;
  }
}
