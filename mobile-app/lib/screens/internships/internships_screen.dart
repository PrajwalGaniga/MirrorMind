import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:file_picker/file_picker.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_theme.dart';
import '../../providers/student_provider.dart';
import '../../core/services/cloudinary_service.dart';
import '../../models/internship_model.dart';

class InternshipsScreen extends StatelessWidget {
  const InternshipsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final studentProv = context.watch<StudentProvider>();
    final internships = studentProv.student?.internships ?? [];

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
                  Expanded(child: Text('Internships', style: AppTheme.heading2(context))),
                  GestureDetector(
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const AddInternshipScreen()),
                    ),
                    child: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppTheme.primary,
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [
                          BoxShadow(
                            color: AppTheme.primary.withValues(alpha: 0.25),
                            blurRadius: 8,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: const Icon(Icons.add_rounded, size: 22, color: Colors.white),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (internships.isEmpty)
                Expanded(child: _emptyState(context))
              else
                Expanded(
                  child: ListView.separated(
                    itemCount: internships.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (ctx, i) =>
                        _InternshipCard(internship: internships[i]),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _emptyState(BuildContext context) => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('🏢', style: TextStyle(fontSize: 64)),
            const SizedBox(height: 16),
            Text('No internships yet', style: AppTheme.sectionTitle(context)),
            const SizedBox(height: 8),
            Text('Tap + to add your experience', style: AppTheme.body(context)),
          ],
        ),
      );
}

class _InternshipCard extends StatefulWidget {
  final InternshipModel internship;
  const _InternshipCard({required this.internship});

  @override
  State<_InternshipCard> createState() => _InternshipCardState();
}

class _InternshipCardState extends State<_InternshipCard> {
  bool _uploading = false;

  Future<void> _uploadCertificate() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
    );
    if (result == null || result.files.isEmpty) return;
    final file = File(result.files.single.path!);

    setState(() => _uploading = true);
    final url = await CloudinaryService()
        .uploadFile(file, CloudinaryFolder.certificates);
    setState(() => _uploading = false);

    if (url != null && mounted) {
      context.read<StudentProvider>().updateCertificate(widget.internship.id, url);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Certificate uploaded!')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final fmt = DateFormat('MMM yyyy');
    final start = fmt.format(widget.internship.startDate);
    final end = widget.internship.isCurrent
        ? 'Present'
        : (widget.internship.endDate != null
            ? fmt.format(widget.internship.endDate!)
            : '—');

    final hasCert = widget.internship.certificateUrl != null;

    return GestureDetector(
      onLongPress: () => _showDeleteDialog(context),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.cardWhite,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppTheme.borderLight, width: 1.0),
          boxShadow: AppTheme.cardShadow,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: widget.internship.isCurrent ? AppTheme.emeraldBg : AppTheme.primaryLight,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: (widget.internship.isCurrent ? AppTheme.emerald : AppTheme.primary).withValues(alpha: 0.15),
                      width: 1.0,
                    ),
                  ),
                  child: Icon(
                    Icons.business_center_rounded,
                    size: 20,
                    color: widget.internship.isCurrent ? AppTheme.emeraldText : AppTheme.primary,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.internship.companyName,
                        style: AppTheme.cardTitle(context).copyWith(fontWeight: FontWeight.w800),
                      ),
                      Text(
                        widget.internship.role,
                        style: AppTheme.body(context).copyWith(fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),
                if (widget.internship.isCurrent)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppTheme.emeraldBg,
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: AppTheme.emerald.withValues(alpha: 0.25), width: 1.0),
                    ),
                    child: const Text(
                      'Current',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppTheme.emeraldText),
                    ),
                  ),
                const SizedBox(width: 6),
                GestureDetector(
                  onTap: () => _showDeleteDialog(context),
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: AppTheme.roseBg,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppTheme.rose.withValues(alpha: 0.2), width: 1.0),
                    ),
                    child: const Icon(Icons.delete_outline_rounded, size: 14, color: AppTheme.roseText),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                const Icon(Icons.calendar_month_rounded, size: 14, color: AppTheme.textCaption),
                const SizedBox(width: 4),
                Text('$start – $end', style: AppTheme.caption(context)),
                const SizedBox(width: 12),
                const Icon(Icons.work_outline_rounded, size: 14, color: AppTheme.textCaption),
                const SizedBox(width: 4),
                Text(widget.internship.domain, style: AppTheme.caption(context)),
              ],
            ),
            if (widget.internship.description != null) ...[
              const SizedBox(height: 8),
              Text(
                widget.internship.description!,
                style: AppTheme.body(context),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
            const SizedBox(height: 12),
            GestureDetector(
              onTap: _uploading ? null : _uploadCertificate,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                decoration: BoxDecoration(
                  color: hasCert ? AppTheme.emeraldBg : AppTheme.canvas,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: hasCert ? AppTheme.emerald.withValues(alpha: 0.3) : AppTheme.borderLight,
                    width: 1.0,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _uploading
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2))
                        : Icon(
                            hasCert
                                ? Icons.verified_rounded
                                : Icons.upload_file_rounded,
                            size: 15,
                            color: hasCert ? AppTheme.emeraldText : AppTheme.textBody,
                          ),
                    const SizedBox(width: 6),
                    Text(
                      hasCert ? 'Certificate Verified ✓' : 'Upload Certificate',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: hasCert ? AppTheme.emeraldText : AppTheme.textBody,
                      ),
                    ),
                  ],
                ),
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
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: AppTheme.borderLight, width: 1.0),
        ),
        title: const Text('Delete Internship?'),
        content: Text('Are you sure you want to remove your experience at "${widget.internship.companyName}" from your database records?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel', style: TextStyle(color: AppTheme.textCaption)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              context.read<StudentProvider>().deleteInternship(widget.internship.id);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }
}

