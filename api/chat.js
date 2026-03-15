export default async function handler(req, res) {
  // 1. Pastikan hanya menerima metode POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Gunakan POST.' });
  }

  // 2. Ambil data dari frontend
  const { model, message } = req.body;

  if (!message || !model) {
    return res.status(400).json({ error: 'Pesan dan model AI harus diisi!' });
  }

  try {
    let aiResponseText = "";

    // 3. Routing logika berdasarkan keluarga AI
    // ----------------------------------------------------------------------
    // KELUARGA GOOGLE (Gemini & Nano Banana)
    // ----------------------------------------------------------------------
    if (['gemini-3.1-pro', 'gemini-3.1-flash', 'gemini-3.1-lite', 'nano-banana-2'].includes(model)) {
      const apiKey = process.env.GOOGLE_API_KEY;
      
      // 1. MAPPING NAMA MODEL (Berdasarkan Screenshot UI API-mu)
      const googleModelMap = {
        'gemini-3.1-pro': 'gemini-3.1-pro-preview',
        'gemini-3.1-flash': 'gemini-3.1-flash-preview', // Asumsi nama untuk versi Flash standar
        'gemini-3.1-lite': 'gemini-3.1-flash-lite-preview',
        'nano-banana-2': 'gemini-3.1-flash-image-preview'
      };

      // Mengambil ID model yang benar, atau fallback ke yang dipilih user jika tidak ada di map
      const actualGoogleModel = googleModelMap[model] || model; 
      
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${actualGoogleModel}:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: message }] }]
        })
      });
      
      const data = await response.json();
      
      // 2. LOG ERROR DETAIL
      // Jika error, cetak pesan asli dari Google ke terminal Vercel
      if (!response.ok) {
        console.error("DETAIL ERROR GOOGLE:", JSON.stringify(data, null, 2));
        throw new Error(`Google menolak permintaan: ${data.error?.message || 'Error 400 Bad Request'}`);
      }
      
      aiResponseText = data.candidates[0].content.parts[0].text;
    }

    // ----------------------------------------------------------------------
    // KELUARGA OPENAI
    // ----------------------------------------------------------------------
    else if (['gpt-5.1', 'gpt-5-nano'].includes(model)) {
      const apiKey = process.env.OPENAI_API_KEY;
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: message }]
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Gagal memanggil OpenAI API');
      
      aiResponseText = data.choices[0].message.content;
    }

    // ----------------------------------------------------------------------
    // KELUARGA GROQ
    // ----------------------------------------------------------------------
    else if (['llama-4', 'whisper-stt'].includes(model)) {
      // CATATAN PENDIDIKAN: Whisper (STT) biasanya membutuhkan input file audio.
      // Jika user mengirim teks ke Whisper, API Groq mungkin menolaknya.
      if (model === 'whisper-stt') {
        return res.status(400).json({ 
          error: 'Whisper (STT) membutuhkan file audio, bukan teks. Fitur ini memerlukan penanganan khusus untuk file.' 
        });
      }

      const apiKey = process.env.GROQ_API_KEY;
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: message }]
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Gagal memanggil Groq API');
      
      aiResponseText = data.choices[0].message.content;
    }

    // ----------------------------------------------------------------------
    // KELUARGA OPENROUTER
    // ----------------------------------------------------------------------
    else if (['hunter-alpha', 'qwen-3.5-9b'].includes(model)) {
      const apiKey = process.env.OPENROUTER_API_KEY;
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://website-kamu.com', // Disarankan oleh OpenRouter
          'X-Title': 'Chat AI App'
        },
        body: JSON.stringify({
          model: model, // Pastikan ID model di UI sama persis dengan ID di OpenRouter (misal: 'qwen/qwen-3.5-9b')
          messages: [{ role: 'user', content: message }]
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Gagal memanggil OpenRouter API');
      
      aiResponseText = data.choices[0].message.content;
    }

    // Jika model tidak dikenali
    else {
      return res.status(400).json({ error: 'Model AI tidak didukung atau tidak dikenali.' });
    }

    // 4. Kirim balasan kembali ke frontend
    return res.status(200).json({ reply: aiResponseText });

  } catch (error) {
    console.error("Error di Backend:", error);
    return res.status(500).json({ error: error.message || 'Terjadi kesalahan pada server AI.' });
  }
}
