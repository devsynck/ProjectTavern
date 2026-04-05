"use client";

import { useState } from "react";
import { Terminal, Play, Square, RefreshCcw, Activity } from "lucide-react";
import styles from "../settings/settings.module.css";

export default function LlamaConsole() {
  const [logs, setLogs] = useState([
    "[System] Llama Manager initialized.",
    "[Info] Waiting for server start command..."
  ]);

  const [status, setStatus] = useState("Offline");

  const startServer = () => {
    setLogs(prev => [...prev, "[Command] Executing: llama-server.exe -m model.gguf -ngl 99"]);
    setStatus("Starting");
    setTimeout(() => {
      setLogs(prev => [...prev, "[Success] HTTP server listening at 127.0.0.1:8080"]);
      setStatus("Online");
    }, 2000);
  };

  const stopServer = () => {
    setLogs(prev => [...prev, "[Command] Stopping server..."]);
    setStatus("Offline");
  };

  return (
    <div className={`${styles.container} animate-entrance`}>
      <header className={styles.settingsHeader}>
        <div>
          <h1 className="glow-gold" style={{ fontSize: '2.5rem', fontFamily: 'var(--font-serif)', letterSpacing: '2px' }}>
            LLM Console
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Real-time Process Monitoring & Control
          </p>
        </div>
      </header>

      <div className={styles.tabbedLayout}>
        {/* Controls Sidebar */}
        <div className={styles.tabSidebar} style={{ width: '280px' }}>
          <div className={styles.section} style={{ padding: '24px' }}>
            <div className={styles.title} style={{ fontSize: '1.2rem' }}>Controls</div>
            
            <div className={styles.statusBox} style={{ border: status === 'Online' ? '1px solid #4ade8033' : '1px solid var(--glass-border)' }}>
              <Activity size={16} color={status === 'Online' ? '#4ade80' : '#888'} />
              <span>Status: <span style={{ color: status === 'Online' ? '#4ade80' : '#fff', fontWeight: 600 }}>{status}</span></span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {status === "Offline" ? (
                <button className="btn-premium" style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={startServer}>
                  <Play size={16} /> Start Server
                </button>
              ) : (
                <button className="btn-premium" style={{ width: '100%', background: '#d32f2f', color: '#fff', boxShadow: '0 4px 0 #b71c1c', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={stopServer}>
                  <Square size={16} /> Stop Server
                </button>
              )}
              
              <button className={styles.input} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }} onClick={() => setLogs([])}>
                <RefreshCcw size={16} /> Clear Scroll
              </button>
            </div>
          </div>
        </div>

        {/* Console Output */}
        <div className={styles.tabContent}>
          <div className={styles.section} style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ 
              background: 'rgba(0,0,0,0.4)', 
              padding: '24px', 
              fontFamily: 'monospace', 
              fontSize: '0.9rem', 
              height: '600px', 
              overflowY: 'auto',
              border: 'none'
            }}>
              {logs.map((log, i) => (
                <div key={i} style={{ marginBottom: '8px', display: 'flex', gap: '16px' }}>
                  <span style={{ opacity: 0.3 }}>{new Date().toLocaleTimeString()}</span>
                  <span style={{ 
                    color: log.includes("[Command]") ? 'var(--accent-gold)' : 
                           log.includes("[Success]") ? '#4ade80' : 
                           log.includes("[System]") ? 'var(--accent-amber)' : 
                           'var(--text-main)' 
                  }}>
                    {log}
                  </span>
                </div>
              ))}
              {status === "Starting" && <div style={{ animation: 'pulse 1.5s infinite', color: 'var(--accent-gold)', marginTop: '8px' }}>Initializing engine...</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
