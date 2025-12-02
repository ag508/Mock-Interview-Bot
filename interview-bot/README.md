# Mock Interview Bot

A React-based AI Mock Interview application powered by Google Gemini.

## Features

- **Customizable Interviews**: Choose your target role, experience level, and tech stack.
- **AI-Powered**: Uses Gemini Flash to conduct realistic interviews.
- **Real-time Feedback**: Get instant feedback on your answers.
- **Detailed Analysis**: Receive a comprehensive report with strengths, improvements, and a rating at the end.
- **Transcript Download**: Download the full interview transcript for review.

## Prerequisites

- Node.js (v18 or higher)
- npm

## Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/ag508/Mock-Interview-Bot.git
    cd Mock-Interview-Bot
    ```

2.  Navigate to the project directory:
    ```bash
    cd interview-bot
    ```

3.  Install dependencies:
    ```bash
    npm install
    ```

## Configuration

1.  Create a `.env` file in the `interview-bot` directory.
2.  Add your Gemini API Key:
    ```env
    VITE_GEMINI_API_KEY=your_api_key_here
    ```
    *Note: You can get an API key from [Google AI Studio](https://aistudio.google.com/).*

## Running Locally

Start the development server:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Deployment

This project is configured for deployment to **GitHub Pages**.

1.  Push your changes to the `main` branch.
2.  Go to your repository **Settings** > **Secrets and variables** > **Actions**.
3.  Create a **New repository secret** named `VITE_GEMINI_API_KEY` with your API key value.
4.  The GitHub Action will automatically build and deploy the app.

**Security Note:** Since this is a client-side application, the API key is embedded in the build. Restrict your API key usage in the Google Cloud Console to specific domains (e.g., your GitHub Pages URL) to prevent unauthorized use.
