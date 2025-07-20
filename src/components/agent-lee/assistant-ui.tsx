
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, Mic, Settings, User, Loader2, Volume2, Power, CameraOff, Eye } from 'lucide-react';
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

type Message = {
  role: 'user' | 'agent';
  text: string;
};

type AgentStatus = 'idle' | 'listening' | 'thinking' | 'speaking';
type VoiceOption = 'sharon' | 'carl';

const SpeechRecognition =
  typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

export default function AssistantUI() {
  const [isMounted, setIsMounted] = useState(false);
  const [conversation, setConversation] = useState<Message[]>([]);
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle');
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [voice, setVoice] = useState<VoiceOption>('sharon');
  const [isAnalyzingView, setIsAnalyzingView] = useState(false);

  const recognition = useRef<SpeechRecognition | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { toast } = useToast();

  const speak = useCallback((audioDataUrl: string | null) => {
    if (!audioDataUrl) {
      setAgentStatus('idle');
      return;
    };
    setAudioUrl(audioDataUrl);
  }, []);
  
  useEffect(() => {
    if (audioUrl && audioRef.current) {
      const audioElement = audioRef.current;
      
      const playAudio = () => {
        setAgentStatus('speaking');
        audioElement.play().catch(e => {
            console.error("Audio play failed", e);
            toast({ title: "Playback Error", description: "Could not play audio. Please ensure browser audio is allowed.", variant: "destructive" });
            setAgentStatus('idle');
        });
      };

      const handleAudioEnd = () => {
        setAgentStatus('idle');
        setAudioUrl(null);
      };

      const handleAudioError = (e: Event) => {
        console.error('Audio playback error', e);
        toast({ title: "Speech Error", description: "Could not play audio response.", variant: "destructive" });
        setAgentStatus('idle');
        setAudioUrl(null);
      }
      
      audioElement.src = audioUrl;
      
      audioElement.addEventListener('canplaythrough', playAudio, { once: true });
      audioElement.addEventListener('ended', handleAudioEnd, { once: true });
      audioElement.addEventListener('error', handleAudioError, { once: true });

      return () => {
        audioElement.removeEventListener('canplaythrough', playAudio);
        audioElement.removeEventListener('ended', handleAudioEnd);
        audioElement.removeEventListener('error', handleAudioError);
        if (!audioElement.paused) {
            audioElement.pause();
            audioElement.currentTime = 0;
        }
        audioElement.src = "";
      };
    }
  }, [audioUrl, toast]);


  useEffect(() => {
    // This effect runs only once on mount to initialize everything.
    const initialize = () => {
      // 1. Set initial agent message
      setConversation([{ role: 'agent', text: "Hello! I'm Agent Lee. How can I assist you today?" }]);

      // 2. Setup Speech Recognition
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'en-US';

        rec.onstart = () => setAgentStatus('listening');
        rec.onend = () => {
          // Check the status before setting to idle, so 'thinking' or 'speaking' is not interrupted
          setAgentStatus(prev => (prev === 'listening' ? 'idle' : prev));
        };
        rec.onerror = (event) => {
          toast({ title: "Recognition Error", description: event.error, variant: "destructive" });
          setAgentStatus(prev => (prev === 'listening' ? 'idle' : prev));
          setIsAnalyzingView(false); // Reset analysis mode on error
        };
        recognition.current = rec;
      } else {
        toast({ title: "Browser Not Supported", description: "Speech recognition is not available in your browser.", variant: "destructive" });
      }
      
      setIsMounted(true);
    };

    initialize();

    // Cleanup function
    return () => {
      if (recognition.current) {
        recognition.current.onresult = null;
        recognition.current.onend = null;
        recognition.current.onerror = null;
        recognition.current.onstart = null;
        recognition.current.stop();
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs only once.
  
    // Effect to get camera permissions, runs after mount
    useEffect(() => {
        if (!isMounted) return;

        const getCameraPermission = async () => {
            if (hasCameraPermission === true) return; // Already have permission
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

  // A separate effect to update the voice for the recognition result handler
  useEffect(() => {
    if (recognition.current) {
        recognition.current.onresult = async (event) => {
          const transcript = event.results[0][0].transcript;
          setConversation(prev => [...prev, { role: 'user', text: transcript }]);
          setAgentStatus('thinking');

          let photoDataUri: string | undefined = undefined;
          if (isAnalyzingView) {
            const canvas = document.createElement('canvas');
            const video = videoRef.current;
            if(video) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                photoDataUri = canvas.toDataURL('image/jpeg');
              }
            }
            setIsAnalyzingView(false); // Reset after capture
          }

          try {
            const response = await processVoiceCommand({ command: transcript, voice, photoDataUri });
            setConversation(prev => [...prev, { role: 'agent', text: response.text }]);
            speak(response.audio);
          } catch (error) {
            console.error(error);
            const errorMsg = 'Sorry, I had trouble processing that.';
            toast({ title: "AI Error", description: "Could not get response from the agent.", variant: "destructive" });
            setConversation(prev => [...prev, { role: 'agent', text: errorMsg }]);
            setAgentStatus('idle');
          }
        };
    }
  }, [voice, speak, toast, isAnalyzingView]);


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

  const handleListenClick = (isAnalysis = false) => {
    if (agentStatus === 'speaking') {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setAgentStatus('idle');
      return;
    }

    if (agentStatus === 'listening') {
      recognition.current?.stop();
      setIsAnalyzingView(false);
    } else if (agentStatus === 'idle') {
      setIsAnalyzingView(isAnalysis);
      recognition.current?.start();
    }
  };

  const getStatusInfo = () => {
    switch(agentStatus) {
      case 'listening': return { text: isAnalyzingView ? 'Analyzing... What do you see?' : 'Listening...', icon: <Volume2 className="h-4 w-4 animate-pulse text-destructive" /> };
      case 'thinking': return { text: 'Thinking...', icon: <Loader2 className="h-4 w-4 animate-spin" /> };
      case 'speaking': return { text: 'Speaking...', icon: <Volume2 className="h-4 w-4 text-accent" /> };
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
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => handleListenClick(true)}
              disabled={agentStatus !== 'idle' || hasCameraPermission !== true}
            >
              <Eye className="mr-2 h-4 w-4" />
              Analyze View
            </Button>
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
                onClick={() => handleListenClick(false)}
                disabled={agentStatus === 'thinking' || !recognition.current}
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
      <audio ref={audioRef} className="hidden" />
    </Card>
  );
}
