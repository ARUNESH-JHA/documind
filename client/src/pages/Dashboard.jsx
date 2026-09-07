import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import {
  FileText, Upload, MessageSquare, LogOut, Trash2,
  Plus, Clock, CheckCircle, AlertCircle, Loader, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../App';
import { documentsAPI, chatAPI } from '../services/api';
import styles from './Dashboard.module.css';

const STATUS_ICONS = {
  UPLOADED: <Clock size={14} color="#fab387" />,
  PARSING: <Loader size={14} color="#89b4fa" className="spin" />,
  CHUNKING: <Loader size={14} color="#89b4fa" className="spin" />,
  EMBEDDING: <Loader size={14} color="#89b4fa" className="spin" />,
  READY: <CheckCircle size={14} color="#a6e3a1" />,
  FAILED: <AlertCircle size={14} color="#f38ba8" />,
};

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  // Fetch documents
  const { data: docsData, isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => documentsAPI.getAll().then((r) => r.data.documents),
    refetchInterval: 5000, // poll every 5s for status updates
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: (file) => {
      const fd = new FormData();
      fd.append('file', file);
      return documentsAPI.upload(fd);
    },
    onSuccess: () => {
      toast.success('File uploaded! Processing started...');
      queryClient.invalidateQueries(['documents']);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Upload failed'),
    onSettled: () => setUploading(false),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => documentsAPI.remove(id),
    onSuccess: () => {
      toast.success('Document deleted');
      queryClient.invalidateQueries(['documents']);
    },
  });

  // Start chat session
  const startChat = async (docId) => {
    try {
      const { data } = await chatAPI.createSession(docId);
      navigate(`/workspace/${data.session._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start chat');
    }
  };

  // Dropzone
  const onDrop = useCallback((accepted) => {
    if (!accepted[0]) return;
    setUploading(true);
    uploadMutation.mutate(accepted[0]);
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt'] },
    maxSize: 20 * 1024 * 1024,
    maxFiles: 1,
  });

  return (
    <div className={styles.page}>
      {/* ─── Sidebar ──────────────────────────────── */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <FileText size={24} color="#6366f1" />
          <span>DocuMind</span>
        </div>

        <div className={styles.userCard}>
          <div className={styles.avatar}>{user?.name?.[0]?.toUpperCase()}</div>
          <div>
            <p className={styles.userName}>{user?.name}</p>
            <p className={styles.userEmail}>{user?.email}</p>
          </div>
        </div>

        <button className={styles.logoutBtn} onClick={logout}>
          <LogOut size={16} /> Logout
        </button>
      </aside>

      {/* ─── Main Content ──────────────────────────── */}
      <main className={styles.main}>
        <div className={styles.header}>
          <h2>Your Documents</h2>
          <span className={styles.count}>{docsData?.length || 0} files</span>
        </div>

        {/* Upload Zone */}
        <div
          {...getRootProps()}
          className={`${styles.dropzone} ${isDragActive ? styles.active : ''} ${uploading ? styles.uploading : ''}`}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <><Loader size={32} className="spin" /> <p>Uploading...</p></>
          ) : isDragActive ? (
            <><Upload size={32} color="#6366f1" /> <p>Drop it here!</p></>
          ) : (
            <>
              <Upload size={32} color="#6c7086" />
              <p>Drag & drop a PDF or TXT file here</p>
              <span>or click to browse (max 20MB)</span>
            </>
          )}
        </div>

        {/* Documents Grid */}
        {isLoading ? (
          <div className={styles.center}><Loader size={32} className="spin" /></div>
        ) : docsData?.length === 0 ? (
          <div className={styles.empty}>
            <FileText size={48} color="#45475a" />
            <p>No documents yet. Upload one above!</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {docsData?.map((doc) => (
              <div key={doc._id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <FileText size={20} color="#6366f1" />
                  <div className={styles.status}>
                    {STATUS_ICONS[doc.status]}
                    <span>{doc.status}</span>
                  </div>
                </div>

                <p className={styles.docName} title={doc.originalName}>
                  {doc.originalName}
                </p>

                <div className={styles.meta}>
                  <span>{formatBytes(doc.fileSize)}</span>
                  {doc.chunkCount > 0 && <span>{doc.chunkCount} chunks</span>}
                </div>

                <div className={styles.actions}>
                  <button
                    className={styles.chatBtn}
                    onClick={() => startChat(doc._id)}
                    disabled={doc.status !== 'READY'}
                    title={doc.status !== 'READY' ? `Document is ${doc.status}` : 'Start chatting'}
                  >
                    <MessageSquare size={14} /> Chat
                  </button>
                  <button
                    className={styles.deleteBtn}
                    onClick={() => deleteMutation.mutate(doc._id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
