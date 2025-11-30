Development Plan for AI Video Forge

This plan outlines the phases and milestones for turning AI Video Forge into a full‑fledged AI skit creation studio. Each phase builds upon the previous, gradually adding AI‑driven features such as script generation, voice synthesis, character animation and face tracking. Dates and durations are suggestions; adjust them based on team capacity and access to external APIs.

Phase 0 – Core Video Editor (Completed)

Objective: Provide a stable foundation for editing media on a timeline.

Deliverables:

Multi‑track timeline with tracks for video and audio.

Tools to import images, videos and audio clips; add them to the timeline with drag‑and‑drop.

Basic editing capabilities: play/pause, seeking, split clips, delete clips, adjust speed, position, scale and crop; apply fade or wipe transitions.

Canvas‑based preview window with export functionality to WebM.

TypeScript type definitions for clips, tracks, transitions and voices.

Component architecture (App, Timeline, SkitGenerator) built with React and Vite.

Phase 1 – AI Script Generation and TTS

Duration: 2–3 weeks

Goals: Integrate Gemini text generation and multi‑speaker TTS to automate skit creation.

Tasks:

Topic input and transcription – Allow users to enter a topic manually or record a voice message. Use Gemini 2.5 to transcribe recorded audio.

ScriptWriterAgent – Build prompts and system instructions to instruct Gemini 2.5 to write short dialogues. Accept character names, personalities and voices; output a script in Name: "Dialogue" format.

Script editor – Provide a textarea where users can edit the generated script.

VoiceSynthesizerAgent – Build a multi‑speaker configuration to map character names to chosen voices and call Gemini TTS. Decode returned PCM data, convert to WAV and add it to the timeline.

Voice library – Define at least ten built‑in voices and a mapping to Gemini prebuilt voices. Expose them in a dropdown for each character.

Testing & evaluation – Generate sample skits, verify audio quality, check that the script respects personality instructions and adjust prompts as needed.

Milestone: Users can create a cast, generate a script from a topic, synthesize the dialogue and hear a multi‑speaker audio clip.

Phase 2 – Voice Cloning and Character Management

Duration: 2 weeks

Goals: Allow users to create custom voices and manage multiple characters more effectively.

Tasks:

Voice cloning interface – Let users upload an audio sample; assign it a friendly name; temporarily map it to an existing Gemini voice until Gemini provides custom cloning.

Voice management – Display a list of custom voices; allow deleting or renaming; ensure custom voices appear in the voice selection dropdown.

Character builder improvements – Add UI to set personalities, reorder characters and specify default animation prompts for each character.

Validation – Limit the number of characters to a sensible maximum (10 for now) and ensure names are unique.

Milestone: Users can clone their own voices, build a cast and customise personalities for more nuanced scripts.

Phase 3 – Image‑to‑Video Animation

Duration: 2–3 weeks (dependent on API availability)

Goals: Bring characters to life by animating their images using Veo 3.1.

Tasks:

Veo service integration – Wrap the Gemini Veo API in VideoAnimationAgent. Accept a Base64 image and a prompt; call generateVideos with veo-3.1-fast-generate-preview, poll operation status and return a downloadable video URL.

Prompt templates – Provide suggested prompts (e.g., “talking and smiling,” “nodding while speaking”) and allow custom prompts per character.

Thumbnail generation – Generate thumbnails for animated videos to show in the timeline.

Duration control – Default to 6–8 seconds but allow users to set shorter or longer durations when Veo exposes this option.

UI enhancements – Display a spinner while videos are generating and handle errors such as missing API keys or usage limits.

Milestone: Users can animate each character’s photo and insert the resulting video into the timeline, synchronizing it with the audio track.

Phase 4 – Face Tracking and AR Masks

Duration: 4 weeks

Goals: Implement a Snapchat‑style mask system that detects facial landmarks and responds to head movement, eyes and mouth.

Tasks:

MediaPipe integration – Create a FaceTrackingAgent that uses the MediaPipe Face Landmarker to process images or video frames. Configure the model to output 3D landmarks, blendshape scores and transformation matrices
ai.google.dev
; choose appropriate running modes (video/live) and confidence thresholds
ai.google.dev
.

Mask overlay system – Define a mask format (e.g., SVG or PNG with anchor points). Use the transformation matrices to align masks with the user’s face. Support multiple masks and layering.

Real‑time preview – Render the tracked face and mask overlays in the preview canvas during playback or while recording new media.

Filter library – Provide a collection of AR masks (hats, glasses, face paint) and allow users to upload their own masks. Add controls to toggle masks per clip.

Optimisation – Ensure the landmark detection runs efficiently on 720p video in browsers; consider using WebGL/WebGPU acceleration.

Milestone: The editor applies masks that track facial features in uploaded videos, enabling playful or branded effects.

Phase 5 – Persistence and Extended Features

Duration: 3 weeks

Goals: Polish the product, improve usability and prepare for public release.

Tasks:

Project saving/loading – Implement JSON serialization of project state (clips, tracks, scripts, voices). Allow users to save projects to local storage or the cloud and reload them later.

Multi‑language support – Expose additional languages for script and voice generation once Gemini audio models support them; provide a language selector.

More voices and styles – Monitor Gemini updates for new voices, expressive styles or accent control; update AVAILABLE_VOICES and UI accordingly.

Advanced editing tools – Add keyframe‑based animations for scale/position; implement colour filters; allow crossfades between audio clips.

User documentation – Create tutorial videos, in‑app tooltips and help pages. Provide examples of skits and best practices.

Milestone: AI Video Forge is stable, supports persistent projects and multiple languages, and offers a polished user experience. It is ready for a wider audience.

This plan is a living document. As Google’s generative models evolve, we may adjust tasks to take advantage of new capabilities (e.g., real‑time streaming TTS or longer Veo sequences). Contributions and suggestions are welcome—please see the repository issues for current priorities.
