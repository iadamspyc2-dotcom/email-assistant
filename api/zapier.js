export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({error:'Method not allowed'}); return; }

  try {
    const { from, subject, body, date } = req.body;

    // Build the analysis request to Claude
    const today = new Date().toISOString().split("T")[0];
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: `You are an expert email assistant and CRM specialist. Analyze emails and return ONLY valid JSON (no markdown) with this structure: {"priority":"urgent|high|medium|low","summary":"2-3 sentence summary","sentiment":"positive|neutral|concerned|negative","customerType":"B2B|B2C|prospect|vendor|internal","keyPoints":["p1","p2","p3"],"actionItems":[{"task":"t","deadline":"d or null","urgency":"urgent|high|medium|low"}],"draftReply":"professional reply","customerProfile":{"name":"full name","email":"email","company":"company","notes":"key info"},"salesforceEvents":[{"type":"Task|Event|Log a Call|Follow-Up","subject":"max 80 chars","description":"log text","priority":"High|Normal|Low","status":"Not Started","activityDate":"YYYY-MM-DD today is ${today}","contactName":"name","contactEmail":"email","accountName":"company","callResult":"null","nextStep":"next step","opportunityStage":"null","amount":"null","sfNotes":"notes"}]}`,
        messages: [{
          role: 'user',
          content: `From: ${from}\nSubject: ${subject}\n\n${body}`
        }]
      })
    });

    const data = await response.json();
    const text = data.content?.map(b => b.text || '').join('') || '{}';
    const analysis = JSON.parse(text.replace(/```json|```/g, '').trim());

    // Return the email + analysis so the app can store it
    res.status(200).json({
      success: true,
      email: {
        id: 'zap_' + Date.now(),
        from: from || 'unknown@email.com',
        name: (from || 'Unknown').split('@')[0],
        subject: subject || 'No Subject',
        date: date || new Date().toLocaleString(),
        body: body || ''
      },
      analysis
    });

  } catch(err) {
    res.status(500).json({ error: err.message });
  }
}
