import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/services/voice_service.dart';
import '../../providers/auth_provider.dart';
import '../../providers/student_provider.dart';
import '../../providers/intelligence_provider.dart';
import '../../models/intelligence_model.dart';
import '../../widgets/neo_card.dart';
import '../../widgets/source_citation_card.dart';

class IntelligenceScreen extends StatefulWidget {
  const IntelligenceScreen({super.key});

  @override
  State<IntelligenceScreen> createState() => _IntelligenceScreenState();
}

class _IntelligenceScreenState extends State<IntelligenceScreen> {
  final TextEditingController _inputCtrl = TextEditingController();
  final ScrollController _scrollCtrl = ScrollController();

  final List<String> _quickPrompts = const [
    'What projects do I have in my database?',
    'What is my CGPA and academic record?',
    'Turn on my Instagram',
    'Turn on my WhatsApp',
    'How ready am I for a Backend Developer role?',
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final intel = context.read<IntelligenceProvider>();
      final studentProv = context.read<StudentProvider>();
      intel.bindStudentProvider(studentProv);
      intel.onUIActionCallback = (action, data) {
        if (!mounted) return;
        if (action == 'PROJECT_ADDED' ||
            action == 'PROJECT_DELETED' ||
            action == 'INTERNSHIP_ADDED' ||
            action == 'INTERNSHIP_DELETED' ||
            action == 'PROFILE_UPDATED') {
          studentProv.fetchProfile();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Row(
                children: [
                  const Icon(Icons.check_circle_rounded, color: Colors.white, size: 20),
                  const SizedBox(width: 8),
                  Expanded(child: Text(intel.lastActionResult ?? 'Database updated!')),
                ],
              ),
              backgroundColor: const Color(0xFF1E3A8A),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          );
        } else if (action == 'APP_LAUNCHED') {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Row(
                children: [
                  const Icon(Icons.rocket_launch_rounded, color: Colors.white, size: 20),
                  const SizedBox(width: 8),
                  Expanded(child: Text(intel.lastActionResult ?? 'App launched!')),
                ],
              ),
              backgroundColor: const Color(0xFF059669),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          );
        }
      };
    });
  }

  @override
  void dispose() {
    _inputCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _submitQuestion([String? text]) {
    final query = text ?? _inputCtrl.text;
    if (query.trim().isEmpty) return;

    final userName = context.read<AuthProvider>().user?.name ?? 'there';
    final studentProv = context.read<StudentProvider>();
    _inputCtrl.clear();
    FocusScope.of(context).unfocus();
    context.read<IntelligenceProvider>().askQuestion(
      query,
      userName: userName,
      studentProvider: studentProv,
    );
    _scrollToBottom();
  }

  @override
  Widget build(BuildContext context) {
    final intel = context.watch<IntelligenceProvider>();
    final auth = context.watch<AuthProvider>();
    final userName = auth.user?.name ?? 'there';

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppTheme.primaryLight,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppTheme.primary.withValues(alpha: 0.15), width: 1.0),
              ),
              child: const Icon(Icons.psychology_rounded, size: 18, color: AppTheme.primary),
            ),
            const SizedBox(width: 8),
            const Flexible(
              child: Text(
                'Nova Intelligence',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: AppTheme.textPrimary),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        actions: [
          // Hands-Free Mode Toggle Action
          Padding(
            padding: const EdgeInsets.only(right: 6),
            child: GestureDetector(
              onTap: () => intel.toggleHandsFree(userName),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: intel.handsFree ? AppTheme.emeraldBg : AppTheme.cardWhite,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(
                    color: intel.handsFree ? AppTheme.emerald.withValues(alpha: 0.3) : AppTheme.borderLight,
                    width: 1.0,
                  ),
                  boxShadow: AppTheme.cardShadow,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      intel.handsFree ? Icons.mic_rounded : Icons.mic_none_rounded,
                      size: 15,
                      color: intel.handsFree ? AppTheme.emeraldText : AppTheme.textCaption,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      intel.handsFree ? 'VOICE ON' : 'VOICE',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: intel.handsFree ? AppTheme.emeraldText : AppTheme.textCaption,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          PopupMenuButton<String>(
            tooltip: 'Settings & Providers',
            icon: const Icon(Icons.tune_rounded, size: 20, color: AppTheme.textCaption),
            padding: EdgeInsets.zero,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: const BorderSide(color: AppTheme.borderLight, width: 1.0),
            ),
            onSelected: (val) {
              if (val == 'clear') {
                intel.clearConversation();
              } else if (val == 'toggle_voice') {
                intel.toggleHandsFree(userName);
              } else {
                intel.setProvider(val);
              }
            },
            itemBuilder: (ctx) => [
              const PopupMenuItem(
                enabled: false,
                child: Text('AI PROVIDER', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppTheme.textCaption)),
              ),
              PopupMenuItem(
                value: 'gemini',
                child: Row(
                  children: [
                    Icon(
                      intel.selectedProvider == 'gemini' ? Icons.radio_button_checked : Icons.radio_button_off,
                      size: 18,
                      color: AppTheme.textPrimary,
                    ),
                    const SizedBox(width: 8),
                    const Text('Gemini 3.1 Flash Lite'),
                  ],
                ),
              ),
              PopupMenuItem(
                value: 'openrouter',
                child: Row(
                  children: [
                    Icon(
                      intel.selectedProvider == 'openrouter' ? Icons.radio_button_checked : Icons.radio_button_off,
                      size: 18,
                      color: AppTheme.textPrimary,
                    ),
                    const SizedBox(width: 8),
                    const Text('OpenRouter (Cloud)'),
                  ],
                ),
              ),

              PopupMenuItem(
                value: 'ollama',
                child: Row(
                  children: [
                    Icon(
                      intel.selectedProvider == 'ollama' ? Icons.radio_button_checked : Icons.radio_button_off,
                      size: 18,
                      color: AppTheme.textPrimary,
                    ),
                    const SizedBox(width: 8),
                    const Text('Ollama (Local LLM)'),
                  ],
                ),
              ),
              const PopupMenuDivider(),
              PopupMenuItem(
                value: 'toggle_voice',
                child: Row(
                  children: [
                    Icon(
                      intel.handsFree ? Icons.mic_off_rounded : Icons.mic_rounded,
                      color: intel.handsFree ? Colors.red : Colors.green,
                      size: 18,
                    ),
                    const SizedBox(width: 8),
                    Text(intel.handsFree ? 'Turn Off Hands-Free' : 'Turn On Hands-Free Mode'),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'clear',
                child: Row(
                  children: [
                    Icon(Icons.delete_outline, color: Colors.red, size: 18),
                    SizedBox(width: 8),
                    Text('Clear Conversation', style: TextStyle(color: Colors.red)),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          _buildTopBanner(intel, userName),
          if (intel.handsFree || intel.voiceState != VoiceState.idle)
            _buildVoiceLiveBanner(intel, userName),
          Expanded(
            child: intel.messages.isEmpty
                ? _buildEmptyState(intel, userName)
                : ListView.builder(
                    controller: _scrollCtrl,
                    padding: const EdgeInsets.all(16),
                    itemCount: intel.messages.length + (intel.isQuerying ? 1 : 0),
                    itemBuilder: (context, index) {
                      if (index == intel.messages.length && intel.isQuerying) {
                        return _buildThinkingBubble();
                      }
                      return _buildMessageBubble(intel.messages[index], intel);
                    },
                  ),
          ),
          _buildInputBar(intel),
        ],
      ),
    );
  }

  Widget _buildTopBanner(IntelligenceProvider intel, String userName) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: AppTheme.canvas,
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: AppTheme.primaryLight,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: AppTheme.primary.withValues(alpha: 0.15), width: 1.0),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.bolt_rounded, size: 14, color: AppTheme.primary),
                const SizedBox(width: 4),
                Text(
                  intel.useLiveWebSocket
                      ? 'Nova Live & Intent Engine'
                      : 'Cloud • Gemini',
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppTheme.primary),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          const Expanded(
            child: Text(
              'Grounded in your digital twin & MongoDB',
              style: TextStyle(fontSize: 11, color: AppTheme.textCaption),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVoiceLiveBanner(IntelligenceProvider intel, String userName) {
    Color bannerBg = AppTheme.cardWhite;
    Color accentColor = AppTheme.primary;
    Color borderColor = AppTheme.borderLight;
    IconData icon = Icons.mic_rounded;
    String title = 'Hands-Free Mode Active';
    String subtitle = 'Say "Hey MirrorMind" to ask or command hands-free.';

    switch (intel.voiceState) {
      case VoiceState.wakeListening:
        bannerBg = const Color(0xFFEFF6FF);
        accentColor = const Color(0xFF2563EB);
        borderColor = const Color(0xFFBFDBFE);
        icon = Icons.hearing_rounded;
        title = 'Listening for "Hey MirrorMind"…';
        subtitle = 'Speak wake phrase or say "Turn on Instagram" / "What are my projects?"';
        break;
      case VoiceState.wakeDetected:
        bannerBg = const Color(0xFFF5F3FF);
        accentColor = const Color(0xFF7C3AED);
        borderColor = const Color(0xFFDDD6FE);
        icon = Icons.auto_awesome_rounded;
        title = '✨ Wake Word Detected!';
        subtitle = 'Ready for your command…';
        break;
      case VoiceState.greeting:
        bannerBg = const Color(0xFFF5F3FF);
        accentColor = const Color(0xFF7C3AED);
        borderColor = const Color(0xFFDDD6FE);
        icon = Icons.record_voice_over_rounded;
        title = 'MirrorMind Greeting…';
        subtitle = 'Speaking aloud to you.';
        break;
      case VoiceState.listeningForQuery:
        bannerBg = const Color(0xFFFEF3C7);
        accentColor = const Color(0xFFD97706);
        borderColor = const Color(0xFFFDE68A);
        icon = Icons.mic_rounded;
        title = '🎙️ Listening to command…';
        subtitle = intel.liveTranscript.isNotEmpty
            ? '"${intel.liveTranscript}"'
            : 'Speak now — ask database details or to launch apps.';
        break;
      case VoiceState.queryProcessing:
        bannerBg = const Color(0xFFEFF6FF);
        accentColor = const Color(0xFF2563EB);
        borderColor = const Color(0xFFBFDBFE);
        if (intel.activeToolName != null) {
          icon = Icons.bolt_rounded;
          title = '🛠️ Nova Action Engine';
          subtitle = intel.activeToolName!;
        } else {
          icon = Icons.psychology_rounded;
          title = '🧠 Processing Intent…';
          subtitle = 'Synchronizing digital twin database & apps…';
        }
        break;
      case VoiceState.speakingAnswer:
        bannerBg = const Color(0xFFECFDF5);
        accentColor = const Color(0xFF059669);
        borderColor = const Color(0xFFA7F3D0);
        icon = Icons.volume_up_rounded;
        title = '🔊 Speaking Answer Aloud…';
        subtitle = 'Tap the stop icon to cancel speech.';
        break;
      case VoiceState.error:
        bannerBg = const Color(0xFFFEF2F2);
        accentColor = const Color(0xFFDC2626);
        borderColor = const Color(0xFFFECACA);
        icon = Icons.error_outline_rounded;
        title = 'Microphone Permission Needed';
        subtitle = intel.voiceError ?? 'Please allow microphone access to use Voice Mode.';
        break;
      default:
        break;
    }

    final isError = intel.voiceState == VoiceState.error;

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 4, 16, 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: bannerBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: borderColor, width: 1.0),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(
                  color: accentColor.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 18, color: accentColor),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: accentColor),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: AppTheme.textBody),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              if (intel.voiceState == VoiceState.speakingAnswer)
                IconButton(
                  icon: const Icon(Icons.stop_circle_outlined, color: Colors.black87),
                  onPressed: () => intel.stopSpeaking(),
                ),
              IconButton(
                icon: const Icon(Icons.close_rounded, size: 18, color: AppTheme.textCaption),
                onPressed: () => intel.stopHandsFree(),
              ),
            ],
          ),
          if (isError) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.cardWhite,
                    foregroundColor: AppTheme.textPrimary,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    minimumSize: const Size(0, 32),
                  ),
                  onPressed: () => intel.openAppSettings(),
                  child: const Text('Open App Settings', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                ),
                const SizedBox(width: 8),
                OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    minimumSize: const Size(0, 32),
                  ),
                  onPressed: () => intel.toggleHandsFree(userName),
                  child: const Text('Retry', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildEmptyState(IntelligenceProvider intel, String userName) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          NeoCard(
            backgroundColor: AppTheme.cardWhite,
            borderColor: AppTheme.borderLight,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppTheme.primaryLight,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.auto_awesome, size: 20, color: AppTheme.primary),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('MirrorMind Intelligence', style: AppTheme.cardTitle(context)),
                          const Text(
                            'AI Co-Pilot & Intent Engine',
                            style: TextStyle(fontSize: 11, color: AppTheme.textCaption, fontWeight: FontWeight.w500),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  'Inspect your database records, update your profile or portfolio by voice, and launch external apps (Instagram, WhatsApp, YouTube) directly with natural language.',
                  style: AppTheme.body(context),
                ),
                const SizedBox(height: 16),
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: intel.handsFree ? const Color(0xFFEF4444) : AppTheme.primary,
                    foregroundColor: Colors.white,
                    minimumSize: const Size(double.infinity, 44),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: () => intel.toggleHandsFree(userName),
                  icon: Icon(intel.handsFree ? Icons.mic_off : Icons.record_voice_over_rounded, size: 18),
                  label: Text(
                    intel.handsFree ? 'Turn Off Hands-Free Mode' : 'Enable Hands-Free Voice Mode 🎙️',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          const Text('Suggested Prompts & Intent Actions', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppTheme.textPrimary)),
          const SizedBox(height: 12),
          ..._quickPrompts.map((prompt) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: NeoCard(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  onTap: () => _submitQuestion(prompt),
                  child: Row(
                    children: [
                      Icon(
                        prompt.toLowerCase().contains('turn on')
                            ? Icons.launch_rounded
                            : (prompt.toLowerCase().contains('database') || prompt.toLowerCase().contains('cgpa')
                                ? Icons.storage_rounded
                                : Icons.chat_bubble_outline),
                        size: 16,
                        color: AppTheme.primary,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(prompt, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
                      ),
                      const Icon(Icons.arrow_forward_ios, size: 12, color: AppTheme.textCaption),
                    ],
                  ),
                ),
              )),
        ],
      ),
    );
  }

  Widget _buildMessageBubble(IntelligenceMessage msg, IntelligenceProvider intel) {
    if (msg.isUser) {
      return Align(
        alignment: Alignment.centerRight,
        child: Container(
          margin: const EdgeInsets.only(bottom: 16, left: 40),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: AppTheme.primary,
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(18),
              topRight: Radius.circular(18),
              bottomLeft: Radius.circular(18),
              bottomRight: Radius.circular(4),
            ),
            boxShadow: AppTheme.cardShadow,
          ),
          child: Text(
            msg.text,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: Colors.white, height: 1.4),
          ),
        ),
      );
    }

    final isIntent = msg.provider == 'Nova Intent Engine';

    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 16, right: 30),
        child: NeoCard(
          backgroundColor: msg.isError ? AppTheme.roseBg : AppTheme.cardWhite,
          borderColor: msg.isError
              ? AppTheme.rose.withValues(alpha: 0.25)
              : (isIntent ? AppTheme.primary.withValues(alpha: 0.3) : AppTheme.borderLight),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(5),
                    decoration: BoxDecoration(
                      color: isIntent ? AppTheme.emeraldBg : AppTheme.primaryLight,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: (isIntent ? AppTheme.emerald : AppTheme.primary).withValues(alpha: 0.15),
                        width: 1.0,
                      ),
                    ),
                    child: Icon(
                      isIntent ? Icons.bolt_rounded : Icons.psychology_rounded,
                      size: 16,
                      color: isIntent ? AppTheme.emeraldText : AppTheme.primary,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    isIntent ? 'Nova Intent Engine' : 'Nova Twin Copilot',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.textPrimary),
                  ),
                  if (msg.model != null) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppTheme.canvas,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: AppTheme.borderLight, width: 0.8),
                      ),
                      child: Text(
                        msg.model!,
                        style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: AppTheme.textCaption),
                      ),
                    ),
                  ],
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.volume_up_rounded, size: 18, color: AppTheme.textCaption),
                    tooltip: 'Read Aloud',
                    onPressed: () => intel.speakMessage(msg.text),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              SelectableText(
                msg.text,
                style: const TextStyle(fontSize: 14, color: AppTheme.textBody, height: 1.5),
              ),
              if (msg.sources.isNotEmpty) ...[
                const SizedBox(height: 12),
                const Text('SOURCES & CITATIONS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppTheme.textCaption)),
                ...msg.sources.asMap().entries.map(
                      (entry) => SourceCitationCard(
                        index: entry.key + 1,
                        source: entry.value,
                      ),
                    ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildThinkingBubble() {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 16, right: 60),
        child: const NeoCard(
          backgroundColor: AppTheme.cardWhite,
          borderColor: AppTheme.borderLight,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.primary),
              ),
              SizedBox(width: 12),
              Text(
                'Searching FAISS & reasoning with Gemini…',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textCaption),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInputBar(IntelligenceProvider intel) {
    final isListening = intel.voiceState == VoiceState.listeningForQuery;

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 20),
      decoration: const BoxDecoration(
        color: AppTheme.cardWhite,
        border: Border(top: BorderSide(color: AppTheme.borderLight, width: 1.0)),
      ),
      child: Row(
        children: [
          // Push-to-Talk Mic button
          GestureDetector(
            onTap: () => intel.recordQuickVoiceQuery(),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              height: 48,
              width: 48,
              decoration: BoxDecoration(
                color: isListening ? AppTheme.roseBg : AppTheme.canvas,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: isListening ? AppTheme.rose.withValues(alpha: 0.3) : AppTheme.borderLight,
                  width: 1.0,
                ),
              ),
              child: Icon(
                isListening ? Icons.mic_rounded : Icons.mic_none_rounded,
                size: 22,
                color: isListening ? AppTheme.rose : AppTheme.textBody,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              controller: _inputCtrl,
              decoration: InputDecoration(
                hintText: isListening ? 'Listening… speak now' : 'Ask MirrorMind AI anything…',
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
              onSubmitted: (_) => _submitQuestion(),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: intel.isQuerying ? null : () => _submitQuestion(),
            child: Container(
              height: 48,
              width: 48,
              decoration: BoxDecoration(
                color: intel.isQuerying ? const Color(0xFFCBD5E1) : AppTheme.primary,
                borderRadius: BorderRadius.circular(14),
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.primary.withValues(alpha: 0.25),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: const Icon(Icons.send_rounded, size: 20, color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }
}
