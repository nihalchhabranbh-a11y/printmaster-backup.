import React, { useState, useEffect, useRef } from "react";
import { processVoiceCommandAI, transcribeAudio } from "./aiAgentService.js";

const IconMic = ({ size = 24, glow = false }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
       style={{ filter: glow ? "drop-shadow(0 0 8px rgba(79, 103, 255, 0.8))" : "none" }}>
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="22"/>
  </svg>
);

const IconX = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

export default function VoiceAssistant({ products, bills, customers, user, setPage, setJumpToCustomer, setAdvancedDraft, addVoiceTask }) {
  const [listening, setListening] = useState(false);
  const [continuousMode, setContinuousMode] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const recognitionRef = useRef(null);
  const keepListeningRef = useRef(false);
  
  // AI Memory (local ephemeral memory for the voice session)
  const [memory, setMemory] = useState({
    customerName: null, phone: null,
    lastProductId: null, lastProductName: null, lastRate: null,
    lastWidth: null, lastHeight: null, lastQty: null, lastTotal: null,
    pendingTask: null, pendingField: null,
    rateHistory: {}, orderCount: 0,
  });

  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimeoutRef = useRef(null);

  const startRecordingCommand = async () => {
    try { recognitionRef.current?.stop(); } catch(e){}
    setListening(false);
    setIsOpen(true);
    setTranscript("🎙️ Listening to your command now...");
    setRecording(true);
    setResponse("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        setRecording(false);
        setTranscript("Transcribing audio...");
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];
        
        const text = await transcribeAudio(audioBlob);
        
        if (text) {
           handleVoiceCommand(text);
        } else {
           setResponse("Audio transcription failed. Please try again.");
           resumeWakeWordDetection();
        }
      };

      mediaRecorder.start();
      
      recordingTimeoutRef.current = setTimeout(() => {
         stopRecordingCommand();
      }, 6000);

    } catch (err) {
      console.error("Microphone access denied or error:", err);
      setResponse("Microphone error.");
      resumeWakeWordDetection();
    }
  };

  const stopRecordingCommand = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
    }
  };

  const resumeWakeWordDetection = () => {
     if (keepListeningRef.current) {
        setTimeout(() => {
           try { recognitionRef.current?.start(); } catch(e){}
        }, 1000);
     }
  };

  useEffect(() => {
    // Check for SpeechRecognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition API not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = continuousMode;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setListening(true);
      if (!continuousMode) setTranscript("Listening...");
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      const currentText = finalTranscript || interimTranscript;
      
      if (!continuousMode || isOpen) {
         setTranscript(currentText);
      }
      
      if (finalTranscript) {
        const lower = finalTranscript.toLowerCase();
        
        if (continuousMode) {
           // Stealth Wake Word detection
           const wakeWords = ["archer", "acha", "achar", "arthur", "arcur", "ache", "aashir", "arcer"];
           if (wakeWords.some(w => lower.includes(w))) {
              setIsOpen(true);
              // Wake Word detected! Start high-quality recording
              if (window.speechSynthesis) {
                  window.speechSynthesis.speak(new SpeechSynthesisUtterance("Yes?"));
              }
              startRecordingCommand();
           } else if (isOpen && finalTranscript.trim().length > 1) {
              // If already open but not recording via Whisper, fallback to processing transcript
              handleVoiceCommand(finalTranscript.trim());
           }
        } else {
           // Normal push-to-talk
           handleVoiceCommand(finalTranscript);
        }
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      if (event.error !== "no-speech") setTranscript(`Error: ${event.error}`);
      if (!continuousMode) {
         setListening(false);
         setTimeout(() => setIsOpen(false), 2000);
      }
    };

    recognition.onend = () => {
      if (keepListeningRef.current) {
         // Auto-restart if hands-free is enabled
         try { recognition.start(); } catch (e) {}
      } else {
         setListening(false);
      }
    };

    recognitionRef.current = recognition;

    if (keepListeningRef.current) {
       try { recognition.start(); } catch (e) {}
    }

    return () => {
       try { recognition.stop(); } catch(e) {}
       recognition.onend = null;
    };
  }, [products, bills, customers, memory, user, continuousMode]);

  const toggleListen = () => {
    if (listening && !continuousMode) {
      keepListeningRef.current = false;
      recognitionRef.current?.stop();
    } else {
      keepListeningRef.current = false;
      setContinuousMode(false);
      startRecordingCommand();
    }
  };

  const toggleHandsFree = () => {
     if (continuousMode) {
        keepListeningRef.current = false;
        setContinuousMode(false);
        recognitionRef.current?.stop();
        setTranscript("Hands-free disabled.");
        setTimeout(() => setIsOpen(false), 2000);
     } else {
        keepListeningRef.current = true;
        setContinuousMode(true);
        setIsOpen(false); // keep hidden!
        setTranscript(""); // clear transcript!
        try { recognitionRef.current?.stop(); } catch(e){}
        setTimeout(() => {
           try { recognitionRef.current?.start(); } catch(e){}
        }, 500);
     }
  };

  const handleVoiceCommand = async (commandText) => {
    if (!continuousMode) {
       recognitionRef.current?.stop();
    }
    
    setTranscript(`"${commandText}"`);
    setResponse("Thinking...");

    // Call our Serverless API securely
    const result = await processVoiceCommandAI(commandText, { products, bills, customers, tasks: [] });
    
    if (result && result.spoken_text) {
      setResponse(result.spoken_text);

      let cleanResponse = result.spoken_text;

      // Executing AI-Driven Actions securely without evaluating raw code
      if (result.action) {
         if (result.action.type === "NAVIGATE" && result.action.payload) {
             setPage(result.action.payload);
         } else if (result.action.type === "CREATE_TASK" && addVoiceTask && result.action.payload) {
             addVoiceTask(result.action.payload);
             setPage("tasks");
         } else if (result.action.type === "CREATE_DRAFT_BILL" && setAdvancedDraft && result.action.payload) {
             setAdvancedDraft(result.action.payload);
             setPage("create-bill");
         } else if (result.action.type === "CREATE_PAYMENT_IN" && setAdvancedDraft && result.action.payload) {
             setAdvancedDraft({ ...result.action.payload, docType: "Payment In" });
         }
      }

      if (window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(cleanResponse);
        utterance.rate = 1.05;
        utterance.pitch = 1.1;
        window.speechSynthesis.speak(utterance);
      }
    } else {
      setResponse("I didn't understand that. Please try again.");
    }
    
    setTimeout(() => {
        setIsOpen(false);
        resumeWakeWordDetection();
    }, 5000);
  };

  return (
    <>
      <div style={{ position: "fixed", bottom: 96, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
         {continuousMode ? (
            <button onClick={toggleHandsFree} style={{ background: "#ef4444", border: "none", color: "white", padding: "6px 14px", borderRadius: 18, fontSize: "0.8rem", fontWeight: "bold", animation: "pulse 2s infinite", cursor: "pointer", boxShadow: "0 4px 12px rgba(239, 68, 68, 0.4)" }}>
               🔴 Always On (Click to Off)
            </button>
         ) : (
            <button onClick={toggleHandsFree} style={{ background: "rgba(30,41,59,0.8)", backdropFilter: "blur(4px)", color: "#cbd5e1", padding: "6px 14px", borderRadius: 18, fontSize: "0.8rem", fontWeight: "bold", cursor: "pointer", border: "1px solid rgba(255,255,255,0.1)" }}>
               🎙️ Hands-Free Mode
            </button>
         )}
      </div>

      <button 
        onClick={toggleListen}
        className="voice-fab"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 60,
          height: 60,
          borderRadius: "50%",
          background: listening ? "#10b981" : "linear-gradient(135deg, #4F67FF, #7c3aed)",
          color: "#fff",
          border: "none",
          boxShadow: listening ? "0 4px 20px rgba(16, 185, 129, 0.6)" : "0 4px 20px rgba(79, 103, 255, 0.5)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          cursor: "pointer",
          zIndex: 9999,
          transition: "all 0.3s ease",
          transform: listening ? "scale(1.05)" : "scale(1)"
        }}
        title="Activate AI Voice Assistant"
      >
        <IconMic glow={listening} />
      </button>

      {(isOpen || listening) && (
        <div style={{
          position: "fixed",
          bottom: 100,
          right: 24,
          width: 320,
          background: "rgba(30, 41, 59, 0.95)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 16,
          padding: 20,
          color: "#fff",
          boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
          zIndex: 9998,
          animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {recording ? (
                <div style={{ display: "flex", gap: 4 }}>
                   <div className="v-bar v-bar-1" style={{ background: "#ef4444" }}/>
                   <div className="v-bar v-bar-2" style={{ background: "#ef4444" }}/>
                   <div className="v-bar v-bar-3" style={{ background: "#ef4444" }}/>
                </div>
              ) : listening ? (
                <div style={{ display: "flex", gap: 4 }}>
                   <div className="v-bar v-bar-1"/>
                   <div className="v-bar v-bar-2"/>
                   <div className="v-bar v-bar-3"/>
                </div>
              ) : (
                <span style={{ fontSize: "1.2rem", cursor: "pointer" }} onClick={recording ? stopRecordingCommand : startRecordingCommand}>
                  🤖
                </span>
              )}
              <span style={{ fontWeight: 600, fontSize: "0.95rem", letterSpacing: "-0.01em" }}>
                {recording ? "Recording..." : listening ? "Awaiting Wake Word..." : "PrintMaster AI"}
              </span>
            </div>
            <button onClick={() => { setIsOpen(false); stopRecordingCommand(); resumeWakeWordDetection(); }} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", padding: 4 }}>
              <IconX />
            </button>
          </div>

          <div style={{ fontSize: "1rem", fontWeight: 500, color: "#fff", marginBottom: 12, fontStyle: transcript.includes("Listening") ? "italic" : "normal" }}>
            "{transcript}"
          </div>

          {response && (
            <div style={{
              background: "rgba(255, 255, 255, 0.05)",
              padding: 12,
              borderRadius: 12,
              fontSize: "0.85rem",
              color: "#cbd5e1",
              lineHeight: 1.5,
              maxHeight: 120,
              overflowY: "auto",
              whiteSpace: "pre-wrap"
            }}>
              {response}
            </div>
          )}

          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
             <input
                type="text"
                placeholder="Or type your command here..."
                autoFocus
                onKeyDown={(e) => {
                   if (e.key === "Enter" && e.target.value.trim()) {
                      const text = e.target.value.trim();
                      setTranscript(text);
                      e.target.value = "";
                      handleVoiceCommand(text);
                   }
                }}
                style={{
                   flex: 1,
                   padding: "8px 12px",
                   borderRadius: "8px",
                   border: "1px solid rgba(255,255,255,0.2)",
                   background: "rgba(0,0,0,0.2)",
                   color: "#fff",
                   fontSize: "0.85rem",
                   outline: "none"
                }}
             />
          </div>

          <style dangerouslySetInnerHTML={{__html:`
            @keyframes slideUp {
              from { opacity: 0; transform: translateY(20px) scale(0.95); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
            .v-bar {
              width: 3px; background: #10b981; border-radius: 3px;
              animation: vBounce 1s ease-in-out infinite;
            }
            .v-bar-1 { height: 12px; animation-delay: 0.1s; }
            .v-bar-2 { height: 16px; animation-delay: 0.2s; }
            .v-bar-3 { height: 10px; animation-delay: 0.3s; }
            @keyframes vBounce {
              0%, 100% { transform: scaleY(0.5); opacity: 0.5; }
              50% { transform: scaleY(1); opacity: 1; }
            }
          `}} />
        </div>
      )}
    </>
  );
}
