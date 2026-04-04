"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MessageSquare, Bot, Plus, X } from "lucide-react";
import styles from "./sessions.module.css";
import ConfirmModal from "@/components/ConfirmModal";
import { tavernDB } from "@/utils/db";

export default function Home() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  const fetchSessions = async () => {
    let allSessions = await tavernDB.getAll<any>("sessions");
    const filtered = allSessions.filter(s => s && s.type === 'session');
    
    // MIGRATION: If no sessions exist in the Nexus, look for legacy scrolls
    if (filtered.length === 0) {
      const existingSessionsRaw = localStorage.getItem("tavern-sessions");
      if (existingSessionsRaw) {
        const legacySessions = JSON.parse(existingSessionsRaw);
        for (const s of legacySessions) {
          const charId = s.charId;
          const savedChat = localStorage.getItem(`tavern-chat-${s.id}`);
          if (savedChat) {
            await tavernDB.set("chats", s.id, JSON.parse(savedChat));
          }
          await tavernDB.set("sessions", s.id, { ...s, type: 'session' });
        }
        localStorage.removeItem("tavern-sessions");
        allSessions = await tavernDB.getAll<any>("sessions");
      }
    }
    
    setSessions(allSessions.filter(s => s && s.type === 'session').sort((a, b) => b.timestamp - a.timestamp));
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const openDeleteModal = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSessionToDelete(id);
    setIsDeleting(true);
  };

  const confirmDeletion = async () => {
    if (sessionToDelete) {
      await tavernDB.delete("sessions", sessionToDelete);
      await tavernDB.delete("chats", sessionToDelete);
      window.dispatchEvent(new Event("tavern-sessions-updated"));
      await fetchSessions();
      setSessionToDelete(null);
      setIsDeleting(false);
    }
  };

  return (
    <div className={`${styles.container} animate-entrance`}>
      <ConfirmModal 
        isOpen={isDeleting}
        onClose={() => setIsDeleting(false)}
        onConfirm={confirmDeletion}
        title="Consign to Oblivion"
        message="Are you sure you wish to permanently dismantle this manifestation? All progress and discourse history with this soul will be lost in the void."
        confirmText="Consign Soul"
        cancelText="Preserve"
      />
      <header className={styles.header}>
        <div className={styles.headerInfo}>
          <h1 className="glow-gold">Active Discourses</h1>
          <p>Resume your encounters within the Tavern</p>
        </div>
        <Link href="/library" className="btn-premium" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <Plus size={18} />
          <span>New Manifestation</span>
        </Link>
      </header>

      <div className={styles.grid}>
        {sessions.map((session: any) => (
          <Link key={session.id} href={`/chat/${session.id}`} className={styles.sessionCard}>
            <div className={styles.avatarWrapper}>
              {session.image ? (
                <Image src={session.image} alt={session.name} fill className={styles.avatar} sizes="200px" />
              ) : (
                <div className={styles.placeholder}><Bot size={40} /></div>
              )}
            </div>
            <div className={styles.info}>
              <h3>{session.name}</h3>
              <p className={styles.lastMessageSnippet}>{session.lastMessage}</p>
            </div>
            <div className={styles.actions} style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', opacity: 0.7 }}>
                <MessageSquare size={16} />
                <span>Resume</span>
              </div>
              <button 
                className={styles.deleteBtn}
                onClick={(e) => openDeleteModal(e, session.id)}
                title="Consign to Oblivion"
              >
                <X size={18} />
              </button>
            </div>
          </Link>
        ))}
        {sessions.length === 0 && (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--glass-border)', width: '100%' }}>
             <p style={{ marginBottom: '24px' }}>The obsidian chamber is quiet. No active manifestations currently reside in this Tavern.</p>
             <Link href="/library" className="btn-premium" style={{ display: 'inline-flex' }}>Summon Companion</Link>
          </div>
        )}
      </div>
    </div>
  );
}
