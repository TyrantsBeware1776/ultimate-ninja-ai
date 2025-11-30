The following checklist outlines outstanding tasks for AI Video Forge. Items are grouped by priority and correspond to the phases defined in PLAN.md. Checked boxes indicate completed work.

High Priority (Upcoming Release)

 Integrate Gemini transcription – use transcribeAudio in services/geminiService.ts to convert recorded topics into text.

 Refine ScriptWriterAgent prompts – experiment with system instructions to produce concise dialogue that respects character personalities.

 Polish multi‑speaker TTS – handle errors gracefully, show progress indicator and support cancellation.

 Voice cloning UX – finish the voice cloning upload flow, display cloned voices in the voice list and allow deletion or renaming.

 Character management improvements – add validation for unique names, limit to 10 characters and provide reorder controls.

 Thumbnail extraction – generate still images for animated Veo videos to display them in the timeline.

 Error handling for Veo – catch API errors (e.g. no key, quota) and provide actionable messages; allow retrying generation.

Phase 3 – Image‑to‑Video Animation

 Wrap the Veo 3.1 API call into a robust VideoAnimationAgent wrapper.

 Add customizable prompts per character with suggested examples.

 Allow setting animation duration once supported by the API.

 Display progress while polling the long‑running operation.

 Cache generated videos and support re‑using them without re‑generation.

Phase 4 – Face Tracking and AR Masks

 Integrate MediaPipe Face Landmarker as a WebAssembly module and expose a JavaScript API.

 Define a mask file format and anchor points relative to face landmarks.

 Implement real‑time landmark detection on the preview canvas and overlay masks accordingly.

 Build a mask library UI and allow users to toggle masks per clip.

 Optimise for performance (e.g., batch processing frames or using WebGL shaders).

Phase 5 – Persistence and Enhancements

 Implement project saving and loading (serialize ProjectState, characters and custom voices to JSON).

 Add multi‑language support for script generation and TTS when Gemini audio models add more languages.

 Expand AVAILABLE_VOICES with new voices and update the UI to reflect them.

 Implement keyframe animations for clip position and scale.

 Add colour grading and audio fade options.

 Write tutorial documentation and in‑app tooltips.

Bugs / Technical Debt

 Audio sync after export – occasionally audio and video drift in exported WebM files. Investigate MediaRecorder configuration and ensure audio buffers are flushed before finishing.

 Undo/redo performance – storing full ProjectState snapshots can be memory‑intensive. Explore storing deltas or limiting history length.

 Mobile responsiveness – timeline dragging and canvas interactions are currently optimised for desktop. Improve touch support.

 Large file handling – for very large video files, preview playback may stutter. Consider downscaling video for preview and using offscreen canvases.

Please update this file as tasks are completed or new work is identified. See PLAN.md for context and long‑term goals.
