"use client";

import React, { useState, useEffect } from "react";
import styles from "./ConfirmModal.module.css"; // Reuse modal spacing logic
import { User, Clipboard, Sparkles, X } from "lucide-react";

interface EditCharModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData: any;
}

export default function EditCharModal({ isOpen, onClose, onSave, initialData }: EditCharModalProps) {
  const [formData, setFormData] = useState<any>(initialData || {});

  useEffect(() => {
    if (initialData) setFormData(initialData);
  }, [initialData]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose} style={{ zIndex: 10001 }}>
      <div className={`${styles.modal} glass animate-entrance`} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <header className={styles.header}>
          <div className={styles.titleWrapper}>
            <Sparkles className="glow-gold" size={20} />
            <h2 className="glow-gold">Refine Soul Fragment</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        
        <div className={styles.content} style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', textTransform: 'uppercase' }}>Companion Name</label>
            <input 
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', color: '#fff', outline: 'none' }}
              value={formData.name || ""} 
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', textTransform: 'uppercase' }}>Discourse Description</label>
            <textarea 
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', color: '#fff', outline: 'none', minHeight: '120px', resize: 'vertical' }}
              value={formData.desc || formData.description || ""} 
              onChange={(e) => setFormData({ ...formData, desc: e.target.value, description: e.target.value })}
              placeholder="Manifest a clearer image of this soul..."
            />
          </div>
        </div>
        
        <footer className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Discard Changes</button>
          <button className={styles.confirmBtn} onClick={handleSave} style={{ background: 'var(--accent-gold)', color: '#000' }}>Save Soul</button>
        </footer>
      </div>
    </div>
  );
}
