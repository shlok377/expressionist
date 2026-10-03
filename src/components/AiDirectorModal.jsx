import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  X,
  Mic,
  MicOff,
  FileText,
  Copy,
  Check,
  Key,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Settings2,
  Clock,
  Layers,
  ExternalLink,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import {
  PACING_WPM,
  PERSONALITY_PRESETS,
  estimateScriptDuration,
  formatSequence,
} from '../utils/aiDirector.js';

const STORAGE_KEY_GEMINI_API = 'expressionist_gemini_api_key';

export default function AiDirectorModal({
  isOpen,
  onClose,
  availableExpressions = [],
}) {
  // Credentials
  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_GEMINI_API) || '';
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Input state
  const [activeTab, setActiveTab] = useState('text'); // 'text' | 'mic'
  const [scriptText, setScriptText] = useState('');
  const [pacing, setPacing] = useState('normal');
  const [manualDuration, setManualDuration] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState('high-energy');
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-3.8-flash');

  // Mic state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);

  // Generation & Output state
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState(null);
  const [resultData, setResultData] = useState(null);
  const [outputFormat, setOutputFormat] = useState('clean'); // 'clean' | 'extension' | 'json'
  const [isCopied, setIsCopied] = useState(false);

  // Persist API Key
  useEffect(() => {
    if (apiKey) {
      localStorage.setItem(STORAGE_KEY_GEMINI_API, apiKey.trim());
    }
  }, [apiKey]);

  // Check Web Speech API support
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
    }
  }, []);

  // Cleanup mic on unmount or close
  useEffect(() => {
    if (!isOpen && isRecording) {
      stopRecording();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Speech Recognition handlers
  function startRecording() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMessage('Speech recognition is not supported in this browser. Please use text mode.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      let baseText = scriptText.trim() ? scriptText.trim() + ' ' : '';

      recognition.onresult = (event) => {
        let interim = '';
        let finalized = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalized += event.results[i][0].transcript + ' ';
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        setScriptText(baseText + finalized + interim);
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setErrorMessage('Microphone access denied. Please grant microphone permissions.');
        }
        stopRecording();
      };

      recognition.onend = () => {
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
      setRecordingSeconds(0);
      setErrorMessage(null);

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setRecordingSeconds(Math.round(((Date.now() - startTime) / 1000) * 10) / 10);
      }, 100);
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setErrorMessage(`Microphone error: ${err.message}`);
      setIsRecording(false);
    }
  }

  function stopRecording() {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
  }

  function toggleRecording() {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  // Calculate target duration
  const estimatedWpmDuration = estimateScriptDuration(scriptText, pacing);
  const activeDuration =
    activeTab === 'mic' && recordingSeconds > 0
      ? recordingSeconds
      : manualDuration && parseFloat(manualDuration) > 0
      ? parseFloat(manualDuration)
      : estimatedWpmDuration;

  const activePreset =
    PERSONALITY_PRESETS.find((p) => p.id === selectedPresetId) ||
    PERSONALITY_PRESETS[0];

  // Submit to AI Director backend
  async function handleGenerate(e) {
    e?.preventDefault();
    if (!apiKey.trim()) {
      setIsSettingsOpen(true);
      setErrorMessage('Please enter your Gemini API key in settings below.');
      return;
    }

    if (!scriptText.trim()) {
      setErrorMessage('Please provide a script or record voiceover first.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setRetryAfterSeconds(null);

    try {
      const response = await fetch('/api/ai/director', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': apiKey.trim(),
        },
        body: JSON.stringify({
          script: scriptText.trim(),
          targetDuration: activeDuration > 0 ? activeDuration : null,
          personality: activePreset.name,
          customPrompt:
            selectedPresetId === 'custom'
              ? customPrompt
              : `${activePreset.prompt} ${customPrompt}`.trim(),
          model: selectedModel,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        if (response.status === 429 && data.retryAfter) {
          setRetryAfterSeconds(data.retryAfter);
        }
        throw new Error(data.error || 'Failed to generate expression sequence');
      }

      setResultData(data);
    } catch (err) {
      console.error('Generation error:', err);
      setErrorMessage(err.message || 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  }

  // Copy sequence string to clipboard
  function handleCopy() {
    if (!resultData?.items) return;
    const formatted = formatSequence(resultData.items, outputFormat);
    navigator.clipboard.writeText(formatted);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 animate-in fade-in duration-150">
      <div className="bg-[#212429] border border-[#36393e] rounded-[24px] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-[#e2e2e9]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#36393e] flex items-center justify-between shrink-0 bg-[#1d2024]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#0842a0] text-[#d3e3fd] flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-semibold tracking-tight text-[#e2e2e9]">
                  AI Script Director
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#3f4759] text-[#dbe2f9]">
                  Beta
                </span>
              </div>
              <p className="text-xs text-[#c4c6d0]">
                Map voiceover text or speech into expressive timeline sequences
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {/* Toggle button besides cross to edit / replace API key */}
            <button
              type="button"
              id="btn-toggle-api-key"
              onClick={() => setIsSettingsOpen((prev) => !prev)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                isSettingsOpen
                  ? 'bg-[#3f4759] text-[#a8c7fa]'
                  : 'bg-[#282a2f] text-[#c4c6d0] hover:text-[#e2e2e9] hover:bg-[#33353a]'
              }`}
              title="Edit or replace API Key"
            >
              <Key className="w-3.5 h-3.5 text-[#a8c7fa]" />
              <span>{apiKey ? 'API Key' : 'Set Key'}</span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  apiKey ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                }`}
              />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full text-[#c4c6d0] hover:text-[#e2e2e9] hover:bg-[#33353a] transition"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Settings Collapsible Drawer */}
          {(isSettingsOpen || !apiKey) && (
            <div className="bg-[#181a1f] border border-[#36393e] rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs font-medium text-[#a8c7fa]">
                  <Key className="w-4 h-4" />
                  <span>Google Gemini API Key</span>
                </div>
                <div className="flex items-center space-x-2">
                  {apiKey ? (
                    <span className="flex items-center space-x-1 text-[11px] text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Key Saved</span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-amber-400 font-medium">Key Required</span>
                  )}
                  <span className="text-[11px] text-[#8e9099]">• Local browser storage</span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => {
                      const val = e.target.value;
                      setApiKey(val);
                      if (val.trim()) {
                        localStorage.setItem(STORAGE_KEY_GEMINI_API, val.trim());
                      } else {
                        localStorage.removeItem(STORAGE_KEY_GEMINI_API);
                      }
                    }}
                    placeholder="Paste your Gemini API key (AIzaSy...)"
                    className="w-full bg-[#282a2f] border border-[#44474f] rounded-xl px-3.5 py-2 text-xs font-mono text-[#e2e2e9] placeholder-[#8e9099] focus:outline-none focus:border-[#a8c7fa] pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8e9099] hover:text-[#e2e2e9]"
                    title={showApiKey ? 'Hide key' : 'Show key'}
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {apiKey && (
                  <button
                    type="button"
                    onClick={() => {
                      setApiKey('');
                      localStorage.removeItem(STORAGE_KEY_GEMINI_API);
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-medium bg-[#3a1a1c] text-[#f2b8b5] hover:bg-[#4a2225] transition flex items-center space-x-1.5 shrink-0"
                    title="Clear or replace current API Key"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear / Replace</span>
                  </button>
                )}
              </div>

              {/* Direct link to create Gemini API key */}
              <div className="flex items-center justify-between pt-1">
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1.5 text-[11px] text-[#a8c7fa] hover:text-[#d3e3fd] hover:underline"
                >
                  <span>Create an API key from Google AI Studio</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <span className="text-[11px] text-[#8e9099]">Model: gemini-3.8-flash</span>
              </div>
            </div>
          )}

          {/* Mode Switcher Tabs */}
          <div className="flex items-center space-x-2 bg-[#181a1f] p-1 rounded-2xl border border-[#36393e]">
            <button
              onClick={() => setActiveTab('text')}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-xl text-xs font-medium transition ${
                activeTab === 'text'
                  ? 'bg-[#3f4759] text-[#dbe2f9]'
                  : 'text-[#c4c6d0] hover:text-[#e2e2e9]'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Text Script</span>
            </button>
            <button
              onClick={() => setActiveTab('mic')}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-xl text-xs font-medium transition ${
                activeTab === 'mic'
                  ? 'bg-[#3f4759] text-[#dbe2f9]'
                  : 'text-[#c4c6d0] hover:text-[#e2e2e9]'
              }`}
            >
              <Mic className="w-4 h-4" />
              <span>Live Microphone</span>
            </button>
          </div>

          {/* Live Mic Panel */}
          {activeTab === 'mic' && (
            <div className="bg-[#181a1f] border border-[#36393e] rounded-2xl p-4 space-y-3">
              {!speechSupported ? (
                <div className="flex items-start space-x-2.5 text-xs text-[#f2b8b5] bg-[#3a1a1c] p-3 rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari, or switch to the Text Script tab.
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      onClick={toggleRecording}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-full text-xs font-medium transition ${
                        isRecording
                          ? 'bg-[#8c1d18] text-[#f9dedc] hover:bg-[#a0221c] animate-pulse'
                          : 'bg-[#a8c7fa] text-[#062e6f] hover:bg-[#b8d2fa]'
                      }`}
                    >
                      {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      <span>{isRecording ? 'Stop Recording' : 'Start Recording'}</span>
                    </button>
                    {isRecording && (
                      <span className="flex items-center space-x-1.5 text-xs text-[#f2b8b5]">
                        <span className="w-2 h-2 rounded-full bg-[#f2b8b5] animate-ping" />
                        <span>Listening...</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1.5 text-xs font-mono bg-[#282a2f] border border-[#44474f] px-3 py-1.5 rounded-full text-[#c4c6d0]">
                    <Clock className="w-3.5 h-3.5 text-[#a8c7fa]" />
                    <span>Duration:</span>
                    <span className="text-[#a8c7fa] font-semibold">{recordingSeconds.toFixed(1)}s</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Script Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-medium text-[#c4c6d0]">
                {activeTab === 'mic' ? 'Voiceover Transcript (Editable)' : 'Voiceover Script'}
              </label>
              <span className="text-[#8e9099] text-[11px]">
                {scriptText.trim().split(/\s+/).filter(Boolean).length} words
              </span>
            </div>
            <textarea
              rows={4}
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              placeholder={
                activeTab === 'mic'
                  ? 'Click "Start Recording" and speak, or type/edit your voiceover transcript here...'
                  : 'Paste or type your voiceover script here. e.g. "Hey guys! Welcome back to my channel! Today we are looking at something crazy..."'
              }
              className="w-full bg-[#181a1f] border border-[#44474f] rounded-2xl p-3.5 text-xs text-[#e2e2e9] placeholder-[#8e9099] focus:outline-none focus:border-[#a8c7fa] resize-y"
            />
          </div>

          {/* Timing & Pacing Controls (when in text mode) */}
          {activeTab === 'text' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#181a1f] p-3.5 rounded-2xl border border-[#36393e]">
              <div>
                <label className="text-[11px] font-medium text-[#c4c6d0] block mb-1">
                  Speaking Pacing
                </label>
                <div className="flex space-x-1.5">
                  {['slow', 'normal', 'fast'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPacing(p)}
                      className={`flex-1 py-1.5 rounded-lg text-xs capitalize transition ${
                        pacing === p
                          ? 'bg-[#3f4759] text-[#dbe2f9] font-medium'
                          : 'bg-[#282a2f] text-[#8e9099] hover:text-[#c4c6d0]'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-[#c4c6d0] block mb-1">
                  Target Duration (Optional Override)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0.6"
                    value={manualDuration}
                    onChange={(e) => setManualDuration(e.target.value)}
                    placeholder={`~${estimatedWpmDuration.toFixed(1)}s (auto)`}
                    className="w-full bg-[#282a2f] border border-[#44474f] rounded-lg px-2.5 py-1 text-xs text-[#e2e2e9] placeholder-[#8e9099] focus:outline-none focus:border-[#a8c7fa]"
                  />
                  <span className="text-xs text-[#8e9099]">sec</span>
                </div>
              </div>
            </div>
          )}

          {/* Personality Selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-[#c4c6d0] block">
              Mascot Personality & Acting Style
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PERSONALITY_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedPresetId(preset.id)}
                  className={`text-left p-3 rounded-xl transition ${
                    selectedPresetId === preset.id
                      ? 'bg-[#3f4759] text-[#e2e2e9]'
                      : 'bg-[#181a1f] text-[#8e9099] hover:bg-[#282a2f]'
                  }`}
                >
                  <div className="text-xs font-medium text-[#e2e2e9]">{preset.name}</div>
                  <div className="text-[10px] text-[#8e9099] line-clamp-2 mt-0.5">
                    {preset.description}
                  </div>
                </button>
              ))}
            </div>

            {/* Custom Instructions */}
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Additional direction (e.g. 'acts flustered when talking about cookies', 'punchy 0.3s cuts')"
              className="w-full bg-[#181a1f] border border-[#44474f] rounded-xl px-3 py-2 text-xs text-[#e2e2e9] placeholder-[#8e9099] focus:outline-none focus:border-[#a8c7fa]"
            />
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="flex items-start space-x-2.5 text-xs text-[#f2b8b5] bg-[#3a1a1c] border border-[#8c1d18] p-3 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{errorMessage}</span>
                {retryAfterSeconds && (
                  <span className="block mt-1 text-[11px] text-[#ffdad6]">
                    Rate limit cooldown: Retry in {retryAfterSeconds} seconds.
                  </span>
                )}
                {!isSettingsOpen && (
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(true)}
                    className="mt-1.5 flex items-center space-x-1 text-[11px] text-[#a8c7fa] hover:underline font-medium"
                  >
                    <Key className="w-3 h-3" />
                    <span>Open API Key Settings</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Generate Button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || isRecording}
            className={`w-full py-3 rounded-full text-xs font-medium flex items-center justify-center space-x-2 transition ${
              isGenerating || isRecording
                ? 'bg-[#282a2f] text-[#8e9099] border border-[#44474f] cursor-not-allowed'
                : 'bg-[#a8c7fa] text-[#062e6f] hover:bg-[#b8d2fa]'
            }`}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Directing Expressions with Gemini...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>
                  Generate Expressions ({activeDuration > 0 ? `${activeDuration.toFixed(1)}s` : 'Auto'})
                </span>
              </>
            )}
          </button>

          {/* Output Preview Section */}
          {resultData && (
            <div className="bg-[#181a1f] border border-[#44474f] rounded-2xl p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs font-medium text-[#a8c7fa]">
                  <Layers className="w-4 h-4" />
                  <span>Generated Sequence ({resultData.count} cuts, {resultData.totalDuration}s total)</span>
                </div>
                {/* Format Toggle */}
                <div className="flex bg-[#282a2f] p-0.5 rounded-lg border border-[#44474f]">
                  <button
                    onClick={() => setOutputFormat('clean')}
                    className={`px-2 py-0.5 rounded text-[10px] transition ${
                      outputFormat === 'clean' ? 'bg-[#3f4759] text-[#e2e2e9]' : 'text-[#8e9099]'
                    }`}
                  >
                    Clean
                  </button>
                  <button
                    onClick={() => setOutputFormat('extension')}
                    className={`px-2 py-0.5 rounded text-[10px] transition ${
                      outputFormat === 'extension' ? 'bg-[#3f4759] text-[#e2e2e9]' : 'text-[#8e9099]'
                    }`}
                  >
                    .png
                  </button>
                  <button
                    onClick={() => setOutputFormat('json')}
                    className={`px-2 py-0.5 rounded text-[10px] transition ${
                      outputFormat === 'json' ? 'bg-[#3f4759] text-[#e2e2e9]' : 'text-[#8e9099]'
                    }`}
                  >
                    JSON
                  </button>
                </div>
              </div>

              {/* Formatted String Container */}
              <div className="relative group">
                <pre className="bg-[#282a2f] border border-[#44474f] rounded-xl p-3 text-xs font-mono text-[#dbe2f9] overflow-x-auto whitespace-pre-wrap select-all">
                  {formatSequence(resultData.items, outputFormat)}
                </pre>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="absolute top-2 right-2 flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#3f4759] text-[#e2e2e9] hover:bg-[#4b5469] transition"
                  title="Copy to clipboard"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#a8c7fa]" />
                      <span className="text-[#a8c7fa]">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Visual Breakdown Chips */}
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pt-1">
                {resultData.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-[#282a2f] border border-[#44474f] text-[11px]"
                  >
                    <span className="font-medium text-[#e2e2e9]">{item.expression}</span>
                    <span className="text-[#a8c7fa] font-mono text-[10px]">{item.duration.toFixed(1)}s</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
