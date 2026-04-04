"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Library, Settings, Sparkles, Ghost, Bot } from "lucide-react";
import { tavernDB } from "@/utils/db";
import styles from "./Sidebar.module.css";

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { title: "Chat", icon: MessageSquare, href: "/" },
    { title: "Library", icon: Library, href: "/library" },
    { title: "Create", icon: Sparkles, href: "/create" },
    { title: "Settings", icon: Settings, href: "/settings" },
  ];

  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    const fetchSessions = async () => {
      const allSessions = await tavernDB.getAll<any>("sessions");
      const filtered = allSessions.filter(s => s && s.type === 'session');
      setSessions(filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
    };
    
    fetchSessions();
    window.addEventListener("storage", fetchSessions);
    // Custom event to handle updates within the same window instance
    window.addEventListener("tavern-sessions-updated", fetchSessions);
    
    return () => {
      window.removeEventListener("storage", fetchSessions);
      window.removeEventListener("tavern-sessions-updated", fetchSessions);
    };
  }, []);

  return (
    <aside className={`${styles.sidebar} glass animate-fade-in`}>
      <div className={styles.logo}>
        <Sparkles className={styles.logoIcon} />
        <span>Project Tavern</span>
      </div>
      
      <nav className={styles.nav}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <Link 
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${isActive ? styles.active : ""}`}
            >
              <Icon size={20} className={styles.icon} />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>

      {sessions.length > 0 && (
        <div className={styles.sessions}>
          <div className={styles.sectionTitle}>Recent Manifestations</div>
          <div className={styles.sessionList}>
            {sessions.slice(0, 8).map((session) => {
              const href = `/chat/${session.id}`;
              const isActive = pathname === href;
              return (
                <Link 
                  key={session.id}
                  href={href}
                  className={`${styles.sessionItem} ${isActive ? styles.activeSession : ""}`}
                >
                  {session.image ? (
                    <img src={session.image} alt={session.name} className={styles.miniAvatar} />
                  ) : (
                    <Bot size={16} className={styles.miniIcon} />
                  )}
                  <span>{session.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className={styles.footer}>
        <div className={styles.status}>
          <div className={styles.dot}></div>
          <span>API Active</span>
        </div>
      </div>
    </aside>
  );
}
