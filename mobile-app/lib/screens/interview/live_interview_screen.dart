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

    _pulseAnimation = Tween<double>(begin: 0.92, end: 1.10).animate(
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
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: AppTheme.cardWhite,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            border: Border.all(color: AppTheme.borderBlack, width: 2),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Type Your Answer', style: AppTheme.cardTitle(context)),
              const SizedBox(height: 10),
              TextField(
                controller: _textCtrl,
                autofocus: true,
                maxLines: 4,
                decoration: InputDecoration(
                  hintText: 'Explain your approach, code design, or architecture…',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: const BorderSide(color: AppTheme.borderBlack, width: 1.5),
                  ),
                ),
              ),
              const SizedBox(height: 14),
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
                      backgroundColor: AppTheme.mint,
                      foregroundColor: AppTheme.borderBlack,
                      elevation: 0,
                      side: const BorderSide(color: AppTheme.borderBlack, width: 1.5),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: const Text('Submit Answer 🚀', style: TextStyle(fontWeight: FontWeight.w800)),
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
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: AppTheme.borderBlack, width: 2),
        ),
        title: const Row(
          children: [
            Text('🎉 ', style: TextStyle(fontSize: 22)),
            Text('Interview Completed!', style: TextStyle(fontWeight: FontWeight.w800)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Role: $_selectedRole', style: const TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text('Session Duration: ${_formatTimer(_secondsElapsed)}', style: const TextStyle(color: AppTheme.textCaption)),
            const SizedBox(height: 4),
            Text('Exchanges: ${_transcripts.length} messages', style: const TextStyle(color: AppTheme.textCaption)),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.mint.withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.borderBlack, width: 1),
              ),
              child: const Text(
                'Great job practicing! Your responses were analyzed in real time. Keep refining your technical communication and project stories.',
                style: TextStyle(fontSize: 13, height: 1.4),
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
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.lavender,
              foregroundColor: AppTheme.borderBlack,
              elevation: 0,
              side: const BorderSide(color: AppTheme.borderBlack, width: 1.5),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Back to Dashboard', style: TextStyle(fontWeight: FontWeight.w800)),
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
        backgroundColor: AppTheme.canvas,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close_rounded, color: AppTheme.borderBlack),
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
                    color: Color(0xFF2E7D32),
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                const Text(
                  'Live Interview with Alex',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppTheme.borderBlack),
                ),
              ],
            ),
            const Text(
              'Senior Technical Interviewer',
              style: TextStyle(fontSize: 11, color: AppTheme.textCaption),
            ),
          ],
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 16, top: 12, bottom: 12),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: AppTheme.cardWhite,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppTheme.borderBlack, width: 1.5),
            ),
            child: Row(
              children: [
                const Icon(Icons.timer_outlined, size: 14, color: AppTheme.borderBlack),
                const SizedBox(width: 4),
                Text(
                  _formatTimer(_secondsElapsed),
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppTheme.borderBlack),
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
      color: AppTheme.lavender.withValues(alpha: 0.4),
      child: Row(
        children: [
          const Icon(Icons.badge_outlined, size: 16, color: AppTheme.borderBlack),
          const SizedBox(width: 8),
          const Text('Role: ', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
          DropdownButton<String>(
            value: _selectedRole,
            isDense: true,
            underline: const SizedBox(),
            items: _roleOptions.map((r) {
              return DropdownMenuItem(
                value: r,
                child: Text(r, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
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
              color: AppTheme.mint,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppTheme.borderBlack, width: 1),
            ),
            child: const Text('Adaptive AI', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorBanner() {
    return Container(
      margin: const EdgeInsets.all(12),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppTheme.softRed,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppTheme.borderBlack, width: 1.5),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline_rounded, size: 18),
          const SizedBox(width: 8),
          Expanded(child: Text(_errorMessage!, style: const TextStyle(fontSize: 12))),
          TextButton(
            onPressed: _connect,
            child: const Text('Retry', style: TextStyle(fontWeight: FontWeight.w800, color: AppTheme.borderBlack)),
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
                padding: const EdgeInsets.all(28),
                decoration: BoxDecoration(
                  color: AppTheme.lavender,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppTheme.borderBlack, width: 3),
                  boxShadow: AppTheme.cardShadow,
                ),
                child: const Icon(Icons.graphic_eq_rounded, size: 54, color: AppTheme.borderBlack),
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'Alex is reviewing your profile…',
              style: AppTheme.cardTitle(context),
            ),
            const SizedBox(height: 6),
            Text(
              'Your first technical question will appear shortly.',
              style: AppTheme.caption(context),
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
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: AppTheme.lavender,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppTheme.borderBlack, width: 1.5),
                  ),
                  child: const Icon(Icons.person_rounded, size: 16),
                ),
                const SizedBox(width: 8),
              ],
              Flexible(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: isAlex ? AppTheme.cardWhite : AppTheme.mint,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppTheme.borderBlack, width: 2),
                    boxShadow: AppTheme.cardShadowPressed,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isAlex ? 'Alex (Interviewer)' : candidateName,
                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppTheme.textCaption),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        t.text,
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, height: 1.4),
                      ),
                    ],
                  ),
                ),
              ),
              if (!isAlex) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: AppTheme.mint,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppTheme.borderBlack, width: 1.5),
                  ),
                  child: const Icon(Icons.school_rounded, size: 16),
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
        color: AppTheme.peach,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.borderBlack, width: 1.5),
      ),
      child: Row(
        children: [
          const Icon(Icons.mic_rounded, size: 16, color: AppTheme.borderBlack),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              _liveCandidateSpeech.isEmpty ? 'Listening to your answer…' : '"$_liveCandidateSpeech"',
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
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
        border: Border(top: BorderSide(color: AppTheme.borderBlack, width: 2)),
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
                color: AppTheme.lavender,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.borderBlack, width: 1.5),
              ),
              child: const Icon(Icons.keyboard_rounded, size: 20, color: AppTheme.borderBlack),
            ),
          ),

          // Central Push to Speak / Mic Toggle
          GestureDetector(
            onTap: _toggleMic,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
              decoration: BoxDecoration(
                color: _isMicActive ? AppTheme.softRed : AppTheme.mint,
                borderRadius: BorderRadius.circular(30),
                border: Border.all(color: AppTheme.borderBlack, width: 2.5),
                boxShadow: AppTheme.cardShadow,
              ),
              child: Row(
                children: [
                  Icon(
                    _isMicActive ? Icons.stop_rounded : Icons.mic_rounded,
                    size: 22,
                    color: AppTheme.borderBlack,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    _isMicActive ? 'Stop Speaking' : 'Tap to Answer',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: AppTheme.borderBlack,
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
                color: AppTheme.softRed.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.borderBlack, width: 1.5),
              ),
              child: const Icon(Icons.call_end_rounded, size: 20, color: Color(0xFFC62828)),
            ),
          ),
        ],
      ),
    );
  }
}
