# Hikari H Virtual Assistant

Hikari H is an original HH Platform character and a local-first Home assistant. The current production asset is `assets/hikari-h/hikari-h-original-v1-alpha.webp`, generated specifically for this project. It is not copied from the visual reference and must not be redistributed as a third-party character pack.

## Current renderer

`services/virtualAssistantCharacter.js` exposes `CharacterAdapter` and displays the original transparent anime artwork in `assets/hikari-h/hikari-h-original-v1-alpha.webp`. Cinematic 2D breathing, blink, gaze, greeting, listening, thinking, speaking, pointing, warning, sleeping and warp states are driven by CSS and the assistant lifecycle. The former procedural WebGL body is intentionally not loaded so it cannot overlap the anime character.

## Installing a licensed VRM or GLB

1. Obtain a model whose licence explicitly permits the website's commercial/public use, modification and streaming. Save the licence URL, author, licence text and acquisition date.
2. A future rigged VRM/GLB may replace the artwork only after the user requests it and its avatar, texture and redistribution licences are recorded. Do not download a random character model.

## Vietnamese voices

The client defaults to the `Hikari dịu dàng` female Vietnamese preset. Web Speech is free and local/browser-dependent; browser voice gender is only an estimate when the browser does not publish gender metadata. Google Cloud adapters allowlist Vietnamese Standard, WaveNet, Neural2 and selected Chirp HD voices. Google Cloud requires billing even when usage is inside a free allowance. OpenAI and self-host adapters remain optional and all keys/tokens are server-only.

For self-hosted GitHub TTS, configure `HIKARI_SELFHOST_TTS_URL` only after separately checking the repository code licence, pretrained model licence, dataset/voice rights and commercial-use terms. The UI uses neutral server-mapped voice IDs rather than assuming a third-party speaker pack is reusable. Voice cloning is intentionally not exposed without a consent registry. V-TTS is not bundled because its current repository states CC BY-NC 4.0; VieNeu-TTS is only a candidate until its exact checkpoint and training-data terms are reviewed alongside its Apache-2.0 code licence.
3. Implement `window.HHCharacter3DRenderer.mount(host, options)`. Return an adapter with optional `setState`, `lookAt`, `setViseme`, `update`, `setQuality` and `dispose` methods.
4. Keep model plus textures within the agreed budget. Lazy-load Three.js/VRM only after Home first paint. Dispose geometries, materials, textures and animation mixers in `dispose()`.
5. Add the model, author and exact licence to this file before publishing. Never use an unverified avatar from a random model repository.

## Privacy and safety

- Microphone access starts only after the user presses **Nói**. The temporary permission stream is stopped immediately and no raw recording is stored.
- Voice playback starts only after the user presses **Bật giọng nói cho Hikari**.
- Local commands execute only routes in `services/virtualAssistantCommands.js`.
- Chat sends the user's current message plus five aggregate status fields. It does not send tokens, raw localStorage or microphone audio.
- Conversation history is stored under `ownerId + learnerProfileId`. Guests remain device-local.
- External side effects such as upload, posting, deletion, sending email, purchasing or privacy changes are never executed from AI output.

## Providers

- Browser voice: Web Speech `speechSynthesis`, free capability-gated fallback.
- Cloud TTS: authenticated `/api/assistant/tts`, currently using the server's OpenAI key if configured.
- Chat: authenticated `/api/assistant/chat`; Gemini is preferred by default and OpenAI is a server-side fallback. Both can be disabled without breaking local commands.

The browser voice lip motion is explicitly simulated from speech timing because Web Speech does not expose waveform or phoneme visemes.
