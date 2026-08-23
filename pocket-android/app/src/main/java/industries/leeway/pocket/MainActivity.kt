package industries.leeway.pocket

import android.Manifest
import android.app.*
import android.content.*
import android.content.pm.PackageManager
import android.graphics.*
import android.media.MediaRecorder
import android.net.Uri
import android.os.*
import android.provider.CalendarContract
import android.speech.*
import android.speech.tts.*
import android.view.*
import android.widget.*
import java.io.File
import java.text.SimpleDateFormat
import java.util.*
import kotlin.math.*

private enum class LeeState { IDLE, LISTENING, THINKING, RESEARCHING, SPEAKING, VISION }

class MainActivity : Activity(), TextToSpeech.OnInitListener {
    private lateinit var orb: LeeOrbView
    private lateinit var tts: TextToSpeech
    private lateinit var memory: PocketMemory
    private var recognizer: SpeechRecognizer? = null
    private var recorder: MediaRecorder? = null
    private var listening = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.BLACK
        window.navigationBarColor = Color.BLACK
        memory = PocketMemory(this)
        tts = TextToSpeech(this, this)
        requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO, Manifest.permission.CAMERA), 7)

        val frame = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
        orb = LeeOrbView(this).apply {
            setOnClickListener { if (listening) stopListening() else listen() }
        }
        frame.addView(orb, FrameLayout.LayoutParams(-1, -1))
        val menu = TextView(this).apply {
            text = "☰"; textSize = 32f; setTextColor(Color.WHITE); gravity = Gravity.CENTER
            setPadding(24, 12, 24, 12); setOnClickListener { showMenu() }
        }
        frame.addView(menu, FrameLayout.LayoutParams(88, 88, Gravity.TOP or Gravity.START).apply { topMargin = 30; leftMargin = 10 })
        setContentView(frame)
    }

    override fun onInit(code: Int) {
        if (code == TextToSpeech.SUCCESS) {
            tts.language = Locale.US
            tts.setSpeechRate(.94f)
            tts.setPitch(.91f)
            tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(id: String?) { runOnUiThread { orb.state = LeeState.SPEAKING; listenForBargeIn() } }
                override fun onDone(id: String?) { runOnUiThread { orb.state = LeeState.IDLE; listen() } }
                override fun onError(id: String?) { runOnUiThread { orb.state = LeeState.IDLE } }
            })
        }
    }

    private fun listenForBargeIn() { listen(true) }
    private fun listen(barge: Boolean = false) {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) return
        if (!SpeechRecognizer.isRecognitionAvailable(this)) return
        recognizer?.destroy()
        recognizer = SpeechRecognizer.createSpeechRecognizer(this)
        recognizer?.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(p: Bundle?) { listening = true; if (!barge) orb.state = LeeState.LISTENING }
            override fun onBeginningOfSpeech() { if (barge && tts.isSpeaking) { tts.stop(); orb.state = LeeState.LISTENING } }
            override fun onRmsChanged(v: Float) { orb.audioLevel = ((v + 2f) / 12f).coerceIn(0f, 1f) }
            override fun onResults(b: Bundle?) {
                listening = false
                val s = b?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()
                if (s.isNotBlank()) handle(s) else orb.state = LeeState.IDLE
            }
            override fun onPartialResults(b: Bundle?) {
                val s = b?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()
                if (barge && s.length > 2 && tts.isSpeaking) tts.stop()
            }
            override fun onError(e: Int) { listening = false; if (!tts.isSpeaking) orb.state = LeeState.IDLE }
            override fun onBufferReceived(b: ByteArray?) {}; override fun onEndOfSpeech() {}
            override fun onEvent(t: Int, b: Bundle?) {}
        })
        recognizer?.startListening(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US")
        })
    }

    private fun stopListening() { recognizer?.stopListening(); listening = false; orb.state = LeeState.IDLE }

    private fun handle(raw: String) {
        val q = raw.trim(); if (q.isBlank()) return
        memory.saveConversation("user", q)
        orb.state = LeeState.THINKING
        val l = q.lowercase(Locale.US)
        when {
            l == "stop" || l.contains("lee stop") -> { tts.stop(); stopListening() }
            l.startsWith("remember ") -> { memory.remember(q.substringAfter("remember ")); say("Locked in. I got that in your long-term memory.") }
            l.contains("what do you remember") -> say(memory.recentMemories().ifBlank { "I don't have a saved personal memory yet." })
            l.startsWith("note ") || l.startsWith("lee note ") -> { memory.note(q.substringAfter("note ").substringAfter("lee note ")); say("Bet. I put that in my notebook.") }
            l.startsWith("call ") -> { say("I got you. Opening the phone now."); startActivity(Intent(Intent.ACTION_DIAL)) }
            l.contains("schedule") || l.contains("appointment") || l.contains("calendar") -> {
                say("Say less. I'm opening the calendar with that request ready.")
                startActivity(Intent(Intent.ACTION_INSERT).setData(CalendarContract.Events.CONTENT_URI).putExtra(CalendarContract.Events.TITLE, q))
            }
            l.startsWith("search ") || l.startsWith("research ") || l.startsWith("look up ") -> {
                orb.state = LeeState.RESEARCHING
                val term = q.substringAfter("search ", q).substringAfter("research ", q).substringAfter("look up ", q)
                memory.note("Research requested: $term")
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/search?q=" + Uri.encode(term))))
                say("I'm on it. Pulling that research up now.")
            }
            l.contains("look at this") || l.contains("camera") || l.contains("can you see") -> {
                orb.state = LeeState.VISION
                startActivity(Intent("android.media.action.IMAGE_CAPTURE"))
            }
            l.contains("who are you") -> say("I'm Lee. Pocket edition. LeeWay in my bones, OG in my cadence. I'm here to think with you, remember what matters, and handle what I can from this phone.")
            else -> say("Yeah, I hear you. The full reasoning model hookup is the next live gate, but your voice loop, memory, tools, and Pocket Lee shell are running.")
        }
    }

    private fun say(text: String) {
        memory.saveConversation("lee", text)
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "lee-${System.currentTimeMillis()}")
    }

    private fun showMenu() {
        val items = arrayOf("Past conversations", "Saved personal memory", "Lee's notebook", "Create voice clone sample", "Talk to Lee", "Close")
        AlertDialog.Builder(this).setTitle("LeeWay Pocket").setItems(items) { d, which ->
            when (which) {
                0 -> showText("Past conversations", memory.conversations())
                1 -> showText("Personal memory", memory.recentMemories())
                2 -> showText("Lee's notebook", memory.notes())
                3 -> recordVoiceSample()
                4 -> listen()
                else -> d.dismiss()
            }
        }.show()
    }

    private fun showText(title: String, text: String) {
        val v = TextView(this).apply { setPadding(40, 30, 40, 30); setTextColor(Color.WHITE); setBackgroundColor(Color.BLACK); textSize = 16f; this.text = text.ifBlank { "Nothing saved yet." } }
        AlertDialog.Builder(this).setTitle(title).setView(ScrollView(this).apply { addView(v) }).setPositiveButton("Done", null).show()
    }

    private fun recordVoiceSample() {
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) return
        val out = File(filesDir, "lee_voice_reference.m4a")
        recorder?.release()
        recorder = MediaRecorder(this).apply {
            setAudioSource(MediaRecorder.AudioSource.MIC); setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            setAudioEncoder(MediaRecorder.AudioEncoder.AAC); setAudioEncodingBitRate(128000); setAudioSamplingRate(44100)
            setOutputFile(out.absolutePath); prepare(); start()
        }
        orb.state = LeeState.LISTENING
        AlertDialog.Builder(this).setTitle("Create Lee's voice reference")
            .setMessage("Speak naturally for 20–30 seconds. This recording stays in LeeWay Pocket and is the reference for the neural voice-clone engine.")
            .setPositiveButton("Finish") { _, _ -> recorder?.stop(); recorder?.release(); recorder = null; memory.note("Voice reference recorded: ${out.name}"); orb.state = LeeState.IDLE }
            .show()
    }

    override fun onDestroy() { recognizer?.destroy(); recorder?.release(); tts.shutdown(); memory.close(); super.onDestroy() }
}

