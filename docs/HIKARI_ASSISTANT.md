# Hikari H Virtual Assistant

Hikari H is an original HH Platform character and a local-first Home assistant. The current production asset is `assets/hikari-h/hikari-h-original-v1-alpha.webp`, generated specifically for this project. It is not copied from the visual reference and must not be redistributed as a third-party character pack.

## Current renderer

`services/virtualAssistantCharacter.js` exposes `CharacterAdapter`. It first looks for an optional `window.HHCharacter3DRenderer` and a licensed `assets/hikari-h/hikari-h.vrm`. When they are unavailable, it uses the original transparent 2D cinematic asset. The fallback provides breathing, blink, gaze, idle, greeting, listening, thinking, speaking, pointing, warning, sleeping and warp transitions with CSS and delta-time lifecycle control.

## Installing a licensed VRM or GLB

1. Obtain a model whose licence explicitly permits the website's commercial/public use, modification and streaming. Save the licence URL, author, licence text and acquisition date.
2. Put the optimized model at `assets/hikari-h/hikari-h.vrm` or change the configured URL in `home-virtual-assistant.js`.
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
