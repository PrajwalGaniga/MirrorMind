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
    'What are my strongest skills according to my profile?',
    'How ready am I for a Backend Developer role?',
    'Summarize my uploaded documents and achievements.',
    'What should I add to my resume to target AI/ML roles?',
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final intel = context.read<IntelligenceProvider>();
      final studentProv = context.read<StudentProvider>();
      intel.onUIActionCallback = (action, data) {
        if (!mounted) return;
        if (action == 'PROJECT_ADDED' || action == 'INTERNSHIP_ADDED' || action == 'PROFILE_UPDATED') {
          studentProv.fetchProfile();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(intel.lastActionResult ?? 'Action completed by Nova!'),
              backgroundColor: const Color(0xFF1B5E20),
              behavior: SnackBarBehavior.floating,
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
    _inputCtrl.clear();
    FocusScope.of(context).unfocus();
    context.read<IntelligenceProvider>().askQuestion(query, userName: userName);
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
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: AppTheme.lavender,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppTheme.borderBlack, width: 1.5),
              ),
              child: const Icon(Icons.psychology_rounded, size: 18),
            ),
            const SizedBox(width: 6),
            const Flexible(
              child: Text(
                'AI Intelligence',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        actions: [
          // Hands-Free Mode Toggle Action
          Padding(
            padding: const EdgeInsets.only(right: 4),
            child: GestureDetector(
              onTap: () => intel.toggleHandsFree(userName),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                decoration: BoxDecoration(
                  color: intel.handsFree ? AppTheme.mint : AppTheme.cardWhite,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppTheme.borderBlack, width: 2),
                  boxShadow: intel.handsFree ? AppTheme.cardShadowPressed : null,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      intel.handsFree ? Icons.mic_rounded : Icons.mic_none_rounded,
                      size: 15,
                      color: intel.handsFree ? const Color(0xFF1B5E20) : AppTheme.textPrimary,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      intel.handsFree ? 'VOICE ON' : 'VOICE',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: intel.handsFree ? const Color(0xFF1B5E20) : AppTheme.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          PopupMenuButton<String>(
            tooltip: 'Settings & Providers',
            icon: const Icon(Icons.tune_rounded, size: 20),
            padding: EdgeInsets.zero,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: const BorderSide(color: AppTheme.borderBlack, width: 2),
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
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: intel.useLiveWebSocket
                  ? AppTheme.mint
                  : (intel.selectedProvider == 'gemini'
                      ? AppTheme.lavender
                      : AppTheme.peach),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppTheme.borderBlack, width: 1.5),
            ),
            child: Text(
              intel.useLiveWebSocket
                  ? '⚡ Nova Live Voice & Tools'
                  : 'Cloud • Gemini',
              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(width: 8),
          const Expanded(
            child: Text(
              'Grounded in your profile & FAISS documents',
              style: TextStyle(fontSize: 11, color: AppTheme.textCaption),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVoiceLiveBanner(IntelligenceProvider intel, String userName) {
    Color bannerBg = AppTheme.mint;
    IconData icon = Icons.mic_rounded;
    String title = 'Hands-Free Mode Active';
    String subtitle = 'Say "Hey MirrorMind" to ask a question hands-free.';

    switch (intel.voiceState) {
      case VoiceState.wakeListening:
        bannerBg = AppTheme.mint;
        icon = Icons.hearing_rounded;
        title = 'Listening for "Hey MirrorMind"…';
        subtitle = 'Speak the wake phrase or tap the mic below to ask.';
        break;
      case VoiceState.wakeDetected:
        bannerBg = AppTheme.peach;
        icon = Icons.auto_awesome_rounded;
        title = '✨ Wake Word Detected!';
        subtitle = 'Preparing response…';
        break;
      case VoiceState.greeting:
        bannerBg = AppTheme.lavender;
        icon = Icons.record_voice_over_rounded;
        title = 'MirrorMind Greeting…';
        subtitle = 'Speaking aloud to you.';
        break;
      case VoiceState.listeningForQuery:
        bannerBg = AppTheme.peach;
        icon = Icons.mic_rounded;
        title = '🎙️ Listening to your question…';
        subtitle = intel.liveTranscript.isNotEmpty
            ? '"${intel.liveTranscript}"'
            : 'Speak now — pause when you\'re done.';
        break;
      case VoiceState.queryProcessing:
        if (intel.activeToolName != null) {
          bannerBg = AppTheme.peach;
          icon = Icons.bolt_rounded;
          title = '🛠️ Nova Voice Automation';
          subtitle = intel.activeToolName!;
        } else {
          bannerBg = AppTheme.lavender;
          icon = Icons.psychology_rounded;
          title = '🧠 Generating Answer…';
          subtitle = 'Retrieving knowledge base evidence…';
        }
        break;
      case VoiceState.speakingAnswer:
        bannerBg = AppTheme.mint;
        icon = Icons.volume_up_rounded;
        title = '🔊 Speaking Answer Aloud…';
        subtitle = 'Tap to stop speech.';
        break;
      case VoiceState.error:
        bannerBg = AppTheme.softRed;
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
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: bannerBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.borderBlack, width: 2),
        boxShadow: AppTheme.cardShadowPressed,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 22, color: AppTheme.borderBlack),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                    Text(
                      subtitle,
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.textBody),
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
                icon: const Icon(Icons.close_rounded, size: 18),
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
            backgroundColor: AppTheme.mint,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.auto_awesome, size: 24),
                    const SizedBox(width: 8),
                    Text('MirrorMind Intelligence', style: AppTheme.cardTitle(context)),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  'Ask career questions, analyze skill gaps, or enable Hands-Free Mode to talk naturally with voice wake words.',
                  style: AppTheme.body(context),
                ),
                const SizedBox(height: 14),
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: intel.handsFree ? AppTheme.softRed : AppTheme.lavender,
                    minimumSize: const Size(double.infinity, 44),
                  ),
                  onPressed: () => intel.toggleHandsFree(userName),
                  icon: Icon(intel.handsFree ? Icons.mic_off : Icons.record_voice_over_rounded),
                  label: Text(
                    intel.handsFree ? 'Turn Off Hands-Free Mode' : 'Enable Hands-Free Voice Mode 🎙️',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          const Text('Suggested Questions', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          ..._quickPrompts.map((prompt) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: NeoCard(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  onTap: () => _submitQuestion(prompt),
                  child: Row(
                    children: [
                      const Icon(Icons.chat_bubble_outline, size: 16, color: AppTheme.textCaption),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(prompt, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
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
            color: AppTheme.lavender,
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(18),
              topRight: Radius.circular(18),
              bottomLeft: Radius.circular(18),
              bottomRight: Radius.circular(4),
            ),
            border: Border.all(color: AppTheme.borderBlack, width: 2),
            boxShadow: AppTheme.cardShadowPressed,
          ),
          child: Text(
            msg.text,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppTheme.textPrimary),
          ),
        ),
      );
    }

    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 16, right: 30),
        child: NeoCard(
          backgroundColor: msg.isError ? AppTheme.softRed : AppTheme.cardWhite,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: AppTheme.mint,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppTheme.borderBlack, width: 1.5),
                    ),
                    child: const Icon(Icons.psychology, size: 16),
                  ),
                  const SizedBox(width: 8),
                  const Text('MirrorMind', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.volume_up_rounded, size: 18),
                    tooltip: 'Read Aloud',
                    onPressed: () => intel.speakMessage(msg.text),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              SelectableText(
                msg.text,
                style: const TextStyle(fontSize: 14, color: AppTheme.textBody, height: 1.5),
              ),
              if (msg.sources.isNotEmpty) ...[
                const SizedBox(height: 12),
                const Text('SOURCES & EVIDENCE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppTheme.textCaption)),
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
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.borderBlack),
              ),
              SizedBox(width: 12),
              Text(
                'Searching documents & generating answer…',
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
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
      decoration: const BoxDecoration(
        color: AppTheme.cardWhite,
        border: Border(top: BorderSide(color: AppTheme.borderBlack, width: 3)),
      ),
      child: Row(
        children: [
          // Push-to-Talk Mic button
          GestureDetector(
            onTap: () => intel.recordQuickVoiceQuery(),
            child: Container(
              height: 48,
              width: 48,
              decoration: BoxDecoration(
                color: isListening ? AppTheme.peach : AppTheme.canvas,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppTheme.borderBlack, width: 2),
                boxShadow: isListening ? AppTheme.cardShadowPressed : null,
              ),
              child: Icon(
                isListening ? Icons.mic_rounded : Icons.mic_none_rounded,
                size: 22,
                color: isListening ? Colors.red : AppTheme.borderBlack,
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
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: AppTheme.borderBlack, width: 2),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: AppTheme.borderBlack, width: 2),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: const BorderSide(color: AppTheme.borderBlack, width: 2),
                ),
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
                color: intel.isQuerying ? const Color(0xFFE0E0E0) : AppTheme.lavender,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppTheme.borderBlack, width: 2),
                boxShadow: AppTheme.cardShadowPressed,
              ),
              child: const Icon(Icons.send_rounded, size: 20, color: AppTheme.borderBlack),
            ),
          ),
        ],
      ),
    );
  }
}
