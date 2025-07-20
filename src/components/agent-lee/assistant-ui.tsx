
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, Mic, Settings, User, Loader2, Volume2, Power } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { processVoiceCommand } from '@/lib/actions';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '../ui/separator';

type Message = {
  role: 'user' | 'agent';
  text: string;
};

type AgentStatus = 'idle' | 'listening' | 'thinking' | 'speaking';

// SpeechRecognition might be prefixed in some browsers
const SpeechRecognition =
  typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

export default function AssistantUI() {
  const [isMounted, setIsMounted] = useState(false);
  const [conversation, setConversation] = useState<Message[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string | undefined>(undefined);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const recognition = useRef<SpeechRecognition | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  // Use refs to hold state for stable useCallback
  const availableVoicesRef = useRef(availableVoices);
  availableVoicesRef.current = availableVoices;
  const selectedVoiceRef = useRef(selectedVoice);
  selectedVoiceRef.current = selectedVoice;

  const speak = useCallback((text: string) => {
    if (!text || typeof window === 'undefined') return;
    
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = availableVoicesRef.current.find(v => v.voiceURI === selectedVoiceRef.current);
    if (voice) {
      utterance.voice = voice;
    }
    
    utterance.onstart = () => {
      setAgentStatus('speaking');
      setIsSpeaking(true);
    };
    utterance.onend = () => {
      setAgentStatus('idle');
      setIsSpeaking(false);
    };
    utterance.onerror = (event) => {
        console.error('SpeechSynthesis Error', event);
        toast({ title: "Speech Error", description: "Could not play audio response.", variant: "destructive" });
        setAgentStatus('idle');
        setIsSpeaking(false);
    };
    
    window.speechSynthesis.speak(utterance);
  }, [toast]);


  useEffect(() => {
    const initializeAssistant = () => {
      setConversation([{ role: 'agent', text: "Hello! I'm Agent Lee. How can I assist you today?" }]);
      
      if ('speechSynthesis' in window) {
        const setVoices = () => {
          const voices = window.speechSynthesis.getVoices();
          if (voices.length > 0) {
            setAvailableVoices(voices);
            const defaultVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) || voices.find(v => v.lang.startsWith('en'));
            if (defaultVoice) {
              setSelectedVoice(defaultVoice.voiceURI);
            }
          }
        };

        setVoices();
        // onvoiceschanged can fire multiple times, so we check if voices are already loaded.
        if (window.speechSynthesis.onvoiceschanged === null) {
            window.speechSynthesis.onvoiceschanged = setVoices;
        }
      }

      if (SpeechRecognition) {
        recognition.current = new SpeechRecognition();
        recognition.current.continuous = false;
        recognition.current.interimResults = false;
        recognition.current.lang = 'en-US';

        recognition.current.onstart = () => setAgentStatus('listening');
        recognition.current.onend = () => {
          setAgentStatus(prev => prev === 'listening' ? 'idle' : prev);
        };
        recognition.current.onerror = (event) => {
          toast({ title: "Recognition Error", description: event.error, variant: "destructive" });
          setAgentStatus(prev => prev === 'listening' ? 'idle' : prev);
        };
        recognition.current.onresult = async (event) => {
          const transcript = event.results[0][0].transcript;
          setConversation(prev => [...prev, { role: 'user', text: transcript }]);
          setAgentStatus('thinking');

          try {
            const response = await processVoiceCommand(transcript);
            setConversation(prev => [...prev, { role: 'agent', text: response }]);
            speak(response);
          } catch (error) {
            console.error(error);
            const errorMsg = 'Sorry, I had trouble processing that.';
            toast({ title: "AI Error", description: "Could not get response from the agent.", variant: "destructive" });
            setConversation(prev => [...prev, { role: 'agent', text: errorMsg }]);
            speak(errorMsg);
          }
        };
      } else {
        toast({ title: "Browser Not Supported", description: "Speech recognition is not available in your browser.", variant: "destructive" });
      }
    };
    
    setIsMounted(true);
    initializeAssistant();

     return () => {
      if (recognition.current) {
        recognition.current.onresult = null;
        recognition.current.onend = null;
        recognition.current.onerror = null;
        recognition.current.onstart = null;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
        window.speechSynthesis.cancel();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollEl = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (scrollEl) {
        scrollEl.scrollTo({
          top: scrollEl.scrollHeight,
          behavior: 'smooth',
        });
      }
    }
  }, [conversation]);

  const handleListenClick = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setAgentStatus('idle');
      return;
    }

    if (agentStatus === 'listening') {
      recognition.current?.stop();
    } else {
      recognition.current?.start();
    }
  };

  const getStatusInfo = () => {
    switch(agentStatus) {
      case 'listening': return { text: 'Listening...', icon: <Volume2 className="h-4 w-4 animate-pulse" /> };
      case 'thinking': return { text: 'Thinking...', icon: <Loader2 className="h-4 w-4 animate-spin" /> };
      case 'speaking': return { text: 'Speaking...', icon: <Volume2 className="h-4 w-4" /> };
      default: return { text: 'Ready', icon: <Power className="h-4 w-4" /> };
    }
  };
  const { text: statusText, icon: statusIcon } = getStatusInfo();

  if (!isMounted) {
    return null;
  }
  
  return (
    <Card className="w-full max-w-2xl shadow-2xl">
      <CardHeader className="text-center">
        <div className="flex justify-between items-center">
          <div className="w-12"></div>
          <div className="flex flex-col items-center">
            <CardTitle className="font-headline text-3xl">Agent Lee</CardTitle>
            <CardDescription>Your Personal AI Assistant</CardDescription>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="end">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium leading-none">Settings</h4>
                  <p className="text-sm text-muted-foreground">
                    Adjust your assistant's settings.
                  </p>
                </div>
                <Separator />
                <div className="grid gap-2">
                  <Label htmlFor="voice-select">Voice</Label>
                   <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                      <SelectTrigger id="voice-select">
                        <SelectValue placeholder="Select a voice" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableVoices.map(voice => (
                          <SelectItem key={voice.voiceURI} value={voice.voiceURI}>
                            {voice.name} ({voice.lang})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ScrollArea className="h-96 w-full rounded-md border p-4" ref={scrollAreaRef}>
          <div className="flex flex-col gap-4">
            {conversation.map((msg, index) => (
              <div key={index} className={cn('flex items-start gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'agent' && (
                  <div className="p-2 rounded-full bg-primary/10">
                    <Bot className="w-6 h-6 text-primary" />
                  </div>
                )}
                <div className={cn('p-3 rounded-xl max-w-[80%] shadow-md', msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card')}>
                  <p className="text-sm">{msg.text}</p>
                </div>
                {msg.role === 'user' && (
                  <div className="p-2 rounded-full bg-secondary">
                    <User className="w-6 h-6 text-secondary-foreground" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="flex flex-col items-center gap-4">
            <Button
              size="icon"
              className={cn(
                'h-20 w-20 rounded-full shadow-lg transition-all duration-300',
                agentStatus === 'listening' && 'animate-mic-pulse bg-destructive hover:bg-destructive/90',
                isSpeaking && 'bg-accent hover:bg-accent/90',
              )}
              onClick={handleListenClick}
              disabled={agentStatus === 'thinking'}
            >
              <Mic className="h-8 w-8" />
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {statusIcon}
              <span>{statusText}</span>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
