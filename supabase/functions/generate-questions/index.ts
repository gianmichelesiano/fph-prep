import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0?target=deno'

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const AREA_NAMES: Record<number, string> = {
  1: 'Validazione ricette',
  2: 'Fitoterapia',
  3: 'Medicina complementare',
  4: 'Farmacia Clinica',
  5: 'Anamnesi e terapia',
  6: 'Preparazione medicinali',
  7: 'Risultati di laboratorio',
  8: 'Situazioni d\'emergenza',
  9: 'Vaccinazioni e prelievi',
}

const LANG_NAMES: Record<string, string> = {
  it: 'italiano', de: 'tedesco', fr: 'francese', en: 'inglese'
}

function buildPrompt(area: number, lang: string, count: number): string {
  const areaName = AREA_NAMES[area] || `Area ${area}`
  const langName = LANG_NAMES[lang] || lang

  return `Sei un esaminatore FPH svizzero. Crea ${count} domande d'esame in ${langName} per farmacisti specialisti, sull'area tematica: "${areaName}" (Ruolo ${area} dell'esame FPH Offizin).

Le domande devono testare competenze pratiche secondo gli obiettivi FPH: scenari reali al banco, anamnesi e triage, validazione prescrizioni, identificazione errori di dosaggio e interazioni, rapporto beneficio-rischio, counselling al paziente, riferimenti a linee guida svizzere.

Genera un mix di domande "multipla_scelta" (circa 50%) e "kprim" (circa 50%).

Rispondi SOLO con un array JSON nel seguente formato (senza testo prima o dopo):
[
  {
    "type": "multiple",
    "text": "Testo della domanda...",
    "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
    "correct": "B",
    "motivation": "Spiegazione della risposta corretta e perché le altre sono sbagliate...",
    "topic": "Argomento specifico"
  },
  {
    "type": "truefalse",
    "text": "Riguardo al farmaco X:",
    "items": [
      {"text": "Affermazione 1", "correct": true},
      {"text": "Affermazione 2", "correct": false},
      {"text": "Affermazione 3", "correct": true},
      {"text": "Affermazione 4", "correct": false}
    ],
    "motivation": "Spiegazione...",
    "topic": "Argomento specifico"
  }
]

Regole:
- Per "multiple": 4 opzioni A/B/C/D, una sola corretta, "correct" è la lettera (es. "B")
- Per "truefalse" (K-PRIM): 4 affermazioni, ognuna con "correct": true o false
- Basa le domande su scenari REALI di farmacia svizzera
- Le motivazioni devono essere clinicamente accurate e formative
- Varia i tipi di domande e gli argomenti all'interno dell'area`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { area, lang, count } = await req.json()
    if (!area || !lang || !count) {
      return new Response(JSON.stringify({ error: 'Missing params: area, lang, count required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const prompt = buildPrompt(Number(area), lang, Math.min(Number(count), 20))

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''

    // Extract JSON array
    const start = rawText.indexOf('[')
    const end = rawText.lastIndexOf(']')
    if (start === -1 || end === -1) {
      throw new Error('No JSON array found in AI response')
    }
    const questions = JSON.parse(rawText.slice(start, end + 1))

    return new Response(JSON.stringify({ questions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
