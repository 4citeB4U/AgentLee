
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, Mic, Settings, User, Loader2, Volume2, Power, CameraOff, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { processVoiceCommand } from '@/ai/flows/interpret-voice-command';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '../ui/separator';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

type Message = {
  role: 'user' | 'agent';
  text: string;
  speaker?: string;
};

type AgentStatus = 'idle' | 'listening' | 'thinking' | 'speaking';
type VoiceOption = 'sharon' | 'carl';
type Speaker = { id: string; name: string };

const speakers: Speaker[] = [
    { id: 'user_tasha', name: 'Tasha' },
    { id: 'user_jordan', name: 'Jordan' },
    { id: 'user_casey', name: 'Casey' },
];

const SpeechRecognition =
  typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

export default function AssistantUI() {
  const [isMounted, setIsMounted] = useState(false);
  const [conversation, setConversation] = useState<Message[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle');
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [voice, setVoice] = useState<VoiceOption>('sharon');
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<Speaker>(speakers[0]);

  const recognition = useRef<SpeechRecognition | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentAudio = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  const speak = useCallback((audioDataUrl: string | null) => {
    if (currentAudio.current && !currentAudio.current.paused) {
        currentAudio.current.pause();
    }

    if (!audioDataUrl) {
      setAgentStatus('idle');
      return;
    }
    
    const audio = new Audio(audioDataUrl);
    currentAudio.current = audio;

    audio.onplay = () => {
        setAgentStatus('speaking');
    };

    audio.onended = () => {
        setAgentStatus('idle');
        currentAudio.current = null;
    };
    
    audio.onerror = (e) => {
        console.error("Audio playback error:", e);
        toast({ title: "Speech Error", description: "Could not play audio response.", variant: "destructive" });
        setAgentStatus('idle');
        currentAudio.current = null;
    };

    audio.play().catch(e => {
        console.error("Audio play failed", e);
        toast({ title: "Playback Error", description: "Could not play audio. Please ensure browser audio is allowed.", variant: "destructive" });
        setAgentStatus('idle');
    });

  }, [toast]);
  

  useEffect(() => {
    const initialize = () => {
      setConversation([{ role: 'agent', text: "What's good, it's Agent Lee — tuned in, locked on, let's move." }]);

      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'en-US';

        rec.onstart = () => setAgentStatus('listening');
        rec.onend = () => {
          setAgentStatus(prev => (prev === 'listening' ? 'idle' : prev));
        };
        rec.onerror = (event) => {
          toast({ title: "Recognition Error", description: event.error, variant: "destructive" });
          setAgentStatus(prev => (prev === 'listening' ? 'idle' : prev));
        };
        recognition.current = rec;
      } else {
        toast({ title: "Browser Not Supported", description: "Speech recognition is not available in your browser.", variant: "destructive" });
      }
      
      setIsMounted(true);
    };

    initialize();

    return () => {
      if (recognition.current) {
        recognition.current.stop();
      }
      if (currentAudio.current) {
        currentAudio.current.pause();
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 
  
    useEffect(() => {
        if (!isMounted) return;

        const getCameraPermission = async () => {
            if (hasCameraPermission === true) return;
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                setHasCameraPermission(true);
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch (error) {
                console.error('Error accessing camera:', error);
                setHasCameraPermission(false);
                toast({
                    variant: 'destructive',
                    title: 'Camera Access Denied',
                    description: 'Please enable camera permissions to use the video feature.',
                });
            }
        };

        getCameraPermission();
    }, [isMounted, hasCameraPermission, toast]);

  useEffect(() => {
    if (recognition.current) {
        recognition.current.onresult = async (event) => {
          const transcript = event.results[0][0].transcript;
          
          setConversation(prev => [...prev, { role: 'user', text: transcript, speaker: isGroupMode ? currentSpeaker.name : 'User' }]);
          setAgentStatus('thinking');

          let photoDataUri: string | undefined = undefined;
          const canvas = document.createElement('canvas');
          const video = videoRef.current;
          if(video && hasCameraPermission) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              photoDataUri = canvas.toDataURL('image/jpeg');
            }
          }

          try {
            const response = await processVoiceCommand({ 
                command: transcript, 
                voice, 
                photoDataUri,
                isGroupConversation: isGroupMode,
                groupId: isGroupMode ? 'weekly-sync' : undefined,
                userId: isGroupMode ? currentSpeaker.id : 'solo_user',
                speakerName: isGroupMode ? currentSpeaker.name : 'User'
            });
            
            setConversation(prev => [...prev, { role: 'agent', text: response.text }]);
            speak(response.audio);
          } catch (error) {
            console.error(error);
            const errorMsg = "Yo, my circuits got crossed for a sec. Run that back?";
            toast({ title: "AI Error", description: "Could not get response from the agent.", variant: "destructive" });
            setConversation(prev => [...prev, { role: 'agent', text: errorMsg }]);
            setAgentStatus('idle');
          }
        };
    }
  }, [voice, speak, toast, hasCameraPermission, isGroupMode, currentSpeaker]);


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
    if (agentStatus === 'speaking') {
      if (currentAudio.current) {
        currentAudio.current.pause();
        currentAudio.current = null;
      }
      setAgentStatus('idle');
      return;
    }

    if (agentStatus === 'listening') {
      recognition.current?.stop();
    } else if (agentStatus === 'idle') {
      recognition.current?.start();
    }
  };

  const getStatusInfo = () => {
    switch(agentStatus) {
      case 'listening': return { text: 'Aight, I hear you...', icon: <Volume2 className="h-4 w-4 animate-pulse text-destructive" /> };
      case 'thinking': return { text: 'Lemme cook...', icon: <Loader2 className="h-4 w-4 animate-spin" /> };
      case 'speaking': return { text: 'Spittin\'...', icon: <Volume2 className="h-4 w-4 text-accent" /> };
      default: return { text: 'Ready', icon: <Power className="h-4 w-4" /> };
    }
  };
  const { text: statusText, icon: statusIcon } = getStatusInfo();

  if (!isMounted) {
    return <div className="flex min-h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  
  return (
    <Card className="w-full max-w-4xl shadow-2xl bg-card/80 backdrop-blur-sm">
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
                 <div className="flex items-center justify-between">
                  <Label htmlFor="group-mode" className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Group Mode
                  </Label>
                  <Switch
                    id="group-mode"
                    checked={isGroupMode}
                    onCheckedChange={setIsGroupMode}
                  />
                </div>
                {isGroupMode && (
                    <div className='grid gap-2'>
                        <Label>Current Speaker</Label>
                        <Select value={currentSpeaker.id} onValueChange={(id) => setCurrentSpeaker(speakers.find(s => s.id === id) || speakers[0])}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select speaker" />
                            </SelectTrigger>
                            <SelectContent>
                                {speakers.map(speaker => (
                                    <SelectItem key={speaker.id} value={speaker.id}>{speaker.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
                <Separator />
                <RadioGroup value={voice} onValueChange={(value) => setVoice(value as VoiceOption)}>
                  <Label>Voice</Label>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sharon" id="sharon" />
                    <Label htmlFor="sharon">Sharon (Female)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="carl" id="carl" />
                    <Label htmlFor="carl">Carl (Male)</Label>
                  </div>
                </RadioGroup>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col lg:flex-row gap-4">
        <div className="lg:w-1/2 flex flex-col items-center justify-center bg-muted/50 rounded-lg p-4">
            <div className="relative w-full aspect-video rounded-md overflow-hidden border">
              <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
              {hasCameraPermission === false && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white p-4">
                  <CameraOff className="w-12 h-12 mb-4" />
                  <h3 className="font-bold text-lg">Camera Access Denied</h3>
                  <p className="text-sm text-center">Please enable camera permissions in your browser settings.</p>
                </div>
              )}
               {hasCameraPermission === null && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                  <Loader2 className="w-8 h-8 animate-spin text-white" />
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Agent Lee's Vision Feed</p>
        </div>
        <div className="lg:w-1/2 flex flex-col gap-4">
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
                    {msg.role === 'user' && msg.speaker && <p className="text-xs font-bold text-primary-foreground/80 pb-1">{msg.speaker}</p>}
                    <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
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
                  agentStatus === 'speaking' && 'bg-accent hover:bg-accent/90',
                )}
                onClick={handleListenClick}
                disabled={agentStatus === 'thinking' || !recognition.current || hasCameraPermission !== true}
              >
                <Mic className="h-8 w-8" />
              </Button>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {statusIcon}
                <span>{statusText}</span>
              </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
