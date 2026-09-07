import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, Send, FileText, ChevronDown, ChevronUp, Copy, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import { chatAPI, api } from '../services/api';
import styles from './WorkspacePage.module.css';

function SourceCard({ sources }) {
  const [open, setOpen] = useState(false);
  if (!sources?.length) return null;

  return (
    <div className={styles.sources}>
      <button className={styles.sourceToggle} onClick={() => setOpen(!open)}>
        <FileText size={12} /> {sources.length} source{sources.length > 1 ? 's' : ''} used
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <div className={styles.sourceList}>
          {sources.map((s, i) => (
            <div key={i} className={styles.sourceItem}>
              <div className={styles.sourceScore}>{Math.round(s.score * 100)}% match</div>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Message({ msg }) {
  const isAI = msg.role === 'assistant';

  const copyText = () => {
    navigator.clipboard.writeText(msg.content);
    toast.success('Copied!');
  };

  return (
    <div className={`${styles.message} ${isAI ? styles.ai : styles.user}`}>
      <div className={styles.bubble}>
        {isAI ? (
          <>
            <ReactMarkdown>{msg.content}</ReactMarkdown>
            <button className={styles.copyBtn} onClick={copyText} title="Copy">
              <Copy size={12} />
            </button>
          </>
        ) : (
          <p>{msg.content}</p>
        )}
      </div>
      {isAI && <SourceCard sources={msg.sources} />}
    </div>
  );
}

export default function WorkspacePage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const bottomRef = useRef(null);

  // Load session
  const { data, isLoading } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => chatAPI.getSession(sessionId).then((r) => r.data.session),
    onSuccess: (session) => setMessages(session.messages),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const sendMessage = async () => {
    if (!input.trim() || streaming) return;

    const question = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setStreaming(true);
    setStreamingText('');

    const token = localStorage.getItem('accessToken');
    let fullAnswer = '';
    let sources = [];

    try {
      const response = await fetch(`/api/chat/sessions/${sessionId}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const parsed = JSON.parse(line.slice(5));
              if (parsed.token) {
                fullAnswer += parsed.token;
                setStreamingText(fullAnswer);
              }
              if (parsed.sources) sources = parsed.sources;
            } catch {}
          }
        }
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: fullAnswer, sources }]);
    } catch (err) {
      toast.error('Failed to get response');
    } finally {
      setStreaming(false);
      setStreamingText('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (isLoading) return <div className={styles.center}><Loader size={32} className="spin" /></div>;

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/')}>
          <ArrowLeft size={18} />
        </button>
        <div className={styles.docInfo}>
          <FileText size={18} color="#6366f1" />
          <span>{data?.document?.originalName}</span>
        </div>
      </header>

      {/* Messages */}
      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.welcome}>
            <FileText size={48} color="#45475a" />
            <h3>Ask anything about this document</h3>
            <p>The AI will search through the document and answer with source citations.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}

        {streaming && streamingText && (
          <div className={`${styles.message} ${styles.ai}`}>
            <div className={styles.bubble}>
              <ReactMarkdown>{streamingText}</ReactMarkdown>
              <span className={styles.cursor}>▌</span>
            </div>
          </div>
        )}

        {streaming && !streamingText && (
          <div className={`${styles.message} ${styles.ai}`}>
            <div className={styles.bubble}>
              <div className={styles.typing}>
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className={styles.inputBar}>
        <textarea
          className={styles.input}
          placeholder="Ask a question about the document... (Enter to send)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={streaming}
        />
        <button
          className={styles.sendBtn}
          onClick={sendMessage}
          disabled={!input.trim() || streaming}
        >
          {streaming ? <Loader size={18} className="spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}
