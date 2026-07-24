import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../providers/student_provider.dart';
import '../../models/student_model.dart';
import '../../models/skill_model.dart';

class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();

  final _nameCtrl = TextEditingController();
  final _branchCtrl = TextEditingController();
  final _cgpaCtrl = TextEditingController();
  String _careerInterest = 'SWE_BACKEND';

  int _semester = 1;
  String _collegeTier = 'Tier 1';
  int _backlogs = 0;
  int _commRating = 7;
  String _workStyle = 'Independent';
  List<String> _skills = [];
  bool _loading = false;

  List<String> _tiers = ['Tier 1', 'Tier 2', 'Tier 3'];
  List<String> _workStyles = ['Independent', 'Team Player', 'Hybrid', 'Startup'];
  List<String> _careerLabels = [
    'AIML_ENGINEER', 'PRODUCT_MANAGER', 'DEVOPS_CLOUD', 'DATA_ANALYST', 
    'CYBERSECURITY', 'SWE_FRONTEND', 'EMBEDDED_IOT', 'SWE_BACKEND', 
    'FULLSTACK_DEV', 'DATA_ENGINEER'
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<StudentProvider>().fetchSkills();
    });
    final student = context.read<StudentProvider>().student;
    if (student != null) _prefill(student);
  }

  void _prefill(StudentModel s) {
    _nameCtrl.text = s.name;
    _branchCtrl.text = s.branch;
    if (!_careerLabels.contains(s.careerInterest) && s.careerInterest.isNotEmpty) {
      _careerLabels.add(s.careerInterest);
    }
    _careerInterest = s.careerInterest.isNotEmpty ? s.careerInterest : 'SWE_BACKEND';
    _cgpaCtrl.text = s.cgpa.toString();
    _semester = s.semester;
    if (!_tiers.contains(s.collegeTier)) _tiers.add(s.collegeTier);
    _collegeTier = s.collegeTier;
    _backlogs = s.backlogCount;
    _commRating = s.communicationRating;
    if (!_workStyles.contains(s.workStylePref)) _workStyles.add(s.workStylePref);
    _workStyle = s.workStylePref;
    _skills = List.from(s.skills);
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _branchCtrl.dispose();
    _cgpaCtrl.dispose();
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
                        Text('Select Skills', style: AppTheme.sectionTitle(context)),
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
                              final isSelected = _skills.contains(skill.name);
                              return CheckboxListTile(
                                title: Text(skill.name, style: AppTheme.body(context)),
                                value: isSelected,
                                activeColor: AppTheme.lavender,
                                checkColor: Colors.black,
                                onChanged: (bool? val) {
                                  setModalState(() {
                                    setState(() {
                                      if (val == true) {
                                        _skills.add(skill.name);
                                      } else {
                                        _skills.remove(skill.name);
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

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    
    double? parsedCgpa = double.tryParse(_cgpaCtrl.text.trim());
    if (parsedCgpa == null || parsedCgpa < 0 || parsedCgpa > 10) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a valid CGPA (0-10)')),
      );
      return;
    }

    setState(() => _loading = true);

    final student = context.read<StudentProvider>().student;
    final data = {
      'name': _nameCtrl.text.trim(),
      'branch': _branchCtrl.text.trim(),
      'semester': _semester,
      'college_tier': _collegeTier,
      'cgpa': parsedCgpa,
      'backlog_count': _backlogs,
      'skills': _skills,
      'certifications': student?.certifications ?? [],
      'career_interest': _careerInterest,
      'communication_rating': _commRating,
      'work_style_pref': _workStyle,
      'internships': student?.internships.map((i) => i.toJson()).toList() ?? [],
      'projects': student?.projects.map((p) => p.toJson()).toList() ?? [],
      'semester_records': student?.semesterRecords ?? [],
    };

    final ok = await context.read<StudentProvider>().saveProfile(data);
    setState(() => _loading = false);
    if (ok && mounted) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profile saved!')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Edit Profile')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _section(context, 'Basic Info'),
              _field('Full Name *', _nameCtrl, validator: (v) => v!.isEmpty ? 'Required' : null),
              const SizedBox(height: 12),
              _field('Branch *', _branchCtrl, validator: (v) => v!.isEmpty ? 'Required' : null),
              const SizedBox(height: 12),
              _dropdownRow(context, 'Career Interest *', _careerInterest, _careerLabels,
                  (v) => setState(() => _careerInterest = v!)),
              const SizedBox(height: 20),
              _section(context, 'Academic'),
              _stepper(context, 'Semester', _semester, 1, 8, (v) => setState(() => _semester = v)),
              const SizedBox(height: 12),
              _field('CGPA (0-10)', _cgpaCtrl, isNumber: true, validator: (v) => v!.isEmpty ? 'Required' : null),
              const SizedBox(height: 12),
              _stepper(context, 'Backlogs', _backlogs, 0, 20, (v) => setState(() => _backlogs = v)),
              const SizedBox(height: 12),
              _dropdownRow(context, 'College Tier', _collegeTier, _tiers,
                  (v) => setState(() => _collegeTier = v!)),
              const SizedBox(height: 20),
              _section(context, 'Soft Skills'),
              _sliderRow(context, '💬 Communication', _commRating, 1, 10,
                  (v) => setState(() => _commRating = v.round())),
              const SizedBox(height: 12),
              _dropdownRow(context, 'Work Style', _workStyle, _workStyles,
                  (v) => setState(() => _workStyle = v!)),
              const SizedBox(height: 20),
              _section(context, 'Skills'),
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
                      Text("Select Skills", style: TextStyle(fontWeight: FontWeight.w700)),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                children: _skills
                    .map((s) => _chipDel(s, AppTheme.lavender,
                        () => setState(() => _skills.remove(s))))
                    .toList(),
              ),
              const SizedBox(height: 40),
              ElevatedButton(
                onPressed: _loading ? null : _submit,
                child: _loading
                    ? const CircularProgressIndicator(strokeWidth: 2)
                    : const Text('Save Profile'),
              ),
              const SizedBox(height: 40),
            ],
          ),
        ),
      ),
    );
  }

  Widget _section(BuildContext context, String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(label, style: AppTheme.sectionTitle(context)),
    );
  }

  Widget _field(String label, TextEditingController ctrl,
      {int maxLines = 1, String? Function(String?)? validator, bool isNumber = false}) {
    return TextFormField(
      controller: ctrl,
      maxLines: maxLines,
      validator: validator,
      keyboardType: isNumber ? const TextInputType.numberWithOptions(decimal: true) : null,
      decoration: InputDecoration(labelText: label),
    );
  }

  Widget _stepper(BuildContext context, String label, int value, int min, int max,
      ValueChanged<int> onChanged) {
    return Row(
      children: [
        Expanded(
          child: Text(label, style: AppTheme.body(context)),
        ),
        Container(
          decoration: BoxDecoration(
            color: AppTheme.cardWhite,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppTheme.borderBlack, width: 2.5),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                icon: const Icon(Icons.remove),
                onPressed: value > min ? () => onChanged(value - 1) : null,
              ),
              Text('$value',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              IconButton(
                icon: const Icon(Icons.add),
                onPressed: value < max ? () => onChanged(value + 1) : null,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _sliderRow(BuildContext context, String label, int value, int min, int max,
      ValueChanged<double> onChanged) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(label, style: AppTheme.body(context)),
            const Spacer(),
            Text('$value / $max',
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
          ],
        ),
        Slider(
          value: value.toDouble(),
          min: min.toDouble(),
          max: max.toDouble(),
          divisions: max - min,
          activeColor: AppTheme.lavender,
          onChanged: onChanged,
        ),
      ],
    );
  }

  Widget _dropdownRow(BuildContext context, String label, String value, List<String> items,
      ValueChanged<String?> onChanged) {
    return Row(
      children: [
        Expanded(child: Text(label, style: AppTheme.body(context))),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: AppTheme.cardWhite,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppTheme.borderBlack, width: 2.5),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: value,
              items: items.map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
              onChanged: onChanged,
            ),
          ),
        ),
      ],
    );
  }

  Widget _chipDel(String label, Color color, VoidCallback onDelete) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppTheme.borderBlack, width: 1.5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
          const SizedBox(width: 4),
          GestureDetector(
            onTap: onDelete,
            child: const Icon(Icons.close, size: 14),
          ),
        ],
      ),
    );
  }
}
