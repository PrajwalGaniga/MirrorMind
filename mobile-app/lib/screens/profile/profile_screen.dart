import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:image_picker/image_picker.dart';
import '../../core/theme/app_theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/student_provider.dart';
import '../../core/services/cloudinary_service.dart';
import 'edit_profile_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final student = context.watch<StudentProvider>().student;

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(child: Text('Profile', style: AppTheme.heading2(context))),
                  GestureDetector(
                    onTap: () {
                      auth.logout();
                    },
                    child: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppTheme.softRed,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppTheme.borderBlack, width: 2.5),
                      ),
                      child: const Icon(Icons.logout, size: 20),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              // Portfolio hero card
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppTheme.lavender,
                  borderRadius: AppTheme.cardRadius,
                  border: AppTheme.cardBorder,
                  boxShadow: AppTheme.cardShadow,
                ),
                child: Row(
                  children: [
                    _AvatarEditor(avatarUrl: auth.user?.avatarUrl),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(auth.user?.name ?? '', style: AppTheme.sectionTitle(context)),
                          Text(auth.user?.email ?? '', style: AppTheme.caption(context)),
                          if (student != null) ...[
                            const SizedBox(height: 4),
                            Text('${student.branch} • ${student.collegeTier}',
                                style: AppTheme.body(context)),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              if (student != null) ...[
                const SizedBox(height: 16),
                _infoCard(context, student.careerInterest, student.semester, student.backlogCount),
                const SizedBox(height: 16),
                _skillsCard(context, student.skills, student.certifications),
              ],
              const SizedBox(height: 20),
              ElevatedButton.icon(
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const EditProfileScreen()),
                ),
                icon: const Icon(Icons.edit_outlined),
                label: const Text('Edit Profile'),
              ),
              const SizedBox(height: 80),
            ],
          ),
        ),
      ),
    );
  }

  Widget _infoCard(BuildContext context, String interest, int sem, int backlogs) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.cardWhite,
        borderRadius: AppTheme.cardRadius,
        border: AppTheme.cardBorder,
        boxShadow: AppTheme.cardShadow,
      ),
      child: Column(
        children: [
          _infoRow(context, '🎯 Career Interest', interest),
          const Divider(height: 20),
          _infoRow(context, '📚 Current Semester', 'Semester $sem'),
          const Divider(height: 20),
          _infoRow(context, '⚠️ Backlogs', '$backlogs'),
        ],
      ),
    );
  }

  Widget _infoRow(BuildContext context, String label, String value) {
    return Row(
      children: [
        Expanded(child: Text(label, style: AppTheme.caption(context))),
        Text(value, style: AppTheme.cardTitle(context)),
      ],
    );
  }

  Widget _skillsCard(BuildContext context, List<String> skills, List<String> certs) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.cardWhite,
        borderRadius: AppTheme.cardRadius,
        border: AppTheme.cardBorder,
        boxShadow: AppTheme.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Skills', style: AppTheme.cardTitle(context)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: skills.map((s) => _chip(s, AppTheme.lavender)).toList(),
          ),
          if (certs.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text('Certifications', style: AppTheme.cardTitle(context)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: certs.map((c) => _chip(c, AppTheme.mint)).toList(),
            ),
          ],
        ],
      ),
    );
  }

  Widget _chip(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppTheme.borderBlack, width: 1.5),
      ),
      child: Text(label,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
    );
  }
}

class _AvatarEditor extends StatefulWidget {
  final String? avatarUrl;
  const _AvatarEditor({this.avatarUrl});

  @override
  State<_AvatarEditor> createState() => _AvatarEditorState();
}

class _AvatarEditorState extends State<_AvatarEditor> {
  bool _uploading = false;

  Future<void> _pick() async {
    final picker = ImagePicker();
    final file = await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (file == null) return;

    setState(() => _uploading = true);
    final url = await CloudinaryService()
        .uploadFile(File(file.path), CloudinaryFolder.avatars);
    setState(() => _uploading = false);

    if (url != null && mounted) {
      context.read<AuthProvider>().updateAvatar(url);
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _uploading ? null : _pick,
      child: Stack(
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: AppTheme.peach,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppTheme.borderBlack, width: 3),
              boxShadow: AppTheme.cardShadow,
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(17),
              child: _uploading
                  ? const Center(
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : widget.avatarUrl != null
                      ? CachedNetworkImage(
                          imageUrl: widget.avatarUrl!,
                          fit: BoxFit.cover,
                        )
                      : const Icon(Icons.person, size: 36),
            ),
          ),
          Positioned(
            bottom: 0,
            right: 0,
            child: Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                color: AppTheme.cardWhite,
                shape: BoxShape.circle,
                border: Border.all(color: AppTheme.borderBlack, width: 1.5),
              ),
              child: const Icon(Icons.camera_alt, size: 12),
            ),
          ),
        ],
      ),
    );
  }
}
