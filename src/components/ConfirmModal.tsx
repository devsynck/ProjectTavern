"use client";

import React from "react";
import styles from "./ConfirmModal.module.css";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel"
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} glass animate-entrance`} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <div className={styles.titleWrapper}>
            <AlertTriangle className={styles.warningIcon} size={20} />
            <h2 className="glow-gold">{title}</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        
        <div className={styles.content}>
          <p>{message}</p>
        </div>
        
        <footer className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>
            {cancelText}
          </button>
          <button className={styles.confirmBtn} onClick={() => { onConfirm(); onClose(); }}>
            {confirmText}
          </button>
        </footer>
      </div>
    </div>
  );
}
