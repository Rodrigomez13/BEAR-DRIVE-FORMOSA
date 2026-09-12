import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { X, Send, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { sanitizeString } from "@/lib/sanitize";
import Haptics from "@/lib/haptics";

// In-app ride chat — privacy-preserving communication channel that replaces
// direct phone calls. Phone numbers are never exposed; all messages flow
// through the RideMessage entity, validated server-side by sendRideMessage.
export default function RideChat({ rideId, userId, peerName, onClose }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  // Load existing messages
  useEffect(() => {
    const load = async () => {
      try {
        const msgs = await base44.entities.RideMessage.filter({ ride_id: rideId }, "created_date", 100);
        setMessages(msgs);
      } catch (e) { /* ignore */ }
    };
    load();
  }, [rideId]);

  // Realtime subscription for new messages
  useEffect(() => {
    const unsubscribe = base44.entities.RideMessage.subscribe((event) => {
      if (event.data?.ride_id !== rideId) return;
      if (event.type === "create") {
        setMessages((prev) => {
          if (prev.some((m) => m.id === event.data.id)) return prev;
          return [...prev, event.data];
        });
      }
    });
    return () => unsubscribe();
  }, [rideId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    const trimmed = sanitizeString(text.trim(), 500);
    if (!trimmed) return;
    setSending(true);
    try {
      await base44.functions.invoke("sendRideMessage", { ride_id: rideId, text: trimmed });
      setText("");
    } catch (e) {
      // error handled silently — message just doesn't send
    } finally {
      setSending(false);
    }
  };

  const QUICK_CHIPS = [
    "Ya salgo",
    "Estoy en la puerta",
    "Esperame 2 min",
    "No te veo",
    "¿De qué color es el auto?",
    "Estoy con balizas",
  ];

  const handleSendChip = async (chipText) => {
    Haptics.light();
    setSending(true);
    try {
      await base44.functions.invoke("sendRideMessage", { ride_id: rideId, text: chipText });
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center gap-3 p-3 border-b border-border safe-top">
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <MessageCircle className="w-4 h-4 text-accent shrink-0" />
          <div className="min-w-0">
            <p className="font-bold text-sm truncate">{peerName || "Chat del viaje"}</p>
            <p className="text-xs text-muted-foreground">Número protegido · chat seguro</p>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 app-scroll">
        {messages.length === 0 && (
          <div className="text-center mt-8">
            <MessageCircle className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-sm text-muted-foreground">Aún no hay mensajes.</p>
            <p className="text-xs text-muted-foreground mt-1">Elegí un mensaje rápido o escribí abajo.</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.sender_id === userId;
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm break-words ${isMe ? "bg-accent text-accent-foreground rounded-br-md" : "bg-secondary rounded-bl-md"}`}>
                {msg.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Chips Row */}
      <div className="px-3 pt-2 pb-1 border-t border-border/50 bg-secondary/30">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={sending}
              onClick={() => handleSendChip(chip)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-card border border-border/80 text-foreground hover:border-accent hover:bg-accent/10 active:scale-95 transition"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 border-t border-border flex gap-2 safe-bottom">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !sending) handleSend(); }}
          placeholder="Escribí un mensaje..."
          className="flex-1"
          maxLength={500}
        />
        <button
          onClick={handleSend}
          disabled={sending || !text.trim()}
          className="w-11 h-11 rounded-full bear-gold-gradient flex items-center justify-center disabled:opacity-50 shrink-0"
        >
          <Send className="w-5 h-5 text-foreground" />
        </button>
      </div>
    </div>
  );
}