AI Video Forge – Intelligent Skit Creator

AI Video Forge is an AI‑powered skit creator and video editor. It lets you import your own images, videos or audio, generate short scripts with Gemini, synthesize multi‑speaker dialogue, animate characters using Veo and add Snapchat‑style masks that react to head movement. A familiar timeline editor lets you trim, split and layer clips, preview your edits and export the final WebM video.

Features

Multi‑track timeline editor – Import video, image or audio files, split and trim clips, adjust speed, scale, position and cropping, add fade or wipe transitions, and layer multiple tracks.

Script generation – Provide a topic and character descriptions, or record a topic with your microphone. The app asks Gemini 2.5 to write a short skit in Name: "Dialogue" format, ensuring each character speaks according to their personality.

Multi‑speaker voice synthesis – Gemini’s TTS can transform text into a dialogue where each character speaks with a different voice. The API supports multi‑speaker audio and lets you influence style, accent and pace
ai.google.dev
. Extended audio models such as Gemini 2.5 offer expressive performance, pronunciation control and multi‑speaker dialogue generation
blog.google
.

Voice cloning and character voices – Choose from 10 predefined voices (e.g., Kore, Fenrir, Puck, Charon, Zephyr) or upload your own voice sample. Custom voices are mapped to a Gemini voice and added to your library.

Image‑to‑video animation – Upload a character image and optionally describe how they should move. The Veo 3.1 model can generate an 8 second 720p/1080p video using reference images and a prompt
ai.google.dev
. It accepts up to three reference images to preserve the subject’s appearance
ai.google.dev
.

Snapchat‑style face masks – Coming soon. The MediaPipe Face Landmarker detects 3D face landmarks, blendshape scores and head poses
ai.google.dev
, allowing masks to react to eye, nose and mouth positions. It supports images, video frames or live streams with configurable confidence thresholds
ai.google.dev
.

Export to WebM – Once you’re happy with your timeline, export the entire project to a high‑quality WebM video including both video and synthesized audio.

Getting Started
Prerequisites

Node.js
 (version 18 or later). You may verify your version with node --version.

A Gemini API key with access to the TTS and Veo endpoints. Place this key in a .env.local file at the project root:

GEMINI_API_KEY=your-key-here

Installation and Running

Clone this repository and change into its directory:

git clone https://github.com/TyrantsBeware1776/ultimate-ninja-ai.git
cd ultimate-ninja-ai


Install dependencies with npm:

npm install


Create a .env.local file and add your GEMINI_API_KEY as shown above.

Start the development server:

npm run dev


Vite will compile the React application and serve it on port 3000. Open your browser and navigate to http://localhost:3000.

When you’re ready to distribute your application, run:

npm run build


This produces a production‑ready build in the dist directory.

Using AI Video Forge

Import media via the left‑hand library. Drag or select images, videos or audio; they will appear as clips in the library and timeline.

Create characters in the AI Skit Studio (accessible via Create Skit). Add up to ten characters, choose or clone voices, and optionally upload a photo for animation.

Generate a script by typing a topic or recording your voice. Gemini will write a dialogue that you can edit.

Synthesize audio using the multi‑speaker TTS service. The generated WAV file automatically appears in the timeline.

Animate characters by clicking Animate with Veo next to an uploaded photo. Provide a prompt describing the action or emotion, and the generated video will appear on the timeline.

Edit clips using the timeline tools: cut, delete, resize, move between tracks, adjust speed, crop, transition types and durations. Use the inspector on the right to fine‑tune properties.

Preview your video in the center canvas. Hit the space bar or the play button to watch your composition. A preview window is always available before exporting.

Export by clicking Export Video. The editor will record the canvas and audio streams and save a .webm file.

Project Structure

The project is organised as a React + TypeScript application powered by Vite. Key files and directories:

Path	Description
package.json	Project metadata and dependencies (React, Vite, TypeScript, @google/genai)
vite.config.ts	Vite configuration, defines alias @ and exposes GEMINI_API_KEY to the client.
tsconfig.json	TypeScript compiler options (ES2022 modules, React JSX).
index.html	HTML entry point; loads Tailwind CSS and import maps for CDN‑hosted React and genai.
index.tsx	React root file; mounts the main App component.
App.tsx	Core video editor: timeline state, playback logic, export functionality and UI.
components/Timeline.tsx	Timeline component; handles clip moving, resizing and playhead interactions.
components/SkitGenerator.tsx	Modal for creating skits; integrates script writing, voice synthesis and Veo.
services/geminiService.ts	Encapsulates Gemini API calls: script generation, transcription, multi‑speaker TTS and Veo video generation.
types.ts	Type definitions for clips, tracks, project state, voices and transitions.
.gitignore	Excludes development artefacts (node_modules, logs, dist) from version control.
.env.local	Not tracked – store your GEMINI_API_KEY here.
Technology

AI Video Forge combines modern frontend tooling with state‑of‑the‑art generative models:

React + TypeScript + Vite – provides a fast development environment and a structured component‑based architecture.

Tailwind CSS – for responsive styling and dark UI. Custom scrollbars and inspector panels are built with utility classes.

Gemini API – used both for text generation and multi‑speaker TTS. The API can produce controllable, multi‑voice dialogue and supports natural language prompts to guide style
ai.google.dev
. Recent audio models add expressive performance, pronunciation control and multilingual support
blog.google
.

Veo 3.1 – Google’s generative video model. It can create short 8‑second videos and leverages reference images to maintain character appearance
ai.google.dev
ai.google.dev
.

MediaPipe Face Landmarker – planned integration for face tracking and AR filters. The model outputs 3D landmarks, blendshape scores and transformation matrices for each detected face
ai.google.dev
, with configurable modes for images, video or live streams
ai.google.dev
.

Contributing & Future Plans

This repository is a starting point for a comprehensive AI skit studio. Contributions are welcome! See PLAN.md for a detailed roadmap and TODO.md for specific tasks. Future releases will integrate real‑time face tracking, additional voices and languages, improved project saving/loading, and more advanced animation controls.

AI Video Forge is a work in progress and depends on experimental Gemini and Veo APIs. Availability of features may change as Google updates these services.
