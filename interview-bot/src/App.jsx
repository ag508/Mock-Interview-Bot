import React, { useState, useEffect, useRef } from 'react';
import {
  Send, User, Bot, Settings, Play, RefreshCw, FileText,
  Award, Briefcase, Code, Cpu, Mic, MicOff, Video, VideoOff,
  Clock, XCircle
} from 'lucide-react';

// --- Configuration ---
const DEFAULT_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const MODEL_NAME = "gemini-2.5-flash-preview-09-2025";

const MockInterviewBot = () => {
  // --- State ---
  const [apiKey, setApiKey] = useState(DEFAULT_API_KEY);
  const [hasCustomKey, setHasCustomKey] = useState(false);
  const [screen, setScreen] = useState('setup'); // setup, interview, feedback

  // Setup State
  const [role, setRole] = useState('Senior Software Engineer');
  const [skills, setSkills] = useState('React, Node.js, System Design');
  const [experience, setExperience] = useState('Senior (5+ years)');
  const [rubric, setRubric] = useState('Focus on architectural patterns, scalability, and edge cases. Be strict but polite.');
  const [loading, setLoading] = useState(false);

  // Interview State
  const [chatHistory, setChatHistory] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [questionCount, setQuestionCount] = useState(0);

  // Video & Audio State
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [interimInput, setInterimInput] = useState('');
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);

  // Feedback State
  const [feedbackReport, setFeedbackReport] = useState(null);
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);

  // --- Effects ---

  // Timer Logic
  useEffect(() => {
    let interval;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // Speech Recognition Setup
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (final) {
          setCurrentInput(prev => {
            const prefix = prev && !prev.endsWith(' ') && prev.length > 0 ? ' ' : '';
            return prev + prefix + final;
          });
          setInterimInput('');
        } else {
          setInterimInput(interim);
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        // Don't auto-stop on error, try to keep going unless strictly fatal
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Manage Mic State based on UI toggle
  useEffect(() => {
    if (!recognitionRef.current) return;

    if (screen === 'interview' && isMicEnabled && !loading) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        // Already started
      }
    } else {
      recognitionRef.current.stop();
    }
  }, [screen, isMicEnabled, loading]);

  // Manage Video Stream
  useEffect(() => {
    if (screen === 'interview') {
      startVideo();
    } else {
      stopVideo();
    }
    return () => stopVideo();
  }, [screen]);

  // Toggle Video Track Enabled/Disabled
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach(track => {
        track.enabled = isVideoEnabled;
      });
    }
  }, [isVideoEnabled]);

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setIsVideoEnabled(false);
    }
  };

  const stopVideo = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // --- API Interaction ---
  const callGemini = async (prompt, history = [], isSystemInstruction = false) => {
    const keyToUse = apiKey || "";
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${keyToUse}`;

    const formattedHistory = history.map(msg => ({
      role: msg.role === 'bot' ? 'model' : 'user',
      parts: [{ text: msg.text }]
    }));

    let contents = formattedHistory;

    if (prompt) {
      contents.push({
        role: "user",
        parts: [{ text: prompt }]
      });
    }

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: contents,
          systemInstruction: isSystemInstruction ? {
            parts: [{ text: isSystemInstruction }]
          } : undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("API Error Details:", errorData);
        throw new Error(`API Error: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error("No candidates returned from API");
      }
      return data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error("Gemini API Error:", error);
      return `Error: ${error.message}`;
    }
  };

  // --- Handlers ---

  const startInterview = async () => {
    setLoading(true);
    setChatHistory([]);
    setQuestionCount(0);
    setFeedbackReport(null);
    setTimer(0);
    setIsTimerRunning(false);

    const systemPrompt = `
      You are an expert interviewer for a ${role} position. 
      The candidate has the following experience: ${experience}.
      Key skills to assess: ${skills}.
      Rubric: ${rubric}.
      
      Your Goal: Conduct a mock interview. 
      1. Keep your questions CONCISE (1-2 sentences max) so they fit on the screen.
      2. Ask ONE question at a time.
      3. Do not provide feedback yet, just interview.
    `;

    const initialGreeting = await callGemini("Start the interview. Ask the first question.", [], systemPrompt);

    setChatHistory([
      { role: 'system_hidden', text: systemPrompt },
      { role: 'bot', text: initialGreeting }
    ]);

    setScreen('interview');
    setLoading(false);
    setIsTimerRunning(true);
  };

  const handleSendMessage = async () => {
    const finalMsg = currentInput + interimInput;
    if (!finalMsg.trim()) return;

    // Stop recording temporarily while processing
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsTimerRunning(false);

    const userMsg = { role: 'user', text: finalMsg };
    const updatedHistory = [...chatHistory, userMsg];

    setChatHistory(updatedHistory);
    setCurrentInput('');
    setInterimInput('');
    setLoading(true);

    const visibleHistory = updatedHistory.filter(m => m.role !== 'system_hidden');
    const systemPrompt = chatHistory.find(m => m.role === 'system_hidden')?.text;

    const botResponse = await callGemini(null, visibleHistory, systemPrompt);

    setChatHistory(prev => [...prev, { role: 'bot', text: botResponse }]);
    setQuestionCount(prev => prev + 1);
    setLoading(false);

    // Reset for next question
    setTimer(0);
    setIsTimerRunning(true);
    if (isMicEnabled && recognitionRef.current) {
      try { recognitionRef.current.start(); } catch (e) { }
    }
  };

  const endInterview = async () => {
    setLoading(true);
    setIsGeneratingFeedback(true);
    setIsTimerRunning(false);
    if (recognitionRef.current) recognitionRef.current.stop();

    const visibleHistory = chatHistory.filter(m => m.role !== 'system_hidden');
    const systemPrompt = chatHistory.find(m => m.role === 'system_hidden')?.text;

    const feedbackPrompt = `
      The interview is concluded. Provide detailed feedback in JSON format:
      {
        "summary": "string",
        "strengths": ["string"],
        "improvements": ["string"],
        "rating": "string (e.g. 8/10)",
        "technical_analysis": "string",
        "communication_analysis": "string"
      }
    `;

    try {
      const rawFeedback = await callGemini(feedbackPrompt, visibleHistory, systemPrompt);

      if (rawFeedback.startsWith("Error:")) {
        throw new Error(rawFeedback);
      }

      const cleanJson = rawFeedback.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedFeedback = JSON.parse(cleanJson);

      // Ensure arrays exist to prevent render crashes
      setFeedbackReport({
        summary: parsedFeedback.summary || "No summary available.",
        strengths: Array.isArray(parsedFeedback.strengths) ? parsedFeedback.strengths : [],
        improvements: Array.isArray(parsedFeedback.improvements) ? parsedFeedback.improvements : [],
        rating: parsedFeedback.rating || "N/A",
        technical_analysis: parsedFeedback.technical_analysis || "No analysis available.",
        communication_analysis: parsedFeedback.communication_analysis || "No analysis available."
      });
      setScreen('feedback');
    } catch (e) {
      console.error("Parsing error", e);
      setFeedbackReport({
        summary: "Could not generate structured JSON.",
        strengths: [],
        improvements: [],
        rating: "?/10",
        technical_analysis: "Raw output: " + (typeof rawFeedback === 'string' ? rawFeedback : "Error"),
        communication_analysis: ""
      });
      setScreen('feedback');
    } finally {
      setLoading(false);
      setIsGeneratingFeedback(false);
    }
  };

  const downloadTranscript = () => {
    const transcript = chatHistory
      .filter(m => m.role !== 'system_hidden')
      .map(m => `${m.role.toUpperCase()}: ${m.text}`)
      .join('\n\n');

    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview-transcript.txt`;
    a.click();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // --- Components ---

  const renderSetupScreen = () => (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in py-12 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-indigo-100">
        <div className="text-center mb-8">
          <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bot className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Mock Interview AI</h1>
          <p className="text-gray-500 mt-2">Immersive Video Interface</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Role</label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Experience Level</label>
              <select
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option>Intern / Junior</option>
                <option>Mid-Level</option>
                <option>Senior (5+ years)</option>
                <option>Staff / Principal</option>
                <option>Executive</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tech Stack</label>
              <div className="relative">
                <Code className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* API Key Override */}
          <div className="pt-4 border-t border-gray-100">
            <button
              onClick={() => setHasCustomKey(!hasCustomKey)}
              className="text-xs text-gray-500 flex items-center hover:text-indigo-600"
            >
              <Settings className="w-3 h-3 mr-1" />
              {hasCustomKey ? "Hide API Settings" : "Use Custom API Key"}
            </button>

            {hasCustomKey && (
              <div className="mt-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste your Gemini API Key here"
                  className="w-full px-3 py-1 text-sm border border-gray-200 rounded bg-gray-50"
                />
              </div>
            )}
          </div>

          <button
            onClick={startInterview}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg shadow-md transition-all flex items-center justify-center space-x-2 mt-4"
          >
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            <span>Start Video Interview</span>
          </button>
        </div>
      </div>
    </div>
  );

  const renderInterviewScreen = () => {
    // Get the last question from the bot
    const lastQuestion = chatHistory.filter(m => m.role === 'bot').slice(-1)[0]?.text;

    return (
      <div className="fixed inset-0 bg-gray-900 flex flex-col">
        {/* Main Video Area */}
        <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
          {/* User Video Feed */}
          {isVideoEnabled ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover transform scale-x-[-1]" // Mirror effect
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-gray-500">
              <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                <User className="w-12 h-12" />
              </div>
              <p>Camera Off</p>
            </div>
          )}

          {/* AI Question Overlay (Top Left) */}
          <div className="absolute top-6 left-6 right-6 md:right-auto md:max-w-xl z-20">
            <div className="bg-gray-900/90 backdrop-blur-sm p-6 rounded-2xl shadow-2xl border border-gray-700 animate-fade-in-down">
              <div className="flex items-start space-x-4">
                <div className="bg-indigo-600 p-2 rounded-lg shrink-0">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-indigo-300 text-xs font-bold uppercase tracking-wider mb-1">Interviewer</h3>
                  <p className="text-white text-lg font-medium leading-relaxed">
                    {loading ? (
                      <span className="flex items-center gap-2 text-gray-400">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        {isGeneratingFeedback ? "Generating Feedback Report..." : "Generating next question..."}
                      </span>
                    ) : lastQuestion}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Timer Overlay (Top Right) */}
          <div className="absolute top-6 right-6 z-20">
            <div className={`flex items-center space-x-2 px-4 py-2 rounded-full backdrop-blur-md border ${timer > 120 ? 'bg-red-500/80 border-red-400 text-white' : 'bg-black/50 border-gray-600 text-gray-200'}`}>
              <Clock className="w-4 h-4" />
              <span className="font-mono font-medium">{formatTime(timer)}</span>
            </div>
          </div>

          {/* Transcript / Subtitles Overlay (Bottom) */}
          <div className="absolute bottom-24 left-0 right-0 px-8 flex justify-center z-20">
            <div className="max-w-3xl text-center">
              {(currentInput || interimInput) && (
                <div className="inline-block bg-black/60 backdrop-blur-sm px-6 py-3 rounded-xl text-white text-lg font-medium shadow-lg transition-all">
                  {currentInput} <span className="text-gray-400">{interimInput}</span>
                </div>
              )}
              {isMicEnabled && !currentInput && !interimInput && !loading && (
                <p className="text-gray-400 text-sm animate-pulse">Listening...</p>
              )}
            </div>
          </div>
        </div>

        {/* Control Bar */}
        <div className="h-20 bg-gray-900 border-t border-gray-800 flex items-center justify-between px-8 z-30">
          <div className="flex items-center space-x-4">
            <div className="text-white text-sm">
              <p className="font-bold">{role}</p>
              <p className="text-gray-400 text-xs">Question {questionCount + 1}</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsMicEnabled(!isMicEnabled)}
              className={`p-4 rounded-full transition-all ${isMicEnabled ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-red-500 text-white hover:bg-red-600'}`}
            >
              {isMicEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>

            <button
              onClick={() => setIsVideoEnabled(!isVideoEnabled)}
              className={`p-4 rounded-full transition-all ${isVideoEnabled ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-red-500 text-white hover:bg-red-600'}`}
            >
              {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>

            <button
              onClick={() => {
                if (confirm("End interview?")) endInterview();
              }}
              className="p-4 rounded-full bg-red-600 text-white hover:bg-red-700 transition-all"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center justify-end w-48">
            <button
              onClick={handleSendMessage}
              disabled={loading || (!currentInput && !interimInput)}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-full font-bold flex items-center shadow-lg transition-all"
            >
              <span>Submit Answer</span>
              <Send className="w-4 h-4 ml-2" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderFeedbackScreen = () => {
    if (!feedbackReport) return null;

    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
              <Award className="w-6 h-6 mr-2 text-yellow-500" />
              Interview Analysis
            </h2>
            <div className="flex space-x-3">
              <button
                onClick={downloadTranscript}
                className="flex items-center px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 shadow-sm"
              >
                <FileText className="w-4 h-4 mr-2" />
                Transcript
              </button>
              <button
                onClick={() => setScreen('setup')}
                className="flex items-center px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                New Interview
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 md:col-span-2">
              <h3 className="font-semibold text-gray-500 uppercase text-xs tracking-wider mb-2">Executive Summary</h3>
              <p className="text-gray-800 leading-relaxed">{feedbackReport.summary}</p>
            </div>
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-2xl shadow-lg text-white flex flex-col items-center justify-center">
              <div className="text-5xl font-bold mb-2">{feedbackReport.rating}</div>
              <div className="text-indigo-100 text-sm font-medium">Overall Rating</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-green-50 p-6 rounded-2xl border border-green-100">
              <h3 className="font-bold text-green-800 mb-4 flex items-center">
                <span className="bg-green-200 p-1 rounded mr-2">👍</span>
                Key Strengths
              </h3>
              <ul className="space-y-2">
                {feedbackReport.strengths.map((point, i) => (
                  <li key={i} className="flex items-start text-green-900 text-sm">
                    <span className="mr-2">•</span>{point}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100">
              <h3 className="font-bold text-orange-800 mb-4 flex items-center">
                <span className="bg-orange-200 p-1 rounded mr-2">📈</span>
                Areas for Improvement
              </h3>
              <ul className="space-y-2">
                {feedbackReport.improvements.map((point, i) => (
                  <li key={i} className="flex items-start text-orange-900 text-sm">
                    <span className="mr-2">•</span>{point}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-6">
            <div>
              <h3 className="font-bold text-gray-800 mb-2 flex items-center">
                <Cpu className="w-5 h-5 mr-2 text-indigo-500" />
                Technical Assessment
              </h3>
              <div className="p-4 bg-gray-50 rounded-xl text-gray-700 text-sm leading-relaxed border border-gray-100">
                {feedbackReport.technical_analysis}
              </div>
            </div>

            <div>
              <h3 className="font-bold text-gray-800 mb-2 flex items-center">
                <User className="w-5 h-5 mr-2 text-blue-500" />
                Communication Style
              </h3>
              <div className="p-4 bg-gray-50 rounded-xl text-gray-700 text-sm leading-relaxed border border-gray-100">
                {feedbackReport.communication_analysis}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {screen === 'setup' && renderSetupScreen()}
      {screen === 'interview' && renderInterviewScreen()}
      {screen === 'feedback' && renderFeedbackScreen()}
    </div>
  );
};

export default MockInterviewBot;