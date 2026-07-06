import fs from 'fs';
import path from 'path';

const API_BASE = 'http://127.0.0.1:17493';
const PUBLIC_DIR = path.join(process.cwd(), 'public');

const CHARACTERS = [
  { id: 'seller_sam', voice_id: 'am_eric', text: "Buy my live-streamed limited-edition socks! I have to sell fifty pairs just to cover the Web2 platform fees! Please, my children are barefoot!" },
  { id: 'buyer_betty', voice_id: 'af_bella', text: "I'd buy them, but bridging my crypto to your chain takes 45 minutes. By the time the transaction clears, feet will be out of style." },
  { id: 'yield_yusef', voice_id: 'am_adam', text: "Why is everyone yelling? I'm just watching this stream while my stablecoins earn Treasury Yield. I'm literally making money off your foot tragedy." },
  { id: 'pabandi_pam', voice_id: 'af_jessica', text: "Stop the madness. Just use Pabandi. Instant cross-chain checkouts for Betty, zero middleman fees for Sam's socks, and passive yield for Yusef." }
];

async function createProfile(name, voice_id) {
  const res = await fetch(`${API_BASE}/profiles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      description: 'Ad Uncle',
      language: 'en',
      voice_type: 'preset', preset_engine: 'kokoro',
      preset_voice_id: voice_id
    })
  });
  if (!res.ok) {
    if (res.status === 400) {
      console.log(`Profile ${name} already exists. Fetching its ID.`);
      const getRes = await fetch(`${API_BASE}/profiles`);
      const profiles = await getRes.json();
      const existing = profiles.find(p => p.name === name);
      return existing.id;
    }
    const err = await res.text();
    throw new Error(`Failed to create profile: ${err}`);
  }
  const data = await res.json();
  return data.id;
}

async function generateAudio(profileId, text, outputPath) {
  console.log(`Generating audio for ${text}...`);
  const res = await fetch(`${API_BASE}/generate/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profile_id: profileId,
      text,
      language: 'en',
      engine: 'kokoro'
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to generate audio: ${err}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(outputPath, buffer);
  console.log(`Saved ${outputPath}`);
}

async function main() {
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  for (const char of CHARACTERS) {
    const profileId = await createProfile(char.id, char.voice_id);
    const outputPath = path.join(PUBLIC_DIR, `${char.id}.wav`);
    await generateAudio(profileId, char.text, outputPath);
  }
  
  // also generate the narration
  const narrationProfileId = await createProfile('narration_live', 'am_liam');
  const narrationText = "Pabandi. Stop crying. Start earning.";
  await generateAudio(narrationProfileId, narrationText, path.join(PUBLIC_DIR, 'narration.wav'));
}

main().catch(console.error);
