import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../providers/student_provider.dart';
import '../../screens/main/main_scaffold.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _formKey = GlobalKey<FormState>();

  final _nameCtrl = TextEditingController();
  final _branchCtrl = TextEditingController(text: 'Computer Science');
  final _cgpaCtrl = TextEditingController(text: '8.0');
  String _careerInterest = 'SWE_BACKEND';

  int _semester = 6;
  String _collegeTier = 'Tier 2';
  int _backlogs = 0;
  int _commRating = 8;
  String _workStyle = 'Independent';
  final List<String> _selectedSkills = ['Python', 'FastAPI', 'PostgreSQL', 'Docker', 'Git'];
  bool _loading = false;

  final List<String> _tiers = const ['Tier 1', 'Tier 2', 'Tier 3'];
  final List<String> _workStyles = const ['Independent', 'Team Player', 'Hybrid', 'Startup'];
  final Map<String, String> _careerOptions = const {
    'SWE_BACKEND': 'Backend Developer',
    'AIML_ENGINEER': 'AI / ML Engineer',
    'FULLSTACK_DEV': 'Full Stack Developer',
    'SWE_FRONTEND': 'Frontend Developer',
    'DATA_ANALYST': 'Data Analyst',
    'DEVOPS_CLOUD': 'DevOps / Cloud Engineer',
    'CYBERSECURITY': 'Cybersecurity Analyst',
    'EMBEDDED_IOT': 'Embedded / IoT Engineer',
    'PRODUCT_MANAGER': 'Product Manager',
    'DATA_ENGINEER': 'Data Engineer',
  };

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<StudentProvider>().fetchSkills();
    });
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _branchCtrl.dispose();
    _cgpaCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedSkills.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select at least one technical skill.')),
      );
      return;
    }

    setState(() => _loading = true);

    final studentData = {
      'name': _nameCtrl.text.trim(),
      'branch': _branchCtrl.text.trim(),
      'semester': _semester,
      'college_tier': _collegeTier,
      'cgpa': double.tryParse(_cgpaCtrl.text.trim()) ?? 0.0,
      'backlog_count': _backlogs,
      'skills': _selectedSkills,
      'certifications': [],
      'career_interest': _careerInterest,
      'communication_rating': _commRating,
      'work_style_pref': _workStyle,
      'projects': [],
      'internships': [],
      'semester_records': [],
    };

    final success = await context.read<StudentProvider>().saveProfile(studentData);
    setState(() => _loading = false);

    if (success && mounted) {
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) => const MainScaffold()),
        (route) => false,
      );
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(context.read<StudentProvider>().error ?? 'Failed to save profile.'),
          backgroundColor: const Color(0xFFC62828),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final studentProv = context.watch<StudentProvider>();
    final availableSkills = studentProv.availableSkills;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Complete Your Profile'),
        automaticallyImplyLeading: false,
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppTheme.cardWhite,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppTheme.primary.withValues(alpha: 0.2), width: 1.0),
                boxShadow: AppTheme.cardShadow,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: AppTheme.primaryLight,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Text('🧠', style: TextStyle(fontSize: 20)),
                      ),
                      const SizedBox(width: 10),
                      Text('Welcome to MirrorMind! 🚀', style: AppTheme.sectionTitle(context)),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Let\'s build your academic & skill profile to enable AI career predictions and recommendations.',
                    style: AppTheme.body(context),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Name
            TextFormField(
              controller: _nameCtrl,
              decoration: const InputDecoration(labelText: 'Full Name *', hintText: 'Arjun Sharma'),
              validator: (v) => v == null || v.trim().isEmpty ? 'Please enter your full name' : null,
            ),
            const SizedBox(height: 16),

            // Branch
            TextFormField(
              controller: _branchCtrl,
              decoration: const InputDecoration(labelText: 'Branch / Major *', hintText: 'Computer Science'),
              validator: (v) => v == null || v.trim().isEmpty ? 'Please enter your branch' : null,
            ),
            const SizedBox(height: 16),

            // Semester & CGPA row
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<int>(
                    initialValue: _semester,
                    decoration: const InputDecoration(labelText: 'Semester'),
                    items: List.generate(8, (i) => i + 1)
                        .map((sem) => DropdownMenuItem(value: sem, child: Text('Sem $sem')))
                        .toList(),
                    onChanged: (val) {
                      if (val != null) setState(() => _semester = val);
                    },
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: TextFormField(
                    controller: _cgpaCtrl,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(labelText: 'CGPA (0-10)', hintText: '8.5'),
                    validator: (v) {
                      final val = double.tryParse(v ?? '');
                      if (val == null || val < 0 || val > 10) return 'Valid CGPA required';
                      return null;
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // College Tier & Backlogs
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _collegeTier,
                    decoration: const InputDecoration(labelText: 'College Tier'),
                    items: _tiers
                        .map((tier) => DropdownMenuItem(value: tier, child: Text(tier)))
                        .toList(),
                    onChanged: (val) {
                      if (val != null) setState(() => _collegeTier = val);
                    },
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: DropdownButtonFormField<int>(
                    initialValue: _backlogs,
                    decoration: const InputDecoration(labelText: 'Backlogs'),
                    items: List.generate(10, (i) => i)
                        .map((b) => DropdownMenuItem(value: b, child: Text('$b')))
                        .toList(),
                    onChanged: (val) {
                      if (val != null) setState(() => _backlogs = val);
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Career Interest
            DropdownButtonFormField<String>(
              initialValue: _careerInterest,
              decoration: const InputDecoration(labelText: 'Target Career Role'),
              items: _careerOptions.entries
                  .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
                  .toList(),
              onChanged: (val) {
                if (val != null) setState(() => _careerInterest = val);
              },
            ),
            const SizedBox(height: 20),

            // Technical Skills Tag Selector
            const Text('Select Your Technical Skills *', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: availableSkills.map((skill) {
                final isSelected = _selectedSkills.contains(skill.name);
                return FilterChip(
                  label: Text(skill.name),
                  selected: isSelected,
                  selectedColor: AppTheme.primaryLight,
                  checkmarkColor: AppTheme.primary,
                  backgroundColor: AppTheme.cardWhite,
                  labelStyle: TextStyle(
                    fontSize: 12,
                    fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                    color: isSelected ? AppTheme.primary : AppTheme.textPrimary,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(999),
                    side: BorderSide(
                      color: isSelected ? AppTheme.primary : AppTheme.borderLight,
                      width: 1.0,
                    ),
                  ),
                  onSelected: (selected) {
                    setState(() {
                      if (selected) {
                        _selectedSkills.add(skill.name);
                      } else {
                        _selectedSkills.remove(skill.name);
                      }
                    });
                  },
                );
              }).toList(),
            ),
            const SizedBox(height: 20),

            // Work Style & Communication Rating
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _workStyle,
                    decoration: const InputDecoration(labelText: 'Work Style'),
                    items: _workStyles
                        .map((w) => DropdownMenuItem(value: w, child: Text(w)))
                        .toList(),
                    onChanged: (val) {
                      if (val != null) setState(() => _workStyle = val);
                    },
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: DropdownButtonFormField<int>(
                    initialValue: _commRating,
                    decoration: const InputDecoration(labelText: 'Communication (1-10)'),
                    items: List.generate(10, (i) => i + 1)
                        .map((r) => DropdownMenuItem(value: r, child: Text('$r / 10')))
                        .toList(),
                    onChanged: (val) {
                      if (val != null) setState(() => _commRating = val);
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 32),

            // Submit Button
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
                minimumSize: const Size(double.infinity, 52),
              ),
              onPressed: _loading ? null : _submit,
              child: Text(
                _loading ? 'Saving Profile…' : 'Complete Onboarding 🚀',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Colors.white),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
