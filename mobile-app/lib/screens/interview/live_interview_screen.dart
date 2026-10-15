import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/services/api_service.dart';
import '../../core/services/voice_service.dart';
import '../../core/services/live_interview_service.dart';
import '../../providers/auth_provider.dart';

class LiveInterviewScreen extends StatefulWidget {
  final String initialRole;
  const LiveInterviewScreen({super.key, this.initialRole = 'Full Stack Developer'});

  @override
  State<LiveInterviewScreen> createState() => _LiveInterviewScreenState();
}

class _LiveInterviewScreenState extends State<LiveInterviewScreen>
    with SingleTickerProviderStateMixin {
  final LiveInterviewService _interview = LiveInterviewService();
  final VoiceService _voice = VoiceService();
  final ApiService _api = ApiService();
  final ScrollController _scrollCtrl = ScrollController();
  final TextEditingController _textCtrl = TextEditingController();

  late AnimationController _pulseCtrl;
  late Animation<double> _pulseAnimation;

  late String _selectedRole;
  final List<InterviewTranscriptEntry> _transcripts = [];

  bool _isMicActive = false;
  String _liveCandidateSpeech = '';
  int _secondsElapsed = 0;
  Timer? _sessionTimer;
  String? _errorMessage;

  final List<String> _roleOptions = const [
    'Full Stack Developer',
    'Backend Developer',
    'Frontend Developer',
    'AI / ML Engineer',
    'DevOps / Cloud Engineer',
    'Data Engineer',
  ];

  @override
  void initState() {
    super.initState();
    _selectedRole = widget.initialRole;

    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 0.94, end: 1.06).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );

    _setupService();
    _startTimer();
    _connect();
  }

  void _setupService() {
    _interview.onTranscript = (entry) {
      if (!mounted) return;
      setState(() {
        if (_transcripts.isNotEmpty &&
            _transcripts.last.role == entry.role &&
            !_transcripts.last.isFinal) {
          _transcripts[_transcripts.length - 1] = entry;
        } else {
          _transcripts.add(entry);
        }
      });
      _scrollToBottom();

      // Read Alex's question aloud via TTS if native audio isn't hooked
      if (entry.role == 'assistant' && entry.isFinal) {
        final clean = entry.text.replaceAll(RegExp(r'[*#_`]'), '');
        _voice.speak(clean);
      }
    };

    _interview.onError = (err) {
      if (!mounted) return;
      setState(() => _errorMessage = err);
    };

    _interview.onInterrupted = () {
      _voice.stopSpeaking();
    };
  }

  void _startTimer() {
    _sessionTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      setState(() => _secondsElapsed++);
    });
  }

  Future<void> _connect() async {
    setState(() => _errorMessage = null);
    final token = await _api.getToken();
    if (token == null || token.isEmpty) {
      setState(() => _errorMessage = 'Please log in to start your interview.');
      return;
    }

    final ok = await _interview.connect(token: token, role: _selectedRole);
    if (!ok && mounted) {
      setState(() => _errorMessage = 'Failed to connect to live interview proxy.');
    }
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

  String _formatTimer(int totalSeconds) {
    final m = (totalSeconds ~/ 60).toString().padLeft(2, '0');
    final s = (totalSeconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  Future<void> _toggleMic() async {
    if (_isMicActive) {
      // Stop speaking & commit candidate turn
      setState(() => _isMicActive = false);
      await _voice.stopListening();
      if (_liveCandidateSpeech.trim().isNotEmpty) {
        _interview.sendCandidateText(_liveCandidateSpeech.trim());
        setState(() => _liveCandidateSpeech = '');
      }
    } else {
      // Start listening to candidate
      final ok = await _voice.init();
      if (!ok) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Microphone permission required for speech.')),
        );
        return;
      }

      setState(() {
        _isMicActive = true;
        _liveCandidateSpeech = '';
      });

      _interview.sendActivityStart();

      await _voice.startListening(
        onResult: (words, isFinal) {
          if (!mounted) return;
          setState(() => _liveCandidateSpeech = words);
          if (isFinal && words.trim().isNotEmpty) {
            _toggleMic();
          }
        },
        onStatusChange: (status) {
          if (status == 'notListening' && _isMicActive) {
            _toggleMic();
          }
        },
        pauseFor: const Duration(seconds: 3),
        listenFor: const Duration(minutes: 2),
      );
    }
  }

  void _sendManualAnswer() {
    final text = _textCtrl.text.trim();
    if (text.isEmpty) return;
    _textCtrl.clear();
    Navigator.of(context).pop();
    _interview.sendCandidateText(text);
  }

  void _showTextAnswerModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
            color: AppTheme.cardWhite,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            boxShadow: AppTheme.cardShadowHover,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Type Your Answer', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: 20),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _textCtrl,
                autofocus: true,
                maxLines: 4,
                decoration: const InputDecoration(
                  hintText: 'Explain your approach, system architecture, or logic…',
                ),
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Cancel', style: TextStyle(color: AppTheme.textCaption)),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    onPressed: _sendManualAnswer,
                    style: ElevatedButton.styleFrom(
                      minimumSize: const Size(130, 44),
                    ),
                    child: const Text('Submit Answer 🚀'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _endInterview() {
    _sessionTimer?.cancel();
    _interview.disconnect();
    _voice.stopSpeaking();

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.cardWhite,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Text('🎉 ', style: TextStyle(fontSize: 22)),
            Text('Interview Complete!', style: TextStyle(fontWeight: FontWeight.w800)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Target Role: $_selectedRole', style: const TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text('Session Duration: ${_formatTimer(_secondsElapsed)}', style: const TextStyle(color: AppTheme.textCaption)),
            const SizedBox(height: 4),
            Text('Exchanges: ${_transcripts.length} messages', style: const TextStyle(color: AppTheme.textCaption)),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppTheme.emeraldBg,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppTheme.emerald.withValues(alpha: 0.2), width: 1.0),
              ),
              child: const Text(
                'Great practice session! Alex simulated realistic technical interview questions. Your responses have been indexed into your Digital Twin.',
                style: TextStyle(fontSize: 13, height: 1.4, color: AppTheme.emeraldText),
              ),
            ),
          ],
        ),
        actions: [
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx); // Close dialog
              Navigator.pop(context); // Exit interview screen
            },
            child: const Text('Back to Dashboard'),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _sessionTimer?.cancel();
    _pulseCtrl.dispose();
    _scrollCtrl.dispose();
    _textCtrl.dispose();
    _interview.disconnect();
    _voice.stopSpeaking();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final candidateName = auth.user?.name ?? 'Candidate';

    return Scaffold(
      backgroundColor: AppTheme.canvas,
      appBar: AppBar(
        backgroundColor: AppTheme.cardWhite,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close_rounded, color: AppTheme.textPrimary),
          onPressed: () {
            if (_transcripts.isNotEmpty) {
              _endInterview();
            } else {
              Navigator.pop(context);
            }
          },
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: AppTheme.emerald,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 8),
                const Text(
                  'Alex • Senior Interviewer',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppTheme.textPrimary),
                ),
              ],
            ),
            const Text(
              'Gemini Live Technical Simulation',
              style: TextStyle(fontSize: 11, color: AppTheme.textCaption),
            ),
          ],
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 16, top: 12, bottom: 12),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: AppTheme.canvas,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: AppTheme.borderLight, width: 1.0),
            ),
            child: Row(
              children: [
                const Icon(Icons.timer_outlined, size: 14, color: AppTheme.primary),
                const SizedBox(width: 4),
                Text(
                  _formatTimer(_secondsElapsed),
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.textPrimary),
                ),
              ],
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            _buildRoleSelector(),
            if (_errorMessage != null) _buildErrorBanner(),
            Expanded(child: _buildConversationList(candidateName)),
            if (_isMicActive || _liveCandidateSpeech.isNotEmpty) _buildLiveCandidateSpeechPill(),
            _buildBottomControls(),
          ],
        ),
      ),
    );
  }

  Widget _buildRoleSelector() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: const BoxDecoration(
        color: AppTheme.cardWhite,
        border: Border(bottom: BorderSide(color: AppTheme.borderLight, width: 1.0)),
      ),
      child: Row(
        children: [
          const Icon(Icons.badge_outlined, size: 16, color: AppTheme.primary),
          const SizedBox(width: 8),
          const Text('Role: ', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textCaption)),
          DropdownButton<String>(
            value: _selectedRole,
            isDense: true,
            underline: const SizedBox(),
            items: _roleOptions.map((r) {
              return DropdownMenuItem(
                value: r,
                child: Text(r, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
              );
            }).toList(),
            onChanged: (val) {
              if (val != null && val != _selectedRole) {
                setState(() => _selectedRole = val);
                _interview.disconnect();
                _connect();
              }
            },
          ),
          const Spacer(),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: AppTheme.primaryLight,
              borderRadius: BorderRadius.circular(6),
            ),
            child: const Text('Adaptive AI', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppTheme.primary)),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorBanner() {
    return Container(
      margin: const EdgeInsets.all(12),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: AppTheme.roseBg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppTheme.rose.withValues(alpha: 0.2), width: 1.0),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline_rounded, size: 18, color: AppTheme.rose),
          const SizedBox(width: 8),
          Expanded(child: Text(_errorMessage!, style: const TextStyle(fontSize: 12, color: AppTheme.roseText))),
          TextButton(
            onPressed: _connect,
            child: const Text('Retry', style: TextStyle(fontWeight: FontWeight.w700, color: AppTheme.rose)),
          ),
        ],
      ),
    );
  }

  Widget _buildConversationList(String candidateName) {
    if (_transcripts.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ScaleTransition(
              scale: _pulseAnimation,
              child: Container(
                padding: const EdgeInsets.all(26),
                decoration: BoxDecoration(
                  color: AppTheme.primaryLight,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppTheme.primary.withValues(alpha: 0.2), width: 1.5),
                  boxShadow: AppTheme.cardShadow,
                ),
                child: const Icon(Icons.graphic_eq_rounded, size: 48, color: AppTheme.primary),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Alex is reviewing your profile…',
              style: AppTheme.cardTitle(context),
            ),
            const SizedBox(height: 6),
            const Text(
              'Your first technical scenario will appear shortly.',
              style: TextStyle(fontSize: 12, color: AppTheme.textCaption),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      controller: _scrollCtrl,
      padding: const EdgeInsets.all(16),
      itemCount: _transcripts.length,
      itemBuilder: (ctx, idx) {
        final t = _transcripts[idx];
        final isAlex = t.role == 'assistant';

        return Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: isAlex ? MainAxisAlignment.start : MainAxisAlignment.end,
            children: [
              if (isAlex) ...[
                Container(
                  padding: const EdgeInsets.all(7),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryLight,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppTheme.primary.withValues(alpha: 0.2), width: 1.0),
                  ),
                  child: const Icon(Icons.smart_toy_rounded, size: 16, color: AppTheme.primary),
                ),
                const SizedBox(width: 8),
              ],
              Flexible(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: isAlex ? AppTheme.cardWhite : AppTheme.primary,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: isAlex ? AppTheme.borderLight : Colors.transparent,
                      width: 1.0,
                    ),
                    boxShadow: AppTheme.cardShadow,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isAlex ? 'Alex (Interviewer)' : candidateName,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: isAlex ? AppTheme.primary : Colors.white70,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        t.text,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: isAlex ? AppTheme.textPrimary : Colors.white,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              if (!isAlex) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.all(7),
                  decoration: const BoxDecoration(
                    color: AppTheme.primary,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.person_rounded, size: 16, color: Colors.white),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  Widget _buildLiveCandidateSpeechPill() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: AppTheme.amberBg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppTheme.amber.withValues(alpha: 0.3), width: 1.0),
      ),
      child: Row(
        children: [
          const Icon(Icons.mic_rounded, size: 16, color: AppTheme.amberText),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              _liveCandidateSpeech.isEmpty ? 'Listening to your response…' : '"$_liveCandidateSpeech"',
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.amberText),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomControls() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
      decoration: const BoxDecoration(
        color: AppTheme.cardWhite,
        border: Border(top: BorderSide(color: AppTheme.borderLight, width: 1.0)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Text Input button
          IconButton(
            onPressed: _showTextAnswerModal,
            icon: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppTheme.canvas,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.borderLight, width: 1.0),
              ),
              child: const Icon(Icons.keyboard_rounded, size: 20, color: AppTheme.textPrimary),
            ),
          ),

          // Central Push to Speak / Mic Toggle
          GestureDetector(
            onTap: _toggleMic,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
              decoration: BoxDecoration(
                color: _isMicActive ? AppTheme.rose : AppTheme.primary,
                borderRadius: BorderRadius.circular(999),
                boxShadow: [
                  BoxShadow(
                    color: (_isMicActive ? AppTheme.rose : AppTheme.primary).withValues(alpha: 0.3),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Icon(
                    _isMicActive ? Icons.stop_rounded : Icons.mic_rounded,
                    size: 20,
                    color: Colors.white,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    _isMicActive ? 'Stop Speaking' : 'Tap to Answer',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // End Interview button
          IconButton(
            onPressed: _endInterview,
            icon: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppTheme.roseBg,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.rose.withValues(alpha: 0.2), width: 1.0),
              ),
              child: const Icon(Icons.call_end_rounded, size: 20, color: AppTheme.rose),
            ),
          ),
        ],
      ),
    );
  }
}