class AddInternshipScreen extends StatefulWidget {
  const AddInternshipScreen({super.key});

  @override
  State<AddInternshipScreen> createState() => _AddInternshipScreenState();
}

class _AddInternshipScreenState extends State<AddInternshipScreen> {
  final _formKey = GlobalKey<FormState>();
  final _companyCtrl = TextEditingController();
  final _domainCtrl = TextEditingController();
  final _roleCtrl = TextEditingController();
  final _descCtrl = TextEditingController();
  DateTime _startDate = DateTime.now();
  DateTime? _endDate;
  bool _isCurrent = false;
  File? _certificate;
  bool _loading = false;

  @override
  void dispose() {
    _companyCtrl.dispose();
    _domainCtrl.dispose();
    _roleCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate(bool isStart) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: isStart ? _startDate : (_endDate ?? DateTime.now()),
      firstDate: DateTime(2015),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() {
        if (isStart) {
          _startDate = picked;
        } else {
          _endDate = picked;
        }
      });
    }
  }

  Future<void> _pickCertificate() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
    );
    if (result?.files.isNotEmpty == true) {
      setState(() => _certificate = File(result!.files.single.path!));
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);

    String? certUrl;
    if (_certificate != null) {
      certUrl = await CloudinaryService()
          .uploadFile(_certificate!, CloudinaryFolder.certificates);
    }

    final data = {
      'company_name': _companyCtrl.text.trim(),
      'domain': _domainCtrl.text.trim(),
      'role': _roleCtrl.text.trim(),
      'description': _descCtrl.text.trim().isEmpty ? null : _descCtrl.text.trim(),
      'start_date': _startDate.toIso8601String(),
      'end_date': _isCurrent ? null : _endDate?.toIso8601String(),
      'is_current': _isCurrent ? 1 : 0,
      'certificate_url': certUrl,
    };

    // ignore: use_build_context_synchronously
    final studentProv2 = context.read<StudentProvider>();
    final ok = await studentProv2.addInternship(data);
    setState(() => _loading = false);
    if (ok && mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final fmt = DateFormat('dd MMM yyyy');

    return Scaffold(
      appBar: AppBar(title: const Text('Add Internship')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _field('Company Name *', _companyCtrl, validator: (v) => v!.isEmpty ? 'Required' : null),
              const SizedBox(height: 12),
              _field('Domain *', _domainCtrl, validator: (v) => v!.isEmpty ? 'Required' : null),
              const SizedBox(height: 12),
              _field('Role *', _roleCtrl, validator: (v) => v!.isEmpty ? 'Required' : null),
              const SizedBox(height: 12),
              _field('Description', _descCtrl, maxLines: 3),
              const SizedBox(height: 20),
              Text('Duration', style: AppTheme.cardTitle(context)),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: _dateChip('Start', fmt.format(_startDate), () => _pickDate(true)),
                  ),
                  const SizedBox(width: 12),
                  if (!_isCurrent)
                    Expanded(
                      child: _dateChip(
                        'End',
                        _endDate != null ? fmt.format(_endDate!) : 'Pick date',
                        () => _pickDate(false),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Checkbox(
                    value: _isCurrent,
                    onChanged: (v) => setState(() => _isCurrent = v!),
                  ),
                  Text('Currently working here', style: AppTheme.body(context)),
                ],
              ),
              const SizedBox(height: 20),
              Text('Certificate (optional)', style: AppTheme.cardTitle(context)),
              const SizedBox(height: 8),
              GestureDetector(
                onTap: _pickCertificate,
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: _certificate != null ? AppTheme.mint : AppTheme.cardWhite,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppTheme.borderBlack, width: 2.5),
                  ),
                  child: Row(
                    children: [
                      Icon(_certificate != null
                          ? Icons.check_circle_outline
                          : Icons.upload_file_outlined),
                      const SizedBox(width: 10),
                      Text(
                        _certificate != null
                            ? _certificate!.path.split('/').last
                            : 'Upload PDF or Image',
                        style: AppTheme.body(context),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 32),
              ElevatedButton(
                onPressed: _loading ? null : _submit,
                child: _loading
                    ? const CircularProgressIndicator(strokeWidth: 2)
                    : const Text('Add Internship'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field(String label, TextEditingController ctrl,
      {int maxLines = 1, String? Function(String?)? validator}) {
    return TextFormField(
      controller: ctrl,
      maxLines: maxLines,
      validator: validator,
      decoration: InputDecoration(labelText: label),
    );
  }

  Widget _dateChip(String label, String value, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppTheme.cardWhite,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.borderBlack, width: 2.5),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: AppTheme.caption(context)),
            const SizedBox(height: 2),
            Text(value,
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
          ],
        ),
      ),
    );
  }
}
