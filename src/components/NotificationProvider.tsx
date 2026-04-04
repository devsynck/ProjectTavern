"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle, AlertCircle, X } from "lucide-react";

type NotificationType = "success" | "error" | "info";

interface Notification {
  id: string;
  message: string;
  type: NotificationType;
}

interface NotificationContextType {
  showNotification: (message: string, type?: NotificationType) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const showNotification = useCallback((message: string, type: NotificationType = "info") => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications((prev) => [...prev, { id, message, type }]);
    
    // Auto-remove after 4 seconds
    setTimeout(() => removeNotification(id), 4000);
  }, [removeNotification]);

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      
      {/* Notification Portal */}
      <div style={{
        position: "fixed",
        top: "32px",
        right: "32px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        zIndex: 5000,
        pointerEvents: "none"
      }}>
        {notifications.map((n) => (
          <div
            key={n.id}
            className="parchment animate-entrance"
            style={{
              pointerEvents: "auto",
              padding: "16px 24px",
              minWidth: "300px",
              display: "flex",
              alignItems: "center",
              gap: "16px",
              border: `1px solid ${n.type === "success" ? "#c5a059" : "#f87171"}`,
              boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
              background: "var(--surface-parchment)",
              color: "var(--text-dark)",
              borderRadius: "4px"
            }}
          >
            {n.type === "success" ? <CheckCircle size={20} color="#c5a059" /> : <AlertCircle size={20} color="#f87171" />}
            <span style={{ flex: 1, fontWeight: 600, fontSize: "0.95rem" }}>{n.message}</span>
            <button 
              onClick={() => removeNotification(n.id)}
              style={{ background: "transparent", border: "none", cursor: "pointer", opacity: 0.3 }}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotification must be used within NotificationProvider");
  return context;
}