private class PocketMemory(ctx: Context) : android.database.sqlite.SQLiteOpenHelper(ctx, "leeway_personal_memory.db", null, 1) {
    private val notebook = object : android.database.sqlite.SQLiteOpenHelper(ctx, "leeway_lee_notebook.db", null, 1) {
        override fun onCreate(db: android.database.sqlite.SQLiteDatabase) { db.execSQL("CREATE TABLE notes(id INTEGER PRIMARY KEY AUTOINCREMENT, created INTEGER, body TEXT)") }
        override fun onUpgrade(db: android.database.sqlite.SQLiteDatabase, a: Int, b: Int) {}
    }
    override fun onCreate(db: android.database.sqlite.SQLiteDatabase) {
        db.execSQL("CREATE TABLE conversations(id INTEGER PRIMARY KEY AUTOINCREMENT, created INTEGER, speaker TEXT, body TEXT)")
        db.execSQL("CREATE TABLE memories(id INTEGER PRIMARY KEY AUTOINCREMENT, created INTEGER, body TEXT)")
    }
    override fun onUpgrade(db: android.database.sqlite.SQLiteDatabase, a: Int, b: Int) {}
    fun saveConversation(s: String, body: String) { writableDatabase.execSQL("INSERT INTO conversations(created,speaker,body) VALUES(?,?,?)", arrayOf(System.currentTimeMillis(), s, body)) }
    fun remember(body: String) { writableDatabase.execSQL("INSERT INTO memories(created,body) VALUES(?,?)", arrayOf(System.currentTimeMillis(), body)) }
    fun note(body: String) { notebook.writableDatabase.execSQL("INSERT INTO notes(created,body) VALUES(?,?)", arrayOf(System.currentTimeMillis(), body)) }
    private fun dump(db: android.database.sqlite.SQLiteDatabase, table: String, speaker: Boolean = false): String {
        val c = db.rawQuery("SELECT * FROM $table ORDER BY id DESC LIMIT 100", null); val out = StringBuilder()
        while (c.moveToNext()) { if (speaker) out.append(c.getString(c.getColumnIndexOrThrow("speaker"))).append(": "); out.append(c.getString(c.getColumnIndexOrThrow("body"))).append("\n\n") }; c.close(); return out.toString()
    }
    fun conversations() = dump(readableDatabase, "conversations", true)
    fun recentMemories() = dump(readableDatabase, "memories")
    fun notes() = dump(notebook.readableDatabase, "notes")
    override fun close() { notebook.close(); super.close() }
}

