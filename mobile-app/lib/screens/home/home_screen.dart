import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/theme/app_theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/student_provider.dart';
import '../../core/services/cloudinary_service.dart';
import '../../models/student_model.dart';
import '../predict/predict_screen.dart';
import '../internships/internships_screen.dart';
import '../projects/projects_screen.dart';
import '../intelligence/intelligence_screen.dart';
import '../documents/documents_screen.dart';
import '../interview/live_interview_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final studentProv = context.watch<StudentProvider>();
    final student = studentProv.student;

    return Scaffold(
      backgroundColor: AppTheme.canvas,
      body: SafeArea(
        child: RefreshIndicator(
          color: AppTheme.primary,
          onRefresh: () => studentProv.fetchProfile(),
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildHeader(context, auth, student),
                      const SizedBox(height: 18),
                      _buildHeroBanner(context, student),
                      const SizedBox(height: 16),
                      _buildNovaVoiceCard(context),
                      const SizedBox(height: 12),
                      _buildLiveInterviewCard(context, student),
                      const SizedBox(height: 18),
                      _buildStatsRow(context, student),
                      const SizedBox(height: 20),
                      _buildSkillsSection(context, student),
                      const SizedBox(height: 20),
                      _buildQuickActions(context),
                      const SizedBox(height: 100),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, AuthProvider auth, StudentModel? student) {
    final firstName = auth.user?.name.split(' ').first ?? 'Student';
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text('Hey, $firstName 👋', style: AppTheme.heading2(context)),
                ],
              ),
              const SizedBox(height: 3),
              Row(
                children: [
                  Container(
                    width: 7,
                    height: 7,
                    decoration: const BoxDecoration(
                      color: AppTheme.emerald,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  const Text(
                    'Student Digital Twin • Online',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: AppTheme.textCaption,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        _AvatarWidget(avatarUrl: auth.user?.avatarUrl),
      ],
    );
  }

  Widget _buildHeroBanner(BuildContext context, StudentModel? student) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.cardWhite,
        borderRadius: AppTheme.cardRadius,
        border: Border.all(color: AppTheme.borderLight, width: 1.0),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppTheme.primaryLight,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppTheme.primary.withValues(alpha: 0.15), width: 1.0),
                ),
                child: const Center(
                  child: Text('🧠', style: TextStyle(fontSize: 24)),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      student?.name ?? 'Complete your profile',
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.textPrimary,
                        letterSpacing: -0.2,
                      ),
                    ),
                    const SizedBox(height: 4),
                    if (student != null)
                      Text(
                        '${student.branch} • Semester ${student.semester} (${student.collegeTier})',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppTheme.textCaption,
                          fontWeight: FontWeight.w500,
                        ),
                      )
                    else
                      const Text(
                        'Set up your student twin to start AI career predictions',
                        style: TextStyle(fontSize: 12, color: AppTheme.textCaption),
                      ),
                  ],
                ),
              ),
            ],
          ),
          if (student != null) ...[
            const SizedBox(height: 18),
            Container(
              height: 1,
              color: AppTheme.borderLight,
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                _metricChip('CGPA', student.cgpa.toStringAsFixed(2), Icons.school_rounded, AppTheme.primaryLight, AppTheme.primary),
                const SizedBox(width: 10),
                _metricChip(
                  'Internships',
                  '${student.internshipCount}',
                  Icons.business_center_rounded,
                  AppTheme.emeraldBg,
                  AppTheme.emeraldText,
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const InternshipsScreen()),
                  ),
                ),
                const SizedBox(width: 10),
                _metricChip(
                  'Projects',
                  '${student.projectsCount}',
                  Icons.code_rounded,
                  AppTheme.purpleBg,
                  AppTheme.purpleText,
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const ProjectsScreen()),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _metricChip(
    String label,
    String value,
    IconData icon,
    Color bg,
    Color textCol, {
    VoidCallback? onTap,
  }) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: textCol.withValues(alpha: 0.12), width: 1.0),
          ),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, size: 13, color: textCol),
                  const SizedBox(width: 4),
                  Text(
                    value,
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: textCol,
                      letterSpacing: -0.3,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 2),
              Text(
                label,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: textCol.withValues(alpha: 0.8),
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNovaVoiceCard(BuildContext context) {
    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const IntelligenceScreen()),
        );
      },
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.cardWhite,
          borderRadius: AppTheme.cardRadius,
          border: Border.all(color: AppTheme.primary.withValues(alpha: 0.25), width: 1.0),
          boxShadow: AppTheme.cardShadow,
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.primaryLight,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppTheme.primary.withValues(alpha: 0.15), width: 1.0),
              ),
              child: const Icon(Icons.mic_rounded, size: 22, color: AppTheme.primary),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Text(
                        'Nova Voice Co-Pilot',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppTheme.primaryLight,
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(color: AppTheme.primary.withValues(alpha: 0.2), width: 1.0),
                        ),
                        child: const Text(
                          'VOICE',
                          style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: AppTheme.primary),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  const Text(
                    'Say "Hey MirrorMind" to ask anything hands-free',
                    style: TextStyle(fontSize: 12, color: AppTheme.textCaption),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, size: 20, color: AppTheme.textCaption),
          ],
        ),
      ),
    );
  }

  Widget _buildLiveInterviewCard(BuildContext context, StudentModel? student) {
    final topRole = student?.predictions != null && student!.predictions!.isNotEmpty
        ? student.predictions!.first.label
        : 'Full Stack Developer';

    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => LiveInterviewScreen(initialRole: topRole),
          ),
        );
      },
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.cardWhite,
          borderRadius: AppTheme.cardRadius,
          border: Border.all(color: AppTheme.purple.withValues(alpha: 0.25), width: 1.0),
          boxShadow: AppTheme.cardShadow,
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.purpleBg,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppTheme.purple.withValues(alpha: 0.15), width: 1.0),
              ),
              child: const Icon(Icons.record_voice_over_rounded, size: 22, color: AppTheme.purple),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Text(
                        'AI Mock Interview',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.textPrimary,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppTheme.purpleBg,
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(color: AppTheme.purple.withValues(alpha: 0.2), width: 1.0),
                        ),
                        child: const Text(
                          'GEMINI LIVE',
                          style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: AppTheme.purple),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    'Real-time simulation with Alex for $topRole',
                    style: const TextStyle(fontSize: 12, color: AppTheme.textCaption),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, size: 20, color: AppTheme.textCaption),
          ],
        ),
      ),
    );
  }

  Widget _buildStatsRow(BuildContext context, StudentModel? student) {
    if (student == null) return const SizedBox();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Twin Insights', style: AppTheme.sectionTitle(context)),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _statCard(
                context,
                icon: '🎯',
                title: 'Career Focus',
                value: student.careerInterest,
                bg: AppTheme.cardWhite,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _statCard(
                context,
                icon: '💬',
                title: 'Comm. Rating',
                value: '${student.communicationRating}/10',
                bg: AppTheme.cardWhite,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _statCard(BuildContext context,
      {required String icon,
      required String title,
      required String value,
      required Color bg}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.borderLight, width: 1.0),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(icon, style: const TextStyle(fontSize: 22)),
          const SizedBox(height: 8),
          Text(title, style: AppTheme.caption(context)),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.textPrimary),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildSkillsSection(BuildContext context, StudentModel? student) {
    if (student == null || student.skills.isEmpty) return const SizedBox();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Verified Skills', style: AppTheme.sectionTitle(context)),
            Text('${student.skills.length} Total', style: AppTheme.caption(context)),
          ],
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: student.skills.map((skill) {
            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: AppTheme.cardWhite,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: AppTheme.borderLight, width: 1.0),
                boxShadow: AppTheme.cardShadow,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration: const BoxDecoration(
                      color: AppTheme.primary,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    skill,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                ],
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildQuickActions(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Quick Modules', style: AppTheme.sectionTitle(context)),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _actionCard(
                context,
                icon: Icons.auto_awesome_rounded,
                iconColor: AppTheme.primary,
                iconBg: AppTheme.primaryLight,
                label: 'AI Predictor',
                subtitle: 'Match career roles',
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const PredictScreen()),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _actionCard(
                context,
                icon: Icons.psychology_rounded,
                iconColor: AppTheme.purple,
                iconBg: AppTheme.purpleBg,
                label: 'Nova Assistant',
                subtitle: 'Ask RAG intelligence',
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const IntelligenceScreen()),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _actionCard(
                context,
                icon: Icons.folder_open_rounded,
                iconColor: AppTheme.amber,
                iconBg: AppTheme.amberBg,
                label: 'Documents',
                subtitle: 'FAISS Knowledge Base',
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const DocumentsScreen()),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _actionCard(
                context,
                icon: Icons.code_rounded,
                iconColor: AppTheme.emerald,
                iconBg: AppTheme.emeraldBg,
                label: 'Projects',
                subtitle: 'Portfolio intelligence',
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const ProjectsScreen()),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _actionCard(
    BuildContext context, {
    required IconData icon,
    required Color iconColor,
    required Color iconBg,
    required String label,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppTheme.cardWhite,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.borderLight, width: 1.0),
          boxShadow: AppTheme.cardShadow,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: iconBg,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 20, color: iconColor),
            ),
            const SizedBox(height: 12),
            Text(
              label,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppTheme.textPrimary,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: const TextStyle(
                fontSize: 11,
                color: AppTheme.textCaption,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AvatarWidget extends StatefulWidget {
  final String? avatarUrl;
  const _AvatarWidget({this.avatarUrl});

  @override
  State<_AvatarWidget> createState() => _AvatarWidgetState();
}

class _AvatarWidgetState extends State<_AvatarWidget> {
  bool _uploading = false;

  Future<void> _pickAndUpload() async {
    final picker = ImagePicker();
    final file = await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (file == null) return;

    setState(() => _uploading = true);
    final url = await CloudinaryService().uploadFile(
        File(file.path), CloudinaryFolder.avatars);
    setState(() => _uploading = false);

    if (url != null && mounted) {
      context.read<AuthProvider>().updateAvatar(url);
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _uploading ? null : _pickAndUpload,
      child: Stack(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: AppTheme.cardWhite,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppTheme.borderLight, width: 1.5),
              boxShadow: AppTheme.cardShadow,
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(15),
              child: widget.avatarUrl != null
                  ? CachedNetworkImage(
                      imageUrl: widget.avatarUrl!,
                      fit: BoxFit.cover,
                    )
                  : const Center(
                      child: Icon(Icons.person_rounded, size: 26, color: AppTheme.textCaption),
                    ),
            ),
          ),
          if (_uploading)
            Positioned.fill(
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.black45,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Center(
                  child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                ),
              ),
            ),
          Positioned(
            bottom: 0,
            right: 0,
            child: Container(
              width: 18,
              height: 18,
              decoration: BoxDecoration(
                color: AppTheme.primary,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 1.5),
              ),
              child: const Icon(Icons.camera_alt_rounded, size: 9, color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }
}
