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

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final studentProv = context.watch<StudentProvider>();
    final student = studentProv.student;

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => studentProv.fetchProfile(),
          child: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildHeader(context, auth, student),
                      const SizedBox(height: 20),
                      _buildHeroBanner(context, student),
                      const SizedBox(height: 20),
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
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Hey, ${auth.user?.name.split(' ').first ?? 'there'} 👋',
                  style: AppTheme.sectionTitle(context)),
              Text('Your career dashboard', style: AppTheme.caption(context)),
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
        color: AppTheme.lavender,
        borderRadius: AppTheme.cardRadius,
        border: AppTheme.cardBorder,
        boxShadow: AppTheme.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('🪞', style: TextStyle(fontSize: 32)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      student?.name ?? 'Complete your profile',
                      style: AppTheme.sectionTitle(context),
                    ),
                    if (student != null)
                      Text('${student.branch} • Sem ${student.semester}',
                          style: AppTheme.caption(context)),
                  ],
                ),
              ),
            ],
          ),
          if (student != null) ...[
            const SizedBox(height: 16),
            Row(
              children: [
                _metricChip('⭐ CGPA', student.cgpa.toStringAsFixed(2), AppTheme.peach),
                const SizedBox(width: 8),
                _metricChip('🏢 Internships', '${student.internshipCount}', AppTheme.mint),
                const SizedBox(width: 8),
                _metricChip('🔨 Projects', '${student.projectsCount}', AppTheme.skyBlue),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _metricChip(String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.borderBlack, width: 2),
        ),
        child: Column(
          children: [
            Text(value,
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
            Text(label,
                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600),
                textAlign: TextAlign.center),
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
        Text('Quick Stats', style: AppTheme.sectionTitle(context)),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _statCard(
                context,
                icon: '🎯',
                title: 'Career Focus',
                value: student.careerInterest,
                color: AppTheme.peach,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _statCard(
                context,
                icon: '💬',
                title: 'Comm. Rating',
                value: '${student.communicationRating}/10',
                color: AppTheme.mint,
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
      required Color color}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppTheme.borderBlack, width: 2.5),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(icon, style: const TextStyle(fontSize: 24)),
          const SizedBox(height: 8),
          Text(title, style: AppTheme.caption(context)),
          const SizedBox(height: 4),
          Text(value,
              style:
                  const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }

  Widget _buildSkillsSection(BuildContext context, StudentModel? student) {
    if (student == null || student.skills.isEmpty) return const SizedBox();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Skills', style: AppTheme.sectionTitle(context)),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: student.skills.map((skill) {
            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: AppTheme.cardWhite,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppTheme.borderBlack, width: 2),
              ),
              child: Text(skill,
                  style: const TextStyle(
                      fontSize: 12, fontWeight: FontWeight.w600)),
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
        Text('Quick Actions', style: AppTheme.sectionTitle(context)),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _actionCard(
                context,
                icon: '✨',
                label: 'Run AI Predict',
                color: AppTheme.lavender,
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
                icon: '📄',
                label: 'Add Certificate',
                color: AppTheme.mint,
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const AddInternshipScreen()),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _actionCard(BuildContext context,
      {required String icon,
      required String label,
      required Color color,
      required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: AppTheme.borderBlack, width: 2.5),
          boxShadow: AppTheme.cardShadow,
        ),
        child: Row(
          children: [
            Text(icon, style: const TextStyle(fontSize: 22)),
            const SizedBox(width: 10),
            Expanded(
              child: Text(label,
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w700)),
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
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: AppTheme.peach,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppTheme.borderBlack, width: 3),
              boxShadow: AppTheme.cardShadow,
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(15),
              child: widget.avatarUrl != null
                  ? CachedNetworkImage(
                      imageUrl: widget.avatarUrl!,
                      fit: BoxFit.cover,
                    )
                  : const Icon(Icons.person, size: 30),
            ),
          ),
          if (_uploading)
            Positioned.fill(
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.black38,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: const Center(
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)),
              ),
            ),
          Positioned(
            bottom: 0,
            right: 0,
            child: Container(
              width: 18,
              height: 18,
              decoration: BoxDecoration(
                color: AppTheme.lavender,
                shape: BoxShape.circle,
                border: Border.all(color: AppTheme.borderBlack, width: 1.5),
              ),
              child: const Icon(Icons.edit, size: 10),
            ),
          ),
        ],
      ),
    );
  }
}