private class LeeOrbView(ctx: Context) : View(ctx) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private var phase = 0f
    var audioLevel = 0f
    var state: LeeState = LeeState.IDLE
        set(v) { field = v; invalidate() }
    private val voxels = ArrayList<FloatArray>()
    init {
        val golden = Math.PI * (3.0 - sqrt(5.0))
        for (i in 0 until 420) {
            val y = 1.0 - (i.toDouble() / 419.0) * 2.0
            val r = sqrt(1.0 - y * y); val theta = golden * i
            voxels.add(floatArrayOf((cos(theta) * r).toFloat(), y.toFloat(), (sin(theta) * r).toFloat()))
        }
    }
    override fun onDraw(c: Canvas) {
        super.onDraw(c); c.drawColor(Color.BLACK); phase += when(state){ LeeState.THINKING, LeeState.RESEARCHING -> .045f; LeeState.SPEAKING -> .032f; else -> .012f }
        val cx=width/2f; val cy=height/2f; val base=min(width,height)*.24f
        val pulse = when(state){ LeeState.LISTENING -> 1f + audioLevel*.12f; LeeState.SPEAKING -> 1f + audioLevel*.09f + abs(sin(phase*4))*.035f; LeeState.THINKING -> .94f + abs(sin(phase*2))*.06f; else -> 1f + sin(phase)*.015f }
        val cosP=cos(phase); val sinP=sin(phase)
        for (p in voxels) {
            var x=p[0]; val y=p[1]; var z=p[2]; val rx=x*cosP-z*sinP; z=x*sinP+z*cosP; x=rx
            if (state==LeeState.THINKING) { val wob=sin(phase*5+y*8)*.06f; x += wob }
            val perspective=1.1f+z*.18f; val px=cx+x*base*pulse*perspective; val py=cy+y*base*pulse*perspective
            val alpha=(90+((z+1f)*75)).toInt().coerceIn(50,235)
            paint.color=Color.argb(alpha, 185, 205, 255); val size=(2.2f+(z+1f)*2.0f)*(if(state==LeeState.SPEAKING)1f+audioLevel else 1f)
            c.drawRect(px-size,py-size,px+size,py+size,paint)
        }
        postInvalidateDelayed(16)
    }
}
