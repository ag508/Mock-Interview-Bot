import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, Settings, Play, RefreshCw, FileText, Download, Award, Briefcase, Code, Cpu } from 'lucide-react';

// --- Configuration ---
// Note: In this environment, we use the system-provided key. 
// Ideally, for external deployment, use process.env.REACT_APP_GEMINI_API_KEY
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
  const [chatHistory, setChatHistory] = useState([]); // Array of { role: 'user' | 'model', text: string }
  const [currentInput, setCurrentInput] = useState('');
  const [questionCount, setQuestionCount] = useState(0);
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [currentInput]);

  // Feedback State
  const [feedbackReport, setFeedbackReport] = useState(null);

  // --- Effects ---
  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, screen]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // --- API Interaction ---
  const callGemini = async (prompt, history = [], isSystemInstruction = false) => {
    // In this environment, the key is injected automatically if empty.
    // For external usage, fallback to the user-provided key.
    const keyToUse = apiKey || "";

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${keyToUse}`;

    const formattedHistory = history.map(msg => ({
      role: msg.role === 'bot' ? 'model' : 'user',
      parts: [{ text: msg.text }]
    }));

    // If it's a fresh start, we prepend the system instruction as the first user message 
    // (or use the systemInstruction field if supported, but prepending is safer for chat context in simple impl)
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
          // We use system instructions for the persona to ensure it stays in character
          systemInstruction: isSystemInstruction ? {
            parts: [{ text: isSystemInstruction }]
          } : undefined
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      return data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error("Gemini API Error:", error);
      return "Error connecting to the AI. Please check your API key or connection.";
    }
  };

  // --- Handlers ---

  const startInterview = async () => {
    setLoading(true);
    setChatHistory([]);
    setQuestionCount(0);
    setFeedbackReport(null);

    const systemPrompt = `
      You are an expert interviewer for a ${role} position. 
      The candidate has the following experience: ${experience}.
      Key skills to assess: ${skills}.
      
      Evaluation Rubric/Focus: ${rubric}.
      
      Your Goal: Conduct a mock interview. 
      1. Start by welcoming the candidate and asking the first question.
      2. Ask ONE question at a time.
      3. Wait for the candidate's response.
      4. If the response is too brief, probe deeper.
      5. Keep the tone professional but conversational.
      6. Do not provide feedback yet, just interview.
    `;

    // Initial greeting trigger
    const initialGreeting = await callGemini("Start the interview.", [], systemPrompt);

    setChatHistory([
      { role: 'system_hidden', text: systemPrompt }, // Store system prompt for context but hide it
      { role: 'bot', text: initialGreeting }
    ]);

    setScreen('interview');
    setLoading(false);
  };

  const handleSendMessage = async () => {
    if (!currentInput.trim()) return;

    const userMsg = { role: 'user', text: currentInput };
    const updatedHistory = [...chatHistory, userMsg];

    setChatHistory(updatedHistory);
    setCurrentInput('');
    setLoading(true);

    // Filter out the hidden system prompt for the visual history, but keep it for logic if needed
    // Actually, we pass the "system_hidden" as the systemInstruction param in the call
    const visibleHistory = updatedHistory.filter(m => m.role !== 'system_hidden');
    const systemPrompt = chatHistory.find(m => m.role === 'system_hidden')?.text;

    const botResponse = await callGemini(null, visibleHistory, systemPrompt); // passing null prompt implies continue conversation based on history

    setChatHistory(prev => [...prev, { role: 'bot', text: botResponse }]);
    setQuestionCount(prev => prev + 1);
    setLoading(false);
  };

  const endInterview = async () => {
    setLoading(true);

    const visibleHistory = chatHistory.filter(m => m.role !== 'system_hidden');
    const systemPrompt = chatHistory.find(m => m.role === 'system_hidden')?.text;

    const feedbackPrompt = `
      The interview is concluded. 
      Based on the conversation history above, provide detailed structured feedback.
      
      Format the response as JSON with the following fields:
      - "summary": A brief summary of the candidate's performance.
      - "strengths": An array of bullet points highlighting strong areas.
      - "improvements": An array of bullet points for areas to improve.
      - "rating": A score out of 10.
      - "technical_analysis": specific feedback on the technical accuracy of their answers regarding ${skills}.
      - "communication_analysis": feedback on their clarity and style.
      
      Do not output markdown code blocks, just the raw JSON string.
    `;

    try {
      // We send the whole history plus the feedback request
      const rawFeedback = await callGemini(feedbackPrompt, visibleHistory, systemPrompt);

      // Attempt to parse JSON (sometimes models add markdown backticks)
      const cleanJson = rawFeedback.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedFeedback = JSON.parse(cleanJson);
      setFeedbackReport(parsedFeedback);
      setScreen('feedback');
    } catch (e) {
      console.error("Parsing error", e);
      // Fallback if JSON parsing fails
      setFeedbackReport({
        summary: "Could not generate structured JSON. Here is the raw output:",
        strengths: ["Raw Output"],
        improvements: [],
        rating: "?/10",
        technical_analysis: rawFeedback,
        communication_analysis: ""
      });
      setScreen('feedback');
    }

    setLoading(false);
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
    a.download = `interview-transcript-${new Date().toISOString()}.txt`;
    a.click();
  };

  // --- Components ---

  // --- Render Functions ---

  const renderSetupScreen = () => (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-indigo-100">
        <div className="text-center mb-8">
          <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bot className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Mock Interview AI</h1>
          <p className="text-gray-500 mt-2">Powered by Gemini 3 Pro (Preview)</p>
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
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                placeholder="e.g. Product Manager"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Tech Stack / Skills</label>
              <div className="relative">
                <Code className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Python, SQL, AWS"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Evaluation Rubric / Focus</label>
            <textarea
              value={rubric}
              onChange={(e) => setRubric(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
              placeholder="Describe how the bot should evaluate you..."
            />
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
                <p className="text-xs text-gray-400 mt-1">Leave empty to use the environment default.</p>
              </div>
            )}
          </div>

          <button
            onClick={startInterview}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg shadow-md transition-all flex items-center justify-center space-x-2 mt-4"
          >
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            <span>Start Interview</span>
          </button>
        </div>
      </div>
    </div>
  );

  const renderInterviewScreen = () => (
    <div className="flex flex-col h-[600px] bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
      {/* Header */}
      <div className="bg-indigo-600 p-4 text-white flex justify-between items-center shadow-md z-10">
        <div>
          <h2 className="font-bold flex items-center">
            <Briefcase className="w-4 h-4 mr-2" />
            {role} Interview
          </h2>
          <p className="text-xs text-indigo-200 opacity-90">{skills}</p>
        </div>
        <button
          onClick={endInterview}
          className="text-xs bg-indigo-500 hover:bg-indigo-400 px-3 py-1 rounded-full transition-colors border border-indigo-400"
        >
          End & Get Feedback
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {chatHistory.filter(m => m.role !== 'system_hidden').map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`
              max-w-[80%] rounded-2xl px-5 py-3 shadow-sm
              ${msg.role === 'user'
                ? 'bg-indigo-600 text-white rounded-br-none'
                : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'}
            `}>
              <div className="flex items-center mb-1 opacity-70 text-xs font-medium">
                {msg.role === 'user' ? <User className="w-3 h-3 mr-1" /> : <Bot className="w-3 h-3 mr-1" />}
                {msg.role === 'user' ? 'Candidate' : 'Interviewer'}
              </div>
              <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center space-x-2">
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-100">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Type your answer here..."
            className="w-full pl-4 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none max-h-32 shadow-sm overflow-y-auto"
            rows={1}
            disabled={loading}
          />
          <button
            onClick={handleSendMessage}
            disabled={loading || !currentInput.trim()}
            className="absolute right-2 top-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-center text-gray-400 mt-2">
          Press Enter to send. Shift+Enter for new line.
        </p>
      </div>
    </div>
  );

  const renderFeedbackScreen = () => {
    if (!feedbackReport) return null;

    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
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

        {/* Score Card */}
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

        {/* Detailed Analysis */}
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

        {/* Deep Dive */}
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
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">InterviewBot</span>
          </div>
          {screen !== 'setup' && (
            <button
              onClick={() => {
                if (confirm("End current session?")) setScreen('setup');
              }}
              className="text-sm text-gray-500 hover:text-red-500 transition-colors"
            >
              Exit Session
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {screen === 'setup' && renderSetupScreen()}
        {screen === 'interview' && renderInterviewScreen()}
        {screen === 'feedback' && renderFeedbackScreen()}
      </main>
    </div>
  );
};

export default MockInterviewBot;