package industries.leeway.pocket

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.provider.CalendarContract
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.view.Gravity
import android.view.View
import android.widget.*
import java.util.Locale

class MainActivity : Activity(), TextToSpeech.OnInitListener {
    private lateinit var status: TextView
    private lateinit var transcript: TextView
    private lateinit var tts: TextToSpeech
    private var recognizer: SpeechRecognizer? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        tts = TextToSpeech(this, this)
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), 7)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER; setPadding(48,80,48,48)
        }
        val title = TextView(this).apply { text = "LEE"; textSize = 42f; gravity = Gravity.CENTER }
        status = TextView(this).apply { text = "LeeWay Pocket • Offline Ready"; textSize = 18f; gravity = Gravity.CENTER }
        transcript = TextView(this).apply { text = "Tap the microphone and talk to Lee."; textSize = 17f; setPadding(0,60,0,60) }
        val mic = Button(this).apply { text = "🎙  TALK TO LEE"; textSize = 18f; setOnClickListener { listen() } }
        val input = EditText(this).apply { hint = "Or type to Lee…"; textSize = 17f }
        val send = Button(this).apply { text = "SEND"; setOnClickListener { handle(input.text.toString()); input.text.clear() } }
        root.addView(title); root.addView(status); root.addView(transcript); root.addView(mic); root.addView(input); root.addView(send)
        setContentView(root)
    }

    override fun onInit(code: Int) { if (code == TextToSpeech.SUCCESS) tts.language = Locale.US }

    private fun listen() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) { say("Speech recognition isn't available on this phone yet."); return }
        recognizer?.destroy(); recognizer = SpeechRecognizer.createSpeechRecognizer(this)
        recognizer?.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(p: Bundle?) { status.text = "Listening…" }
            override fun onResults(b: Bundle?) { val s=b?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty(); transcript.text="You: $s"; handle(s) }
            override fun onError(e:Int) { status.text="Offline Ready" }
            override fun onBeginningOfSpeech(){}; override fun onRmsChanged(v:Float){}; override fun onBufferReceived(b:ByteArray?){}; override fun onEndOfSpeech(){}; override fun onPartialResults(b:Bundle?){}; override fun onEvent(t:Int,b:Bundle?){}
        })
        val i=Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US")
        }
        recognizer?.startListening(i)
    }

    private fun handle(raw:String) {
        val q=raw.trim(); if(q.isBlank()) return
        val l=q.lowercase(Locale.US)
        when {
            l.startsWith("call ") -> { val who=q.substringAfter("call ").trim(); say("Opening the dialer for $who. Choose the contact or number to place the call."); startActivity(Intent(Intent.ACTION_DIAL)) }
            l.contains("calendar") || l.startsWith("schedule ") || l.startsWith("appointment ") -> { say("Opening your calendar so we can add it."); startActivity(Intent(Intent.ACTION_INSERT).setData(CalendarContract.Events.CONTENT_URI).putExtra(CalendarContract.Events.TITLE,q)) }
            l.contains("research") || l.startsWith("search ") || l.startsWith("look up ") -> { say("Research needs an internet connection. I'll open the search when you're online."); val term=q.substringAfter("search ",q).substringAfter("look up ",q); startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/search?q="+Uri.encode(term)))) }
            l.contains("what can you do") -> say("I'm Lee, Pocket edition. I can talk with you offline, help route calls and calendar actions, and use online research when a connection is available.")
            l.contains("who are you") -> say("I'm Agent Lee, Pocket edition. Same LeeWay identity, stripped down for your phone.")
            else -> say("I heard you. My local BitNet reasoning engine is not enabled in this alpha until its ARM output passes LeeWay verification. Voice and phone tools are ready.")
        }
    }

    private fun say(s:String) { status.text="Lee is speaking…"; transcript.text = transcript.text.toString()+"\n\nLee: $s"; tts.speak(s,TextToSpeech.QUEUE_FLUSH,null,"lee") }
    override fun onDestroy(){ recognizer?.destroy(); tts.shutdown(); super.onDestroy() }
}
