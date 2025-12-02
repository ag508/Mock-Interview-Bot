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

## Docker Installation

You can also run the application using Docker.

1.  Pull the image from Docker Hub:
    ```bash
    docker pull aneesh95/mock-interview-bot:latest
    ```

2.  Run the container:
    ```bash
    docker run -p 80:80 aneesh95/mock-interview-bot:latest
    ```

3.  Open [http://localhost](http://localhost) in your browser.

## Deployment

This project is configured for deployment to **GitHub Pages** and **Docker Hub**.

1.  Push your changes to the `main` branch.
2.  Go to your repository **Settings** > **Secrets and variables** > **Actions**.
3.  Add the following secrets:
    - `VITE_GEMINI_API_KEY`: Your Google Gemini API Key.
    - `DOCKER_USERNAME`: Your Docker Hub username (`aneesh95`).
    - `DOCKER_PASSWORD`: Your Docker Hub password or access token.
4.  The GitHub Action will automatically:
    - Build and deploy the web app to GitHub Pages.
    - Build and push the Docker image to Docker Hub.

**Security Note:** Since this is a client-side application, the API key is embedded in the build. Restrict your API key usage in the Google Cloud Console to specific domains (e.g., your GitHub Pages URL) to prevent unauthorized use.
