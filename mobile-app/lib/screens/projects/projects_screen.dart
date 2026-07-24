import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../core/theme/app_theme.dart';
import '../../providers/student_provider.dart';
import '../../core/services/cloudinary_service.dart';
import '../../models/project_model.dart';
import '../../models/skill_model.dart';

class ProjectsScreen extends StatelessWidget {
  const ProjectsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final studentProv = context.watch<StudentProvider>();
    final projects = studentProv.student?.projects ?? [];

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: Text('Projects', style: AppTheme.heading2(context)),
                  ),
                    GestureDetector(
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const AddProjectScreen()),
                      ),
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppTheme.lavender,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppTheme.borderBlack, width: 2.5),
                          boxShadow: AppTheme.cardShadow,
                        ),
                        child: const Icon(Icons.add, size: 22),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Text('${projects.length} projects', style: AppTheme.caption(context)),
              const SizedBox(height: 16),
              if (projects.isEmpty)
                _emptyState(context)
              else
                Expanded(
                  child: GridView.builder(
                    itemCount: projects.length,
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 1,
                      childAspectRatio: 1.8,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                    ),
                    itemBuilder: (ctx, i) => _ProjectCard(project: projects[i]),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _emptyState(BuildContext context) {
    return Expanded(
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('🔨', style: TextStyle(fontSize: 64)),
            const SizedBox(height: 16),
            Text('No projects yet', style: AppTheme.sectionTitle(context)),
            const SizedBox(height: 8),
            Text('Tap + to add your first project', style: AppTheme.body(context)),
          ],
        ),
      ),
    );
  }
}

class _ProjectCard extends StatefulWidget {
  final ProjectModel project;
  const _ProjectCard({required this.project});

  @override
  State<_ProjectCard> createState() => _ProjectCardState();
}

class _ProjectCardState extends State<_ProjectCard> {
  bool _uploading = false;

  Future<void> _pickThumbnail() async {
    final picker = ImagePicker();
    final file = await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (file == null) return;

    setState(() => _uploading = true);
    final url = await CloudinaryService()
        .uploadFile(File(file.path), CloudinaryFolder.thumbnails);
    setState(() => _uploading = false);

    if (url != null && mounted) {
      context.read<StudentProvider>().updateThumbnail(widget.project.id, url);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = [AppTheme.lavender, AppTheme.mint, AppTheme.peach, AppTheme.skyBlue];
    final color = colors[widget.project.id.hashCode % colors.length];

    return GestureDetector(
      onLongPress: () => _showDeleteDialog(context),
      child: Container(
        decoration: BoxDecoration(
          color: color,
          borderRadius: AppTheme.cardRadius,
          border: AppTheme.cardBorder,
          boxShadow: AppTheme.cardShadow,
        ),
        child: Stack(
          children: [
            // Thumbnail
            if (widget.project.thumbnailUrl != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(21),
                child: CachedNetworkImage(
                  imageUrl: widget.project.thumbnailUrl!,
                  fit: BoxFit.cover,
                  width: double.infinity,
                  height: double.infinity,
                  color: Colors.black.withValues(alpha: 0.3),
                  colorBlendMode: BlendMode.darken,
                ),
              ),
            // Content
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          widget.project.title,
                          style: AppTheme.cardTitle(context).copyWith(
                            color: widget.project.thumbnailUrl != null
                                ? Colors.white
                                : AppTheme.textPrimary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      GestureDetector(
                        onTap: () => Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => AddProjectScreen(project: widget.project)),
                        ),
                        child: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: AppTheme.cardWhite,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: AppTheme.borderBlack, width: 1.5),
                          ),
                          child: const Icon(Icons.edit, size: 14),
                        ),
                      ),
                      const SizedBox(width: 8),
                      GestureDetector(
                        onTap: _uploading ? null : _pickThumbnail,
                        child: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: AppTheme.cardWhite,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: AppTheme.borderBlack, width: 1.5),
                          ),
                          child: _uploading
                              ? const SizedBox(
                                  width: 14,
                                  height: 14,
                                  child: CircularProgressIndicator(strokeWidth: 2))
                              : const Icon(Icons.image, size: 14),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    widget.project.description,
                    style: AppTheme.body(context).copyWith(
                      color: widget.project.thumbnailUrl != null
                          ? Colors.white70
                          : AppTheme.textBody,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const Spacer(),
                  Wrap(
                    spacing: 6,
                    children: widget.project.techStack.take(3).map((tech) {
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppTheme.cardWhite,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: AppTheme.borderBlack, width: 1.5),
                        ),
                        child: Text(tech,
                            style: const TextStyle(
                                fontSize: 10, fontWeight: FontWeight.w700)),
                      );
                    }).toList(),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showDeleteDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: const BorderSide(color: AppTheme.borderBlack, width: 3),
        ),
        title: const Text('Delete Project?'),
        content: Text(widget.project.title),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              context.read<StudentProvider>().deleteProject(widget.project.id);
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.softRed),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }
}

