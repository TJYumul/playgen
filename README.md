# Music AI Thesis – Real-Time Personalized Playlist Generation

## Overview

This project is a real-time personalized music recommendation system that combines user behavior analytics, mood detection, and reinforcement learning to generate adaptive playlists.

The system collects user listening behavior, extracts interaction features, predicts song moods using a trained model, and generates personalized playlist recommendations.

---

## Project Architecture

This project follows a monorepo structure:

music-ai-thesis/
│
├── frontend/ # Vite Vanilla JS music player
├── backend/ # Express API + ingestion + logging
├── ai/ # Mood model + RL training (future)
├── scripts/ # Aggregation + dataset generation


---

## Core Features

### Music Player
- Real audio playback
- Play, pause, skip, complete tracking
- Playback progress and volume controls
- Event logging to backend

### Song Ingestion Pipeline
- Fetch songs from external music API
- Pagination and batch insertion
- Duplicate prevention via upsert
- Stores metadata such as artist, duration, popularity

### User Behavior Tracking
- Logs player events
- Aggregates user-song interaction features
- Prepares dataset for reinforcement learning

### AI Pipeline (In Progress)
- Mood prediction using trained dataset
- Reinforcement learning playlist generation

---

## Technology Stack

### Frontend
- Vite
- Vanilla JavaScript
- Supabase Auth

### Backend
- Node.js
- Express.js
- Supabase
- Axios
- Node Cron

### AI / ML
- Python (planned)
- Reinforcement Learning
- Mood Detection Model

---

## Environment Setup

### Backend `.env`
PORT=5000
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JAMENDO_CLIENT_ID=your_jamendo_client_id


### Frontend `.env`
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key


---

## Installation

### 1. Clone Repository
git clone <repository_url>
cd music-ai-thesis


### 2. Install Dependencies

#### Frontend
cd frontend
npm install


#### Backend
cd backend
npm install


---

## Running the Application

### Start Backend Server
cd backend
npm run dev


Runs the Express server and API endpoints.

---

### Start Frontend
cd frontend
npm run dev


Runs the Vite development server and music player UI.

---

## Data Pipelines

### Song Ingestion

Fetches songs from external API and inserts them into Supabase.

cd backend
npm run ingest:jamendo


Optional parameters:

npm run ingest:jamendo -- --target 300 --limit 100 --batch-size 50 --genres rock,pop


#### Parameters

| Parameter | Description |
|----------|------------|
| target | Number of songs to ingest |
| limit | Songs fetched per API call |
| batch-size | Songs inserted per database batch |
| genres | Filter songs by genre |

---

### User Behavior Feature Generation

Aggregates raw event logs into user-song interaction metrics.

cd backend
npm run features:generate


This script generates:
- play_count
- skip_count
- completion_rate
- average listening duration
- total listening duration

Stored in:
user_song_features


---

## Database Tables

### songs
Stores all ingested tracks and metadata.

### events
Stores raw player interactions.

### user_song_features
Stores aggregated interaction features for recommendation training.

---

## API Endpoints

### Tracks
GET /api/tracks

Returns playable track list.

---

### Event Logging
POST /api/events

Logs user playback interactions.

---

### Song Ingestion
GET /api/ingest/jamendo

Triggers song ingestion manually.

---

## AI Workflow

### Mood Model
- Trained using external labeled dataset
- Predicts mood tags for songs
- Updates song metadata

### Reinforcement Learning
- Uses interaction features
- Learns playlist recommendation policy

---

## Development Phases

### Phase 1
- Song ingestion
- Music player
- Event logging
- Feature aggregation

### Phase 2
- Dataset preparation
- Mood prediction integration
- RL state/action design

### Phase 3
- Model training
- Playlist recommendation API
- Evaluation metrics

---

## Scripts Summary

| Command | Purpose |
|----------|------------|
| npm run dev | Starts backend server |
| npm run ingest:jamendo | Fetch songs from external API |
| npm run features:generate | Generate user interaction features |

---

## Future Improvements

- Shuffle and repeat logic
- Advanced playlist personalization
- Real-time recommendation adaptation
- Full RL model deployment

---

## Contributors

- Backend and AI Pipeline Development
- Frontend Music Player Development
- Mood Model Research and Integration