class AddProjectScreen extends StatefulWidget {
  final ProjectModel? project;
  const AddProjectScreen({super.key, this.project});

  @override
  State<AddProjectScreen> createState() => _AddProjectScreenState();
}

class _AddProjectScreenState extends State<AddProjectScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  final _githubCtrl = TextEditingController();
  final _liveCtrl = TextEditingController();
  final List<String> _techStack = [];
  File? _thumbnail;
  File? _certificate;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<StudentProvider>().fetchSkills();
    });
    if (widget.project != null) {
      _titleCtrl.text = widget.project!.title;
      _descCtrl.text = widget.project!.description;
      _githubCtrl.text = widget.project!.githubUrl ?? '';
      _liveCtrl.text = widget.project!.liveDemoUrl ?? '';
      _techStack.addAll(widget.project!.techStack);
    }
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _descCtrl.dispose();
    _githubCtrl.dispose();
    _liveCtrl.dispose();
    super.dispose();
  }

  void _showSkillsBottomSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.canvas,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (BuildContext context, StateSetter setModalState) {
            final availableSkills = context.watch<StudentProvider>().availableSkills;
            return FractionallySizedBox(
              heightFactor: 0.8,
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.all(20),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Select Tech Stack', style: AppTheme.sectionTitle(context)),
                        IconButton(
                          icon: const Icon(Icons.close),
                          onPressed: () => Navigator.pop(context),
                        )
                      ],
                    ),
                  ),
                  Expanded(
                    child: availableSkills.isEmpty
                        ? const Center(child: CircularProgressIndicator())
                        : ListView.builder(
                            itemCount: availableSkills.length,
                            itemBuilder: (context, index) {
                              final skill = availableSkills[index];
                              final isSelected = _techStack.contains(skill.name);
                              return CheckboxListTile(
                                title: Text(skill.name, style: AppTheme.body(context)),
                                value: isSelected,
                                activeColor: AppTheme.lavender,
                                checkColor: Colors.black,
                                onChanged: (bool? val) {
                                  setModalState(() {
                                    setState(() {
                                      if (val == true) {
                                        _techStack.add(skill.name);
                                      } else {
                                        _techStack.remove(skill.name);
                                      }
                                    });
                                  });
                                },
                              );
                            },
                          ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _pickThumbnail() async {
    final picker = ImagePicker();
    final file = await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (file != null) setState(() => _thumbnail = File(file.path));
  }

  Future<void> _pickCertificate() async {
    final picker = ImagePicker();
    final file = await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (file != null) setState(() => _certificate = File(file.path));
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);

    String? thumbnailUrl = widget.project?.thumbnailUrl;
    if (_thumbnail != null) {
      thumbnailUrl = await CloudinaryService()
          .uploadFile(_thumbnail!, CloudinaryFolder.thumbnails);
    }
    
    String? certUrl = widget.project?.certificateUrl;
    if (_certificate != null) {
      certUrl = await CloudinaryService()
          .uploadFile(_certificate!, CloudinaryFolder.certificates);
    }

    final data = {
      'title': _titleCtrl.text.trim(),
      'description': _descCtrl.text.trim(),
      'github_url': _githubCtrl.text.trim().isEmpty ? null : _githubCtrl.text.trim(),
      'live_demo_url': _liveCtrl.text.trim().isEmpty ? null : _liveCtrl.text.trim(),
      'tech_stack': _techStack,
      'thumbnail_url': thumbnailUrl,
      'certificate_url': certUrl,
    };

    // ignore: use_build_context_synchronously
    final prov = context.read<StudentProvider>();
    bool ok;
    if (widget.project == null) {
      ok = await prov.addProject(data);
    } else {
      ok = await prov.updateProject(widget.project!.id, data);
    }
    
    setState(() => _loading = false);
    if (ok && mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Add Project'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Thumbnail picker
              GestureDetector(
                onTap: _pickThumbnail,
                child: Container(
                  width: double.infinity,
                  height: 180,
                  decoration: BoxDecoration(
                    color: AppTheme.cardWhite,
                    borderRadius: AppTheme.cardRadius,
                    border: AppTheme.cardBorder,
                    boxShadow: AppTheme.cardShadow,
                  ),
                  child: _thumbnail != null
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(21),
                          child: Image.file(_thumbnail!, fit: BoxFit.cover))
                      : Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.image_outlined, size: 48, color: AppTheme.textCaption),
                            const SizedBox(height: 8),
                            Text('Tap to add thumbnail', style: AppTheme.caption(context)),
                          ],
                        ),
                ),
              ),
              const SizedBox(height: 20),
              _field(context, 'Project Title *', _titleCtrl,
                  validator: (v) => v!.isEmpty ? 'Required' : null),
              const SizedBox(height: 12),
              _field(context, 'Description *', _descCtrl,
                  maxLines: 3,
                  validator: (v) => v!.isEmpty ? 'Required' : null),
              const SizedBox(height: 12),
              _field(context, 'GitHub URL', _githubCtrl),
              const SizedBox(height: 12),
              _field(context, 'Live Demo URL', _liveCtrl),
              const SizedBox(height: 20),
              Text('Tech Stack', style: AppTheme.cardTitle(context)),
              const SizedBox(height: 8),
              GestureDetector(
                onTap: _showSkillsBottomSheet,
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                  decoration: BoxDecoration(
                    color: AppTheme.lavender,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppTheme.borderBlack, width: 2.5),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.add, size: 20),
                      SizedBox(width: 8),
                      Text("Select Tech Stack", style: TextStyle(fontWeight: FontWeight.w700)),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Text('Certificate', style: AppTheme.cardTitle(context)),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      _certificate != null || widget.project?.certificateUrl != null
                          ? 'Certificate Selected'
                          : 'No certificate chosen',
                      style: AppTheme.body(context),
                    ),
                  ),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(minimumSize: const Size(100, 48)),
                    onPressed: _pickCertificate,
                    child: const Text('Upload'),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: _techStack
                    .map((t) => Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: AppTheme.lavender,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppTheme.borderBlack, width: 2),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(t, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
                              const SizedBox(width: 4),
                              GestureDetector(
                                onTap: () => setState(() => _techStack.remove(t)),
                                child: const Icon(Icons.close, size: 14, color: AppTheme.textPrimary),
                              ),
                            ],
                          ),
                        ))
                    .toList(),
              ),
              const SizedBox(height: 32),
              ElevatedButton(
                onPressed: _loading ? null : _submit,
                child: _loading
                    ? const CircularProgressIndicator(strokeWidth: 2)
                    : const Text('Add Project'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field(BuildContext context, String label, TextEditingController ctrl,
      {int maxLines = 1, String? Function(String?)? validator}) {
    return TextFormField(
      controller: ctrl,
      maxLines: maxLines,
      validator: validator,
      decoration: InputDecoration(labelText: label),
    );
  }
}
